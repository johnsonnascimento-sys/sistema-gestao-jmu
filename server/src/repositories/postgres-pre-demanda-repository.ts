import type { PoolClient, QueryResultRow } from "pg";
import type {
  AuditActor,
  PreDemandaAuditRecord,
  PreDemandaDashboardSummary,
  PreDemandaDetail,
  QueueHealthLevel,
  PreDemandaSortBy,
  PreDemandaStatus,
  PreDemandaStatusAuditRecord,
  SeiAssociation,
  SortOrder,
  TimelineEvent,
} from "../domain/types";
import type { DatabasePool } from "../db";
import { getAllowedNextStatuses } from "../domain/pre-demanda-status";
import { buildQueueHealth, type QueueHealthThresholds } from "../domain/queue-health";
import { AppError } from "../errors";
import type {
  AssociateSeiInput,
  AssociateSeiResult,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  ListPreDemandasParams,
  ListPreDemandasResult,
  PreDemandaRepository,
  SettingsRepository,
  UpdatePreDemandaStatusInput,
  UpdatePreDemandaStatusResult,
} from "./types";

type Queryable = DatabasePool | PoolClient;

const BASE_SELECT = `
  select
    pd.id,
    pd.pre_id,
    pd.solicitante,
    pd.assunto,
    pd.data_referencia,
    pd.status,
    pd.descricao,
    pd.fonte,
    pd.observacoes,
    pd.created_at,
    pd.updated_at,
    pd.created_by_user_id,
    created_by.id as created_by_id,
    created_by.email as created_by_email,
    created_by.name as created_by_name,
    created_by.role as created_by_role,
    pts.sei_numero,
    pts.sei_numero_inicial,
    pts.linked_at,
    pts.updated_at as link_updated_at,
    pts.observacoes as link_observacoes,
    pts.linked_by_user_id,
    linked_by.id as linked_by_id,
    linked_by.email as linked_by_email,
    linked_by.name as linked_by_name,
    linked_by.role as linked_by_role
  from adminlog.pre_demanda pd
  left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
  left join adminlog.app_user created_by on created_by.id = pd.created_by_user_id
  left join adminlog.app_user linked_by on linked_by.id = pts.linked_by_user_id
`;

const SORT_COLUMN_MAP: Record<PreDemandaSortBy, string> = {
  updatedAt: "pd.updated_at",
  createdAt: "pd.created_at",
  dataReferencia: "pd.data_referencia",
  solicitante: "pd.solicitante",
  status: "pd.status",
};

const ALL_STATUSES: PreDemandaStatus[] = ["aberta", "aguardando_sei", "associada", "encerrada"];
const FILTERABLE_QUEUE_HEALTH_LEVELS: QueueHealthLevel[] = ["fresh", "attention", "critical"];

function mapActor(row: QueryResultRow, prefix: string): AuditActor | null {
  if (row[`${prefix}_id`] === null || row[`${prefix}_id`] === undefined) {
    return null;
  }

  return {
    id: Number(row[`${prefix}_id`]),
    email: String(row[`${prefix}_email`]),
    name: String(row[`${prefix}_name`]),
    role: row[`${prefix}_role`] as AuditActor["role"],
  };
}

function mapAssociation(row: QueryResultRow): SeiAssociation {
  return {
    preId: String(row.pre_id),
    seiNumero: String(row.sei_numero),
    linkedAt: new Date(row.linked_at).toISOString(),
    updatedAt: new Date(row.link_updated_at ?? row.updated_at).toISOString(),
    observacoes: row.link_observacoes ? String(row.link_observacoes) : row.observacoes ? String(row.observacoes) : null,
    linkedBy: mapActor(row, "linked_by"),
  };
}

