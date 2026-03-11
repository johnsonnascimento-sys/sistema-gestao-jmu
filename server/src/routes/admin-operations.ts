import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config";
import type { DatabasePool } from "../db";
import type { OperationalEventKind } from "../domain/types";
import { describeMigrations } from "../migrations/describe-migrations";
import type { OperationsStore } from "../observability/operations-store";
import { describeBackupStatus } from "../operations/backup-status";
import { listOperationalEvents } from "../operations/operational-events";
import type { SettingsRepository } from "../repositories/types";
import { createRuntimeStatus } from "../runtime";

const listOpsSchema = z.object({
  limit: z.coerce.number().int().positive().max(30).optional(),
  days: z.coerce.number().int().min(7).max(365).optional(),
});

const updateQueueHealthConfigSchema = z
  .object({
    attentionDays: z.coerce.number().int().positive(),
    criticalDays: z.coerce.number().int().positive(),
  })
  .refine((value) => value.criticalDays >= value.attentionDays, {
    message: "O limite critico deve ser maior ou igual ao limite de atencao.",
    path: ["criticalDays"],
  });

function findLatestEvent(events: Awaited<ReturnType<typeof listOperationalEvents>>, kind: string, status: "success" | "failure") {
  return events.find((event) => event.kind === kind && event.status === status) ?? null;
}

function buildOperationalSummary(
  backupStatus: Awaited<ReturnType<typeof describeBackupStatus>>,
  operationalEvents: Awaited<ReturnType<typeof listOperationalEvents>>,
) {
  const last24hBoundary = Date.now() - 24 * 60 * 60 * 1000;
  const failuresByKind24h = operationalEvents
    .filter((event) => event.status === "failure" && new Date(event.occurredAt).getTime() >= last24hBoundary)
    .reduce<Map<string, number>>((acc, event) => {
      acc.set(event.kind, (acc.get(event.kind) ?? 0) + 1);
      return acc;
    }, new Map());
  const lastSuccessfulBackupAt = backupStatus.lastBackup?.modifiedAt ?? findLatestEvent(operationalEvents, "backup", "success")?.occurredAt ?? null;
  const backupAgeHours =
    lastSuccessfulBackupAt === null ? null : Number((((Date.now() - new Date(lastSuccessfulBackupAt).getTime()) / 3_600_000)).toFixed(1));
  const backupFreshness =
    backupAgeHours === null
      ? "unknown"
      : backupAgeHours <= 24
        ? "fresh"
        : backupAgeHours <= 48
          ? "attention"
          : "critical";

  return {
    backupFreshness,
    lastSuccessfulBackupAt,
    backupAgeHours,
    lastSuccessfulDeployAt: findLatestEvent(operationalEvents, "deploy", "success")?.occurredAt ?? null,
    lastSuccessfulRestoreDrillAt: findLatestEvent(operationalEvents, "restore_drill", "success")?.occurredAt ?? null,
    lastSuccessfulBootstrapAuditAt: findLatestEvent(operationalEvents, "bootstrap_audit", "success")?.occurredAt ?? null,
    lastSuccessfulRollbackAt: findLatestEvent(operationalEvents, "rollback", "success")?.occurredAt ?? null,
    lastFailedMonitorAt: findLatestEvent(operationalEvents, "monitor", "failure")?.occurredAt ?? null,
    lastFailedMonitorMessage: findLatestEvent(operationalEvents, "monitor", "failure")?.message ?? null,
    failureCount24h: Array.from(failuresByKind24h.values()).reduce((total, current) => total + current, 0),
    failuresByKind24h: Array.from(failuresByKind24h.entries())
      .map(([kind, total]) => ({ kind: kind as OperationalEventKind, total }))
      .sort((left, right) => right.total - left.total || left.kind.localeCompare(right.kind)),
  };
}

