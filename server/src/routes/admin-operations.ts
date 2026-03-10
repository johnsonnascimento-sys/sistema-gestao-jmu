import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config";
import type { DatabasePool } from "../db";
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

    const reportResult = await pool.query<{
      created_in_period: string;
      closed_in_period: string;
      tramitacoes_in_period: string;
      overdue_total: string;
      due_soon_total: string;
      without_setor_total: string;
      without_interessados_total: string;
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
          )::int as without_interessados_total
        from adminlog.pre_demanda pd
      `,
      [periodDays],
    );

    const bySetorResult = await pool.query<{
      setor_id: string | null;
      setor_sigla: string | null;
      setor_nome: string | null;
      active_total: string;
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
    );

    const reportRow = reportResult.rows[0];

    return reply.send({
      ok: true,
      data: {
        runtime,
        ...operationsStore.getSnapshot(query.limit ?? 12),
        migrations,
        queueHealthConfig: await settingsRepository.getQueueHealthConfig(),
        backupStatus: await describeBackupStatus(config),
        operationalEvents: await listOperationalEvents(config, query.limit ?? 12),
        caseManagementReport: {
          periodDays,
          createdInPeriod: Number(reportRow?.created_in_period ?? 0),
          closedInPeriod: Number(reportRow?.closed_in_period ?? 0),
          tramitacoesInPeriod: Number(reportRow?.tramitacoes_in_period ?? 0),
          overdueTotal: Number(reportRow?.overdue_total ?? 0),
          dueSoonTotal: Number(reportRow?.due_soon_total ?? 0),
          withoutSetorTotal: Number(reportRow?.without_setor_total ?? 0),
          withoutInteressadosTotal: Number(reportRow?.without_interessados_total ?? 0),
          bySetor: bySetorResult.rows.map((row) => ({
            setorId: row.setor_id ? String(row.setor_id) : null,
            sigla: row.setor_sigla ? String(row.setor_sigla) : null,
            nome: row.setor_nome ? String(row.setor_nome) : null,
            activeTotal: Number(row.active_total ?? 0),
            overdueTotal: Number(row.overdue_total ?? 0),
            dueSoonTotal: Number(row.due_soon_total ?? 0),
            awaitingSeiTotal: Number(row.awaiting_sei_total ?? 0),
          })),
        },
      },
      error: null,
    });
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