function mapPreDemanda(row: QueryResultRow, queueHealthThresholds: QueueHealthThresholds): PreDemandaDetail {
  const currentAssociation = row.sei_numero === null ? null : mapAssociation(row);
  const status = row.status as PreDemandaStatus;

  return {
    id: Number(row.id),
    preId: String(row.pre_id),
    solicitante: String(row.solicitante),
    assunto: String(row.assunto),
    dataReferencia: new Date(row.data_referencia).toISOString().slice(0, 10),
    status,
    descricao: row.descricao ? String(row.descricao) : null,
    fonte: row.fonte ? String(row.fonte) : null,
    observacoes: row.observacoes ? String(row.observacoes) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
    queueHealth: buildQueueHealth(status, row.updated_at, row.data_referencia, queueHealthThresholds),
    allowedNextStatuses: getAllowedNextStatuses({ currentStatus: status, hasAssociation: currentAssociation !== null }),
    currentAssociation,
  };
}

function mapSeiAudit(row: QueryResultRow): PreDemandaAuditRecord {
  return {
    id: Number(row.id),
    preId: String(row.pre_id),
    seiNumeroAnterior: String(row.sei_numero_anterior),
    seiNumeroNovo: String(row.sei_numero_novo),
    motivo: row.motivo ? String(row.motivo) : null,
    observacoes: row.observacoes ? String(row.observacoes) : null,
    registradoEm: new Date(row.registrado_em).toISOString(),
    changedBy: mapActor(row, "changed_by"),
  };
}

function mapStatusAudit(row: QueryResultRow): PreDemandaStatusAuditRecord {
  return {
    id: Number(row.id),
    preId: String(row.pre_id),
    statusAnterior: row.status_anterior as PreDemandaStatus,
    statusNovo: row.status_novo as PreDemandaStatus,
    motivo: row.motivo ? String(row.motivo) : null,
    observacoes: row.observacoes ? String(row.observacoes) : null,
    registradoEm: new Date(row.registrado_em).toISOString(),
    changedBy: mapActor(row, "changed_by"),
  };
}

function mapTimelineEvent(row: QueryResultRow): TimelineEvent {
  return {
    id: String(row.event_id),
    preId: String(row.pre_id),
    type: row.event_type as TimelineEvent["type"],
    occurredAt: new Date(row.occurred_at).toISOString(),
    actor: mapActor(row, "actor"),
    motivo: row.motivo ? String(row.motivo) : null,
    observacoes: row.observacoes ? String(row.observacoes) : null,
    statusAnterior: row.status_anterior ? (row.status_anterior as PreDemandaStatus) : null,
    statusNovo: row.status_novo ? (row.status_novo as PreDemandaStatus) : null,
    seiNumeroAnterior: row.sei_numero_anterior ? String(row.sei_numero_anterior) : null,
    seiNumeroNovo: row.sei_numero_novo ? String(row.sei_numero_novo) : null,
  };
}

function normalizeBool(value: boolean | undefined) {
  return value === undefined ? undefined : value;
}