async function getCaseManagementReport(pool: DatabasePool, periodDays: number) {
  const reportResult = await pool.query<{
    created_in_period: string;
    closed_in_period: string;
    tramitacoes_in_period: string;
    previous_created_in_period: string;
    previous_closed_in_period: string;
    previous_tramitacoes_in_period: string;
    overdue_total: string;
    due_soon_total: string;
    without_setor_total: string;
    without_interessados_total: string;
    previous_overdue_total: string;
    previous_due_soon_total: string;
    previous_without_setor_total: string;
    previous_without_interessados_total: string;
  }>(
    `
      select
        count(*) filter (where pd.created_at >= now() - make_interval(days => $1::int))::int as created_in_period,
        count(*) filter (where pd.data_conclusao is not null and pd.data_conclusao >= current_date - $1::int)::int as closed_in_period,
        (
          select count(*)
          from adminlog.andamentos andamento
          where andamento.tipo = 'tramitacao'
            and andamento.data_hora >= now() - make_interval(days => $1::int)
        )::int as tramitacoes_in_period,
        count(*) filter (
          where pd.created_at >= now() - make_interval(days => ($1::int * 2))
            and pd.created_at < now() - make_interval(days => $1::int)
        )::int as previous_created_in_period,
        count(*) filter (
          where pd.data_conclusao is not null
            and pd.data_conclusao >= current_date - ($1::int * 2)
            and pd.data_conclusao < current_date - $1::int
        )::int as previous_closed_in_period,
        (
          select count(*)
          from adminlog.andamentos andamento
          where andamento.tipo = 'tramitacao'
            and andamento.data_hora >= now() - make_interval(days => ($1::int * 2))
            and andamento.data_hora < now() - make_interval(days => $1::int)
        )::int as previous_tramitacoes_in_period,
        count(*) filter (where pd.status <> 'encerrada' and pd.prazo_final is not null and pd.prazo_final < current_date)::int as overdue_total,
        count(*) filter (where pd.status <> 'encerrada' and pd.prazo_final is not null and pd.prazo_final between current_date and current_date + interval '7 days')::int as due_soon_total,
        count(*) filter (where pd.status <> 'encerrada' and pd.setor_atual_id is null)::int as without_setor_total,
        count(*) filter (
          where pd.status <> 'encerrada'
            and not exists (
              select 1
              from adminlog.demanda_interessados di
              where di.pre_demanda_id = pd.id
            )
        )::int as without_interessados_total,
        count(*) filter (
          where pd.created_at < now() - make_interval(days => $1::int)
            and pd.status <> 'encerrada'
            and pd.prazo_final is not null
            and pd.prazo_final < current_date - $1::int
            and (
              pd.data_conclusao is null
              or pd.data_conclusao >= current_date - $1::int
            )
        )::int as previous_overdue_total,
        count(*) filter (
          where pd.created_at < now() - make_interval(days => $1::int)
            and pd.status <> 'encerrada'
            and pd.prazo_final is not null
            and pd.prazo_final between current_date - $1::int and current_date
            and (
              pd.data_conclusao is null
              or pd.data_conclusao >= current_date - $1::int
            )
        )::int as previous_due_soon_total,
        count(*) filter (
          where pd.created_at < now() - make_interval(days => $1::int)
            and pd.status <> 'encerrada'
            and pd.setor_atual_id is null
            and (
              pd.data_conclusao is null
              or pd.data_conclusao >= current_date - $1::int
            )
        )::int as previous_without_setor_total,
        count(*) filter (
          where pd.created_at < now() - make_interval(days => $1::int)
            and pd.status <> 'encerrada'
            and not exists (
              select 1
              from adminlog.demanda_interessados di
              where di.pre_demanda_id = pd.id
            )
            and (
              pd.data_conclusao is null
              or pd.data_conclusao >= current_date - $1::int
            )
        )::int as previous_without_interessados_total
      from adminlog.pre_demanda pd
    `,
    [periodDays],
  );

  const bySetorResult = await pool.query<{
    setor_id: string | null;
    setor_sigla: string | null;
    setor_nome: string | null;
    active_total: string;
    previous_active_total: string;
    overdue_total: string;
    due_soon_total: string;
    awaiting_sei_total: string;
  }>(
    `
      select
        setor.id::text as setor_id,
        setor.sigla as setor_sigla,
        setor.nome_completo as setor_nome,
        count(*) filter (where pd.status <> 'encerrada')::int as active_total,
        count(*) filter (
          where pd.status <> 'encerrada'
            and pd.created_at < now() - make_interval(days => $1::int)
            and (
              pd.data_conclusao is null
              or pd.data_conclusao >= current_date - $1::int
            )
        )::int as previous_active_total,
        count(*) filter (where pd.status <> 'encerrada' and pd.prazo_final is not null and pd.prazo_final < current_date)::int as overdue_total,
        count(*) filter (
          where pd.status <> 'encerrada'
            and pd.prazo_final is not null
            and pd.prazo_final between current_date and current_date + interval '7 days'
        )::int as due_soon_total,
        count(*) filter (where pd.status = 'aguardando_sei')::int as awaiting_sei_total
      from adminlog.pre_demanda pd
      left join adminlog.setores setor on setor.id = pd.setor_atual_id
      group by setor.id, setor.sigla, setor.nome_completo
      having count(*) filter (where pd.status <> 'encerrada') > 0 or setor.id is null
        order by
          case when setor.sigla is null then 1 else 0 end,
          count(*) filter (where pd.status <> 'encerrada') desc,
          setor.sigla asc nulls last
    `,
    [periodDays],
  );

  const reportRow = reportResult.rows[0];
  const previousCreatedInPeriod = Number(reportRow?.previous_created_in_period ?? 0);
  const previousClosedInPeriod = Number(reportRow?.previous_closed_in_period ?? 0);
  const previousTramitacoesInPeriod = Number(reportRow?.previous_tramitacoes_in_period ?? 0);
  const previousOverdueTotal = Number(reportRow?.previous_overdue_total ?? 0);
  const previousDueSoonTotal = Number(reportRow?.previous_due_soon_total ?? 0);
  const previousWithoutSetorTotal = Number(reportRow?.previous_without_setor_total ?? 0);
  const previousWithoutInteressadosTotal = Number(reportRow?.previous_without_interessados_total ?? 0);
  const createdInPeriod = Number(reportRow?.created_in_period ?? 0);
  const closedInPeriod = Number(reportRow?.closed_in_period ?? 0);
  const tramitacoesInPeriod = Number(reportRow?.tramitacoes_in_period ?? 0);
  const overdueTotal = Number(reportRow?.overdue_total ?? 0);
  const dueSoonTotal = Number(reportRow?.due_soon_total ?? 0);
  const withoutSetorTotal = Number(reportRow?.without_setor_total ?? 0);
  const withoutInteressadosTotal = Number(reportRow?.without_interessados_total ?? 0);
  const bySetor = bySetorResult.rows
    .map((row) => {
      const activeTotal = Number(row.active_total ?? 0);
      const previousActiveTotal = Number(row.previous_active_total ?? 0);
      const activeDelta = activeTotal - previousActiveTotal;
      const overdueTotal = Number(row.overdue_total ?? 0);
      const dueSoonTotal = Number(row.due_soon_total ?? 0);
      const awaitingSeiTotal = Number(row.awaiting_sei_total ?? 0);
      const risk = buildSetorRiskScore({
        activeTotal,
        activeDelta,
        overdueTotal,
        dueSoonTotal,
        awaitingSeiTotal,
      });

      return {
        setorId: row.setor_id ? String(row.setor_id) : null,
        sigla: row.setor_sigla ? String(row.setor_sigla) : null,
        nome: row.setor_nome ? String(row.setor_nome) : null,
        activeTotal,
        previousActiveTotal,
        activeDelta,
        overdueTotal,
        dueSoonTotal,
        awaitingSeiTotal,
        riskScore: risk.score,
        riskLevel: risk.level,
      };
    })
    .sort((left, right) => right.riskScore - left.riskScore || right.activeTotal - left.activeTotal || (left.sigla ?? "ZZZ").localeCompare(right.sigla ?? "ZZZ"));

  return {
    periodDays,
    createdInPeriod,
    closedInPeriod,
    tramitacoesInPeriod,
    overdueTotal,
    dueSoonTotal,
    withoutSetorTotal,
    withoutInteressadosTotal,
    previousPeriod: {
      createdInPeriod: previousCreatedInPeriod,
      closedInPeriod: previousClosedInPeriod,
      tramitacoesInPeriod: previousTramitacoesInPeriod,
      overdueTotal: previousOverdueTotal,
      dueSoonTotal: previousDueSoonTotal,
      withoutSetorTotal: previousWithoutSetorTotal,
      withoutInteressadosTotal: previousWithoutInteressadosTotal,
    },
    deltas: {
      createdInPeriod: createdInPeriod - previousCreatedInPeriod,
      closedInPeriod: closedInPeriod - previousClosedInPeriod,
      tramitacoesInPeriod: tramitacoesInPeriod - previousTramitacoesInPeriod,
      overdueTotal: overdueTotal - previousOverdueTotal,
      dueSoonTotal: dueSoonTotal - previousDueSoonTotal,
      withoutSetorTotal: withoutSetorTotal - previousWithoutSetorTotal,
      withoutInteressadosTotal: withoutInteressadosTotal - previousWithoutInteressadosTotal,
    },
    bySetor,
    prioritySetores: bySetor.filter((item) => item.riskLevel !== "normal").slice(0, 3),
  };
}

function escapeCsvValue(value: string | number | null) {
  if (value === null) {
    return "";
  }

  const text = String(value);
  if (!/[",;\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function buildSetorRiskScore(input: {
  activeTotal: number;
  activeDelta: number;
  overdueTotal: number;
  dueSoonTotal: number;
  awaitingSeiTotal: number;
}) {
  const score =
    input.overdueTotal * 5 +
    input.dueSoonTotal * 3 +
    input.awaitingSeiTotal * 2 +
    Math.max(input.activeDelta, 0) * 2 +
    input.activeTotal;

  if (score >= 12 || input.overdueTotal >= 2) {
    return { score, level: "critical" as const };
  }

  if (score >= 5 || input.dueSoonTotal >= 1 || input.activeDelta > 0) {
    return { score, level: "attention" as const };
  }

  return { score, level: "normal" as const };
}

export async function registerAdminOperationsRoutes(
  app: FastifyInstance,
  options: {
    config: AppConfig;
    pool: DatabasePool;
    operationsStore: OperationsStore;
    settingsRepository: SettingsRepository;
  },
) {
  const { config, pool, operationsStore, settingsRepository } = options;

  app.get("/api/admin/ops/resumo", { preHandler: [app.authenticate, app.authorize("admin.ops.read")] }, async (request, reply) => {
    const query = listOpsSchema.parse(request.query);
    const periodDays = query.days ?? 30;
    const startedAt = process.hrtime.bigint();
    let runtime;
    let migrations = null;

    try {
      await pool.query("select 1");
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      migrations = await describeMigrations(pool);

      runtime = createRuntimeStatus(config, "ready", {
        database: {
          status: "ready",
          checkedAt: new Date().toISOString(),
          latencyMs: Number(latencyMs.toFixed(2)),
          message: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao validar conectividade com o banco.";

      operationsStore.recordReadyCheckFailure(message, {
        requestId: request.id,
        userId: request.user?.id ?? null,
        method: request.method,
        path: request.url,
        statusCode: 503,
      });

      runtime = createRuntimeStatus(config, "up", {
        database: {
          status: "error",
          checkedAt: new Date().toISOString(),
          message,
        },
      });
    }

    request.log.info(
      {
        userId: request.user?.id,
        limit: query.limit ?? 12,
        days: periodDays,
        databaseStatus: runtime.database?.status ?? "unknown",
      },
      "admin.ops.summary",
    );

    const caseManagementReport = await getCaseManagementReport(pool, periodDays);
    const backupStatus = await describeBackupStatus(config);
    const operationalEvents = await listOperationalEvents(config, query.limit ?? 12);

    return reply.send({
      ok: true,
      data: {
        runtime,
        ...operationsStore.getSnapshot(query.limit ?? 12),
        migrations,
        queueHealthConfig: await settingsRepository.getQueueHealthConfig(),
        backupStatus,
        operationalEvents,
        operationalSummary: buildOperationalSummary(backupStatus, operationalEvents),
        caseManagementReport,
      },
      error: null,
    });
  });

  app.get("/api/admin/ops/case-report.csv", { preHandler: [app.authenticate, app.authorize("admin.ops.read")] }, async (request, reply) => {
    const query = listOpsSchema.parse(request.query);
    const periodDays = query.days ?? 30;
    const report = await getCaseManagementReport(pool, periodDays);
    const generatedAt = new Date().toISOString();
    const rows: Array<Array<string | number | null>> = [
      ["secao", "campo", "valor"],
      ["resumo", "periodo_dias", report.periodDays],
      ["resumo", "gerado_em", generatedAt],
      ["resumo", "casos_criados", report.createdInPeriod],
      ["resumo", "casos_criados_janela_anterior", report.previousPeriod.createdInPeriod],
      ["resumo", "casos_criados_delta", report.deltas.createdInPeriod],
      ["resumo", "casos_encerrados", report.closedInPeriod],
      ["resumo", "casos_encerrados_janela_anterior", report.previousPeriod.closedInPeriod],
      ["resumo", "casos_encerrados_delta", report.deltas.closedInPeriod],
      ["resumo", "tramitacoes", report.tramitacoesInPeriod],
      ["resumo", "tramitacoes_janela_anterior", report.previousPeriod.tramitacoesInPeriod],
      ["resumo", "tramitacoes_delta", report.deltas.tramitacoesInPeriod],
      ["resumo", "vencidos", report.overdueTotal],
      ["resumo", "vencidos_janela_anterior", report.previousPeriod.overdueTotal],
      ["resumo", "vencidos_delta", report.deltas.overdueTotal],
      ["resumo", "vencem_em_7_dias", report.dueSoonTotal],
      ["resumo", "vencem_em_7_dias_janela_anterior", report.previousPeriod.dueSoonTotal],
      ["resumo", "vencem_em_7_dias_delta", report.deltas.dueSoonTotal],
      ["resumo", "sem_setor", report.withoutSetorTotal],
      ["resumo", "sem_setor_janela_anterior", report.previousPeriod.withoutSetorTotal],
      ["resumo", "sem_setor_delta", report.deltas.withoutSetorTotal],
      ["resumo", "sem_envolvidos", report.withoutInteressadosTotal],
      ["resumo", "sem_envolvidos_janela_anterior", report.previousPeriod.withoutInteressadosTotal],
      ["resumo", "sem_envolvidos_delta", report.deltas.withoutInteressadosTotal],
      [],
      ["setores", "sigla", "nome", "risco", "score_risco", "ativos", "ativos_janela_anterior", "ativos_delta", "vencidos", "vencem_em_7_dias", "aguardando_sei"],
      ...report.bySetor.map((item) => [
        "setores",
        item.sigla ?? "SEM_SETOR",
        item.nome ?? "Demandas sem setor definido",
        item.riskLevel,
        item.riskScore,
        item.activeTotal,
        item.previousActiveTotal,
        item.activeDelta,
        item.overdueTotal,
        item.dueSoonTotal,
        item.awaitingSeiTotal,
      ]),
    ];

    const lines = rows
      .map((row) => (row.length ? row.map((value) => escapeCsvValue(value)).join(";") : ""))
      .join("\n");

    request.log.info(
      {
        userId: request.user?.id,
        days: periodDays,
      },
      "admin.ops.export-case-report",
    );

    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="gestor-case-report-${periodDays}d.csv"`);
    return reply.send(lines);
  });

  app.get("/api/admin/ops/queue-health-config", { preHandler: [app.authenticate, app.authorize("admin.ops.read")] }, async (_request, reply) => {
    return reply.send({
      ok: true,
      data: await settingsRepository.getQueueHealthConfig(),
      error: null,
    });
  });

  app.patch("/api/admin/ops/queue-health-config", { preHandler: [app.authenticate, app.authorize("admin.ops.update")] }, async (request, reply) => {
    const payload = updateQueueHealthConfigSchema.parse(request.body);
    const configResult = await settingsRepository.updateQueueHealthConfig({
      attentionDays: payload.attentionDays,
      criticalDays: payload.criticalDays,
      updatedByUserId: request.user!.id,
    });

    request.log.info(
      {
        userId: request.user?.id,
        attentionDays: payload.attentionDays,
        criticalDays: payload.criticalDays,
      },
      "admin.ops.update-queue-health-config",
    );

    return reply.send({
      ok: true,
      data: configResult,
      error: null,
    });
  });
}