function buildWhereClause(params: ListPreDemandasParams, queueHealthThresholds: QueueHealthThresholds) {
  const values: Array<string | number | string[] | boolean> = [];
  const clauses: string[] = [];

  if (params.q) {
    values.push(`%${params.q}%`);
    const index = values.length;
    clauses.push(`(pd.pre_id ilike $${index} or pd.solicitante ilike $${index} or pd.assunto ilike $${index})`);
  }

  if (params.statuses?.length) {
    values.push(params.statuses);
    clauses.push(`pd.status = any($${values.length}::text[])`);
  }

  if (params.queueHealthLevels?.length) {
    const normalizedLevels = params.queueHealthLevels.filter((level) => FILTERABLE_QUEUE_HEALTH_LEVELS.includes(level));

    if (normalizedLevels.length) {
      const freshClauses: string[] = [];

      for (const level of normalizedLevels) {
        if (level === "fresh") {
          values.push(queueHealthThresholds.attentionDays);
          freshClauses.push(`(pd.status <> 'encerrada' and pd.updated_at > now() - make_interval(days => $${values.length}::int))`);
          continue;
        }

        if (level === "attention") {
          values.push(queueHealthThresholds.attentionDays);
          const attentionIndex = values.length;
          values.push(queueHealthThresholds.criticalDays);
          const criticalIndex = values.length;
          freshClauses.push(
            `(pd.status <> 'encerrada' and pd.updated_at <= now() - make_interval(days => $${attentionIndex}::int) and pd.updated_at > now() - make_interval(days => $${criticalIndex}::int))`,
          );
          continue;
        }

        values.push(queueHealthThresholds.criticalDays);
        freshClauses.push(`(pd.status <> 'encerrada' and pd.updated_at <= now() - make_interval(days => $${values.length}::int))`);
      }

      clauses.push(`(${freshClauses.join(" or ")})`);
    }
  }

  if (params.dateFrom) {
    values.push(params.dateFrom);
    clauses.push(`pd.data_referencia >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    clauses.push(`pd.data_referencia <= $${values.length}::date`);
  }

  const hasSei = normalizeBool(params.hasSei);

  if (hasSei === true) {
    clauses.push("pts.pre_id is not null");
  }

  if (hasSei === false) {
    clauses.push("pts.pre_id is null");
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values,
  };
}

function buildOrderClause(sortBy: PreDemandaSortBy | undefined, sortOrder: SortOrder | undefined) {
  const resolvedSortBy = sortBy ?? "updatedAt";
  const resolvedSortOrder = sortOrder ?? "desc";
  const direction = resolvedSortOrder === "asc" ? "asc" : "desc";
  const column = SORT_COLUMN_MAP[resolvedSortBy];
  return `order by ${column} ${direction}, pd.updated_at desc, pd.id desc`;
}

function ensureStatusTransition(
  currentStatus: PreDemandaStatus,
  nextStatus: PreDemandaStatus,
  hasAssociation: boolean,
  motivo: string | null | undefined,
) {
  const allowedNextStatuses = getAllowedNextStatuses({ currentStatus, hasAssociation });

  if (currentStatus === nextStatus) {
    throw new AppError(409, "PRE_DEMANDA_STATUS_UNCHANGED", "A demanda ja se encontra nesse status.");
  }

  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new AppError(409, "PRE_DEMANDA_STATUS_INVALID", "A transicao de status nao e permitida para a situacao actual da demanda.");
  }

  if ((nextStatus === "encerrada" || currentStatus === "encerrada") && !motivo) {
    throw new AppError(400, "PRE_DEMANDA_STATUS_REASON_REQUIRED", "Informe o motivo para encerrar ou reabrir a demanda.");
  }
}

async function inTransaction<T>(pool: DatabasePool, callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getRecordByPreId(queryable: Queryable, preId: string, queueHealthThresholds: QueueHealthThresholds) {
  const result = await queryable.query(
    `
      ${BASE_SELECT}
      where pd.pre_id = $1
      limit 1
    `,
    [preId],
  );

  return result.rows[0] ? mapPreDemanda(result.rows[0], queueHealthThresholds) : null;
}

export class PostgresPreDemandaRepository implements PreDemandaRepository {
  constructor(
    private readonly pool: DatabasePool,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  private async loadQueueHealthThresholds() {
    const config = await this.settingsRepository.getQueueHealthConfig();
    return {
      attentionDays: config.attentionDays,
      criticalDays: config.criticalDays,
    };
  }

  async create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();

    try {
      const result = await this.pool.query(
        `
          insert into adminlog.pre_demanda (
            pre_id,
            solicitante,
            assunto,
            data_referencia,
            status,
            descricao,
            fonte,
            observacoes,
            created_by_user_id
          )
          values (
            adminlog.fn_generate_pre_id($1::date),
            $2,
            $3,
            $1::date,
            'aberta',
            $4,
            $5,
            $6,
            $7
          )
          returning pre_id
        `,
        [
          input.dataReferencia,
          input.solicitante,
          input.assunto,
          input.descricao ?? null,
          input.fonte ?? null,
          input.observacoes ?? null,
          input.createdByUserId,
        ],
      );

      const record = await getRecordByPreId(this.pool, String(result.rows[0].pre_id), queueHealthThresholds);

      if (!record) {
        throw new AppError(500, "PRE_DEMANDA_CREATE_FAILED", "Falha ao carregar a demanda criada.");
      }

      return {
        record,
        idempotent: false,
        existingPreId: null,
      };
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };

      if (pgError.code !== "23505" || pgError.constraint !== "uq_pre_demanda_idempotencia") {
        throw error;
      }

      const duplicate = await this.pool.query(
        `
          ${BASE_SELECT}
          where pd.solicitante_norm = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
            and pd.assunto_norm = lower(regexp_replace(trim($2), '\s+', ' ', 'g'))
            and pd.data_referencia = $3::date
          limit 1
        `,
        [input.solicitante, input.assunto, input.dataReferencia],
      );

      if (!duplicate.rows[0]) {
        throw new AppError(409, "PRE_DEMANDA_DUPLICATE", "Nao foi possivel recuperar a demanda existente.", {
          existingPreId: null,
        });
      }

      const record = mapPreDemanda(duplicate.rows[0], queueHealthThresholds);

      return {
        record,
        idempotent: true,
        existingPreId: record.preId,
      };
    }
  }

  async list(params: ListPreDemandasParams): Promise<ListPreDemandasResult> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    const { where, values } = buildWhereClause(params, queueHealthThresholds);
    const orderBy = buildOrderClause(params.sortBy, params.sortOrder);
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const offset = (params.page - 1) * params.pageSize;

    const [itemsResult, totalResult] = await Promise.all([
      this.pool.query(
        `
          ${BASE_SELECT}
          ${where}
          ${orderBy}
          limit $${limitIndex}
          offset $${offsetIndex}
        `,
        [...values, params.pageSize, offset],
      ),
      this.pool.query(
        `
          select count(*)::int as total
          from adminlog.pre_demanda pd
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          ${where}
        `,
        values,
      ),
    ]);

    return {
      items: itemsResult.rows.map((row) => mapPreDemanda(row, queueHealthThresholds)),
      total: Number(totalResult.rows[0]?.total ?? 0),
    };
  }

  async getStatusCounts() {
    const result = await this.pool.query(
      `
        select status, count(*)::int as total
        from adminlog.pre_demanda
        group by status
      `,
    );

    const totals = new Map(result.rows.map((row) => [row.status as PreDemandaStatus, Number(row.total)]));
    return ALL_STATUSES.map((status) => ({
      status,
      total: totals.get(status) ?? 0,
    }));
  }

  async getByPreId(preId: string) {
    return getRecordByPreId(this.pool, preId, await this.loadQueueHealthThresholds());
  }

  async associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    return inTransaction(this.pool, async (client) => {
      const demanda = await client.query(
        `
          select pre_id, status
          from adminlog.pre_demanda
          where pre_id = $1
          limit 1
          for update
        `,
        [input.preId],
      );

      if (!demanda.rows[0]) {
        throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
      }

      const currentLinkResult = await client.query(
        `
          select pre_id, sei_numero, sei_numero_inicial, linked_at, updated_at as link_updated_at, observacoes as link_observacoes
          from adminlog.pre_to_sei_link
          where pre_id = $1
          limit 1
          for update
        `,
        [input.preId],
      );

      let audited = false;

      if (!currentLinkResult.rows[0]) {
        await client.query(
          `
            insert into adminlog.pre_to_sei_link (
              pre_id,
              sei_numero,
              sei_numero_inicial,
              observacoes,
              linked_by_user_id
            )
            values ($1, $2, $2, $3, $4)
          `,
          [input.preId, input.seiNumero, input.observacoes ?? null, input.changedByUserId],
        );
      } else {
        const currentLink = currentLinkResult.rows[0];

        if (String(currentLink.sei_numero) !== input.seiNumero) {
          audited = true;

          await client.query(
            `
              insert into adminlog.pre_to_sei_link_audit (
                pre_id,
                sei_numero_anterior,
                sei_numero_novo,
                motivo,
                observacoes,
                changed_by_user_id
              )
              values ($1, $2, $3, $4, $5, $6)
            `,
            [input.preId, currentLink.sei_numero, input.seiNumero, input.motivo ?? null, input.observacoes ?? null, input.changedByUserId],
          );
        }

        await client.query(
          `
            update adminlog.pre_to_sei_link
            set
              sei_numero = $2,
              observacoes = $3,
              updated_at = now()
            where pre_id = $1
          `,
          [input.preId, input.seiNumero, input.observacoes ?? null],
        );
      }

      const statusResult = await client.query(
        `
          select status
          from adminlog.pre_demanda
          where pre_id = $1
          limit 1
        `,
        [input.preId],
      );

      const currentStatus = statusResult.rows[0]?.status as PreDemandaStatus;

      if (currentStatus !== "associada") {
        await client.query(
          `
            update adminlog.pre_demanda
            set status = 'associada'
            where pre_id = $1
          `,
          [input.preId],
        );

        await client.query(
          `
            insert into adminlog.pre_demanda_status_audit (
              pre_id,
              status_anterior,
              status_novo,
              motivo,
              observacoes,
              changed_by_user_id
            )
            values ($1, $2, 'associada', $3, $4, $5)
          `,
          [input.preId, currentStatus, input.motivo ?? "Associacao de numero SEI.", input.observacoes ?? null, input.changedByUserId],
        );
      }

      const record = await getRecordByPreId(client, input.preId, queueHealthThresholds);

      if (!record?.currentAssociation) {
        throw new AppError(500, "PRE_DEMANDA_ASSOCIATION_FAILED", "Falha ao carregar a associacao atualizada.");
      }

      return {
        association: record.currentAssociation,
        audited,
      };
    });
  }

  async updateStatus(input: UpdatePreDemandaStatusInput): Promise<UpdatePreDemandaStatusResult> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    return inTransaction(this.pool, async (client) => {
      const currentResult = await client.query(
        `
          select pd.status, pts.pre_id as has_link
          from adminlog.pre_demanda pd
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          where pd.pre_id = $1
          limit 1
          for update
        `,
        [input.preId],
      );

      if (!currentResult.rows[0]) {
        throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
      }

      const currentStatus = currentResult.rows[0].status as PreDemandaStatus;
      const hasAssociation = Boolean(currentResult.rows[0].has_link);
      ensureStatusTransition(currentStatus, input.status, hasAssociation, input.motivo);

      await client.query(
        `
          update adminlog.pre_demanda
          set status = $2
          where pre_id = $1
        `,
        [input.preId, input.status],
      );

      await client.query(
        `
          insert into adminlog.pre_demanda_status_audit (
            pre_id,
            status_anterior,
            status_novo,
            motivo,
            observacoes,
            changed_by_user_id
          )
          values ($1, $2, $3, $4, $5, $6)
        `,
        [input.preId, currentStatus, input.status, input.motivo ?? null, input.observacoes ?? null, input.changedByUserId],
      );

      const record = await getRecordByPreId(client, input.preId, queueHealthThresholds);

      if (!record) {
        throw new AppError(500, "PRE_DEMANDA_STATUS_UPDATE_FAILED", "Falha ao carregar a demanda atualizada.");
      }

      return { record };
    });
  }

  async listAudit(preId: string) {
    const result = await this.pool.query(
      `
        select
          audit.id,
          audit.pre_id,
          audit.sei_numero_anterior,
          audit.sei_numero_novo,
          audit.motivo,
          audit.observacoes,
          audit.registrado_em,
          changed_by.id as changed_by_id,
          changed_by.email as changed_by_email,
          changed_by.name as changed_by_name,
          changed_by.role as changed_by_role
        from adminlog.pre_to_sei_link_audit audit
        left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
        where audit.pre_id = $1
        order by audit.registrado_em desc
      `,
      [preId],
    );

    return result.rows.map(mapSeiAudit);
  }

  async listStatusAudit(preId: string) {
    const result = await this.pool.query(
      `
        select
          audit.id,
          audit.pre_id,
          audit.status_anterior,
          audit.status_novo,
          audit.motivo,
          audit.observacoes,
          audit.registrado_em,
          changed_by.id as changed_by_id,
          changed_by.email as changed_by_email,
          changed_by.name as changed_by_name,
          changed_by.role as changed_by_role
        from adminlog.pre_demanda_status_audit audit
        left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
        where audit.pre_id = $1
        order by audit.registrado_em desc
      `,
      [preId],
    );

    return result.rows.map(mapStatusAudit);
  }

  async listTimeline(preId: string) {
    const result = await this.pool.query(
      `
        select *
        from (
          select
            concat('created-', pd.id) as event_id,
            pd.pre_id,
            'created'::text as event_type,
            pd.created_at as occurred_at,
            created_by.id as actor_id,
            created_by.email as actor_email,
            created_by.name as actor_name,
            created_by.role as actor_role,
            null::text as motivo,
            pd.observacoes as observacoes,
            null::text as status_anterior,
            pd.status::text as status_novo,
            null::text as sei_numero_anterior,
            null::text as sei_numero_novo
          from adminlog.pre_demanda pd
          left join adminlog.app_user created_by on created_by.id = pd.created_by_user_id
          where pd.pre_id = $1

          union all

          select
            concat('status-', audit.id) as event_id,
            audit.pre_id,
            'status_changed'::text as event_type,
            audit.registrado_em as occurred_at,
            changed_by.id as actor_id,
            changed_by.email as actor_email,
            changed_by.name as actor_name,
            changed_by.role as actor_role,
            audit.motivo,
            audit.observacoes,
            audit.status_anterior::text,
            audit.status_novo::text,
            null::text,
            null::text
          from adminlog.pre_demanda_status_audit audit
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
          where audit.pre_id = $1

          union all

          select
            concat('sei-linked-', pts.id) as event_id,
            pts.pre_id,
            'sei_linked'::text as event_type,
            pts.linked_at as occurred_at,
            linked_by.id as actor_id,
            linked_by.email as actor_email,
            linked_by.name as actor_name,
            linked_by.role as actor_role,
            'Associacao inicial ao SEI.'::text as motivo,
            pts.observacoes,
            null::text,
            null::text,
            null::text,
            pts.sei_numero_inicial::text
          from adminlog.pre_to_sei_link pts
          left join adminlog.app_user linked_by on linked_by.id = pts.linked_by_user_id
          where pts.pre_id = $1

          union all

          select
            concat('sei-audit-', audit.id) as event_id,
            audit.pre_id,
            'sei_reassociated'::text as event_type,
            audit.registrado_em as occurred_at,
            changed_by.id as actor_id,
            changed_by.email as actor_email,
            changed_by.name as actor_name,
            changed_by.role as actor_role,
            audit.motivo,
            audit.observacoes,
            null::text,
            null::text,
            audit.sei_numero_anterior::text,
            audit.sei_numero_novo::text
          from adminlog.pre_to_sei_link_audit audit
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
          where audit.pre_id = $1
        ) timeline
        order by occurred_at desc, event_id desc
      `,
      [preId],
    );

    return result.rows.map(mapTimelineEvent);
  }

  async listRecentTimeline(limit = 8) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.trunc(limit))) : 8;
    const result = await this.pool.query(
      `
        select *
        from (
          select
            concat('created-', pd.id) as event_id,
            pd.pre_id,
            'created'::text as event_type,
            pd.created_at as occurred_at,
            created_by.id as actor_id,
            created_by.email as actor_email,
            created_by.name as actor_name,
            created_by.role as actor_role,
            null::text as motivo,
            pd.observacoes as observacoes,
            null::text as status_anterior,
            pd.status::text as status_novo,
            null::text as sei_numero_anterior,
            null::text as sei_numero_novo
          from adminlog.pre_demanda pd
          left join adminlog.app_user created_by on created_by.id = pd.created_by_user_id

          union all

          select
            concat('status-', audit.id) as event_id,
            audit.pre_id,
            'status_changed'::text as event_type,
            audit.registrado_em as occurred_at,
            changed_by.id as actor_id,
            changed_by.email as actor_email,
            changed_by.name as actor_name,
            changed_by.role as actor_role,
            audit.motivo,
            audit.observacoes,
            audit.status_anterior::text,
            audit.status_novo::text,
            null::text,
            null::text
          from adminlog.pre_demanda_status_audit audit
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id

          union all

          select
            concat('sei-linked-', pts.id) as event_id,
            pts.pre_id,
            'sei_linked'::text as event_type,
            pts.linked_at as occurred_at,
            linked_by.id as actor_id,
            linked_by.email as actor_email,
            linked_by.name as actor_name,
            linked_by.role as actor_role,
            'Associacao inicial ao SEI.'::text as motivo,
            pts.observacoes,
            null::text,
            null::text,
            null::text,
            pts.sei_numero_inicial::text
          from adminlog.pre_to_sei_link pts
          left join adminlog.app_user linked_by on linked_by.id = pts.linked_by_user_id

          union all

          select
            concat('sei-audit-', audit.id) as event_id,
            audit.pre_id,
            'sei_reassociated'::text as event_type,
            audit.registrado_em as occurred_at,
            changed_by.id as actor_id,
            changed_by.email as actor_email,
            changed_by.name as actor_name,
            changed_by.role as actor_role,
            audit.motivo,
            audit.observacoes,
            null::text,
            null::text,
            audit.sei_numero_anterior::text,
            audit.sei_numero_novo::text
          from adminlog.pre_to_sei_link_audit audit
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
        ) timeline
        order by occurred_at desc, event_id desc
        limit $1
      `,
      [safeLimit],
    );

    return result.rows.map(mapTimelineEvent);
  }

  async getDashboardSummary(): Promise<PreDemandaDashboardSummary> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    const [counts, lifecycleMetricsResult, staleItemsResult, awaitingSeiResult, agingMetricsResult, recentTimeline] = await Promise.all([
      this.getStatusCounts(),
      this.pool.query(
        `
          select
            count(*) filter (
              where audit.status_anterior = 'encerrada'
                and audit.status_novo in ('aberta', 'aguardando_sei', 'associada')
                and audit.registrado_em >= now() - interval '30 days'
            )::int as reopened_last_30_days,
            count(*) filter (
              where audit.status_novo = 'encerrada'
                and audit.registrado_em >= now() - interval '30 days'
            )::int as closed_last_30_days
          from adminlog.pre_demanda_status_audit audit
        `,
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status <> 'encerrada'
            and pd.updated_at <= now() - make_interval(days => $1::int)
          order by pd.updated_at asc, pd.data_referencia asc, pd.id asc
          limit 5
        `,
        [queueHealthThresholds.attentionDays],
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status = 'aguardando_sei'
          order by pd.data_referencia asc, pd.updated_at desc, pd.id desc
          limit 5
        `,
      ),
      this.pool.query(
        `
          select
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.updated_at <= now() - make_interval(days => $1::int)
                and pd.updated_at > now() - make_interval(days => $2::int)
            )::int as aging_attention_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.updated_at <= now() - make_interval(days => $2::int)
            )::int as aging_critical_total
          from adminlog.pre_demanda pd
        `,
        [queueHealthThresholds.attentionDays, queueHealthThresholds.criticalDays],
      ),
      this.listRecentTimeline(8),
    ]);

    return {
      counts,
      reopenedLast30Days: Number(lifecycleMetricsResult.rows[0]?.reopened_last_30_days ?? 0),
      closedLast30Days: Number(lifecycleMetricsResult.rows[0]?.closed_last_30_days ?? 0),
      agingAttentionTotal: Number(agingMetricsResult.rows[0]?.aging_attention_total ?? 0),
      agingCriticalTotal: Number(agingMetricsResult.rows[0]?.aging_critical_total ?? 0),
      staleItems: staleItemsResult.rows.map((row) => mapPreDemanda(row, queueHealthThresholds)),
      awaitingSeiItems: awaitingSeiResult.rows.map((row) => mapPreDemanda(row, queueHealthThresholds)),
      recentTimeline,
    };
  }
}
