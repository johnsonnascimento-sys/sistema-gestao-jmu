import type { PoolClient, QueryResultRow } from "pg";
import type {
  Andamento,
  AuditActor,
  DemandaInteressado,
  DemandaVinculo,
  PreDemandaAuditRecord,
  PreDemandaDashboardSummary,
  PreDemandaDetail,
  PreDemandaMetadata,
  QueueHealthLevel,
  PreDemandaSortBy,
  PreDemandaStatus,
  PreDemandaStatusAuditRecord,
  SeiAssociation,
  Setor,
  SortOrder,
  TarefaPendente,
  TimelineEvent,
} from "../domain/types";
import type { DatabasePool } from "../db";
import { getAllowedNextStatuses } from "../domain/pre-demanda-status";
import { buildQueueHealth, type QueueHealthThresholds } from "../domain/queue-health";
import { AppError } from "../errors";
import type {
  AddAndamentoInput,
  AddDemandaInteressadoInput,
  AddDemandaVinculoInput,
  AssociateSeiInput,
  AssociateSeiResult,
  ConcluirTarefaInput,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  CreateTarefaInput,
  ListPreDemandasParams,
  ListPreDemandasResult,
  PreDemandaRepository,
  RemoveDemandaInteressadoInput,
  RemoveDemandaVinculoInput,
  SettingsRepository,
  TramitarPreDemandaInput,
  UpdatePreDemandaAnotacoesInput,
  UpdatePreDemandaCaseDataInput,
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
    pd.prazo_final,
    pd.data_conclusao,
    pd.numero_judicial,
    pd.anotacoes,
    pd.metadata,
    pd.created_at,
    pd.updated_at,
    pd.created_by_user_id,
    created_by.id as created_by_id,
    created_by.email as created_by_email,
    created_by.name as created_by_name,
    created_by.role as created_by_role,
    setor.id as setor_id,
    setor.sigla as setor_sigla,
    setor.nome_completo as setor_nome_completo,
    setor.created_at as setor_created_at,
    setor.updated_at as setor_updated_at,
    pts.id as sei_link_id,
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
  left join adminlog.setores setor on setor.id = pd.setor_atual_id
`;

const SORT_COLUMN_MAP: Record<PreDemandaSortBy, string> = {
  updatedAt: "pd.updated_at",
  createdAt: "pd.created_at",
  dataReferencia: "pd.data_referencia",
  solicitante: "pd.solicitante",
  status: "pd.status",
  prazoFinal: "pd.prazo_final",
  numeroJudicial: "pd.numero_judicial",
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

function mapMetadata(raw: unknown): PreDemandaMetadata {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    frequencia: typeof value.frequencia === "string" ? value.frequencia : null,
    pagamentoEnvolvido: typeof value.pagamento_envolvido === "boolean" ? value.pagamento_envolvido : null,
    audienciaData: typeof value.audiencia_data === "string" ? value.audiencia_data : null,
    audienciaStatus: typeof value.audiencia_status === "string" ? value.audiencia_status : null,
  };
}

function mapSetor(row: QueryResultRow, prefix = "setor"): Setor | null {
  if (!row[`${prefix}_id`]) {
    return null;
  }

  return {
    id: String(row[`${prefix}_id`]),
    sigla: String(row[`${prefix}_sigla`]),
    nomeCompleto: String(row[`${prefix}_nome_completo`]),
    createdAt: new Date(row[`${prefix}_created_at`]).toISOString(),
    updatedAt: new Date(row[`${prefix}_updated_at`]).toISOString(),
  };
}

function mapAssociation(row: QueryResultRow): SeiAssociation {
  return {
    preId: String(row.pre_id),
    seiNumero: String(row.sei_numero),
    linkedAt: new Date(row.linked_at).toISOString(),
    updatedAt: new Date(row.link_updated_at ?? row.updated_at).toISOString(),
    observacoes: row.link_observacoes ? String(row.link_observacoes) : null,
    linkedBy: mapActor(row, "linked_by"),
  };
}

function mapPreDemandaBase(row: QueryResultRow, queueHealthThresholds: QueueHealthThresholds): PreDemandaDetail {
  const currentAssociation = row.sei_link_id === null || row.sei_link_id === undefined ? null : mapAssociation(row);
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
    prazoFinal: row.prazo_final ? new Date(row.prazo_final).toISOString().slice(0, 10) : null,
    dataConclusao: row.data_conclusao ? new Date(row.data_conclusao).toISOString().slice(0, 10) : null,
    numeroJudicial: row.numero_judicial ? String(row.numero_judicial) : null,
    anotacoes: row.anotacoes ? String(row.anotacoes) : null,
    setorAtual: mapSetor(row),
    metadata: mapMetadata(row.metadata),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
    queueHealth: buildQueueHealth(status, row.updated_at, row.data_referencia, queueHealthThresholds),
    allowedNextStatuses: getAllowedNextStatuses({ currentStatus: status, hasAssociation: currentAssociation !== null }),
    currentAssociation,
    interessados: [],
    vinculos: [],
    tarefasPendentes: [],
    recentAndamentos: [],
  };
}

function mapDemandaInteressado(row: QueryResultRow): DemandaInteressado {
  return {
    interessado: {
      id: String(row.interessado_id),
      nome: String(row.interessado_nome),
      matricula: row.interessado_matricula ? String(row.interessado_matricula) : null,
      cpf: row.interessado_cpf ? String(row.interessado_cpf) : null,
      dataNascimento: row.interessado_data_nascimento ? new Date(row.interessado_data_nascimento).toISOString().slice(0, 10) : null,
      createdAt: new Date(row.interessado_created_at).toISOString(),
      updatedAt: new Date(row.interessado_updated_at).toISOString(),
    },
    papel: row.papel as DemandaInteressado["papel"],
    linkedAt: new Date(row.created_at).toISOString(),
    linkedBy: mapActor(row, "linked_by"),
  };
}

function mapDemandaVinculo(row: QueryResultRow): DemandaVinculo {
  return {
    processo: {
      id: Number(row.id),
      preId: String(row.pre_id),
      assunto: String(row.assunto),
      status: row.status as PreDemandaStatus,
      dataReferencia: new Date(row.data_referencia).toISOString().slice(0, 10),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    },
    linkedAt: new Date(row.linked_at).toISOString(),
    linkedBy: mapActor(row, "linked_by"),
  };
}

function mapAndamento(row: QueryResultRow): Andamento {
  return {
    id: String(row.id),
    preId: String(row.pre_id),
    dataHora: new Date(row.data_hora).toISOString(),
    descricao: String(row.descricao),
    tipo: row.tipo as Andamento["tipo"],
    createdBy: mapActor(row, "created_by"),
  };
}

function mapTarefa(row: QueryResultRow): TarefaPendente {
  return {
    id: String(row.id),
    preId: String(row.pre_id),
    descricao: String(row.descricao),
    tipo: row.tipo as TarefaPendente["tipo"],
    concluida: Boolean(row.concluida),
    concluidaEm: row.concluida_em ? new Date(row.concluida_em).toISOString() : null,
    concluidaPor: mapActor(row, "concluida_por"),
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
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
    descricao: row.descricao ? String(row.descricao) : null,
    statusAnterior: row.status_anterior ? (row.status_anterior as PreDemandaStatus) : null,
    statusNovo: row.status_novo ? (row.status_novo as PreDemandaStatus) : null,
    seiNumeroAnterior: row.sei_numero_anterior ? String(row.sei_numero_anterior) : null,
    seiNumeroNovo: row.sei_numero_novo ? String(row.sei_numero_novo) : null,
  };
}

function normalizeBool(value: boolean | undefined) {
  return value === undefined ? undefined : value;
}

function normalizeMetadataForDb(metadata: Partial<PreDemandaMetadata> | null | undefined) {
  if (!metadata) {
    return null;
  }

  return {
    frequencia: metadata.frequencia ?? null,
    pagamento_envolvido: metadata.pagamentoEnvolvido ?? null,
    audiencia_data: metadata.audienciaData ?? null,
    audiencia_status: metadata.audienciaStatus ?? null,
  };
}

function buildWhereClause(params: ListPreDemandasParams, queueHealthThresholds: QueueHealthThresholds) {
  const values: Array<string | number | string[] | boolean> = [];
  const clauses: string[] = [];

  if (params.q) {
    values.push(`%${params.q}%`);
    const index = values.length;
    clauses.push(`(pd.pre_id ilike $${index} or pd.solicitante ilike $${index} or pd.assunto ilike $${index} or coalesce(pd.numero_judicial, '') ilike $${index})`);
  }

  if (params.statuses?.length) {
    values.push(params.statuses);
    clauses.push(`pd.status = any($${values.length}::text[])`);
  }

  if (params.queueHealthLevels?.length) {
    const normalizedLevels = params.queueHealthLevels.filter((level) => FILTERABLE_QUEUE_HEALTH_LEVELS.includes(level));
    if (normalizedLevels.length) {
      const levelClauses: string[] = [];
      for (const level of normalizedLevels) {
        if (level === "fresh") {
          values.push(queueHealthThresholds.attentionDays);
          levelClauses.push(`(pd.status <> 'encerrada' and pd.updated_at > now() - make_interval(days => $${values.length}::int))`);
          continue;
        }

        if (level === "attention") {
          values.push(queueHealthThresholds.attentionDays);
          const attentionIndex = values.length;
          values.push(queueHealthThresholds.criticalDays);
          const criticalIndex = values.length;
          levelClauses.push(
            `(pd.status <> 'encerrada' and pd.updated_at <= now() - make_interval(days => $${attentionIndex}::int) and pd.updated_at > now() - make_interval(days => $${criticalIndex}::int))`,
          );
          continue;
        }

        values.push(queueHealthThresholds.criticalDays);
        levelClauses.push(`(pd.status <> 'encerrada' and pd.updated_at <= now() - make_interval(days => $${values.length}::int))`);
      }

      clauses.push(`(${levelClauses.join(" or ")})`);
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
  return `order by ${column} ${direction} nulls last, pd.updated_at desc, pd.id desc`;
}

function ensureStatusTransition(currentStatus: PreDemandaStatus, nextStatus: PreDemandaStatus, hasAssociation: boolean, motivo: string | null | undefined) {
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

async function getPreDemandaRowByPreId(queryable: Queryable, preId: string) {
  const result = await queryable.query(
    `
      ${BASE_SELECT}
      where pd.pre_id = $1
      limit 1
    `,
    [preId],
  );

  return result.rows[0] ?? null;
}

async function getResolvedPreDemanda(queryable: Queryable, preId: string) {
  const result = await queryable.query("select id, pre_id from adminlog.pre_demanda where pre_id = $1 limit 1", [preId]);
  if (!result.rows[0]) {
    throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
  }

  return {
    id: Number(result.rows[0].id),
    preId: String(result.rows[0].pre_id),
  };
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

  private async loadInteressados(queryable: Queryable, preDemandaId: number) {
    const result = await queryable.query(
      `
        select
          di.papel,
          di.created_at,
          interessado.id as interessado_id,
          interessado.nome as interessado_nome,
          interessado.matricula as interessado_matricula,
          interessado.cpf as interessado_cpf,
          interessado.data_nascimento as interessado_data_nascimento,
          interessado.created_at as interessado_created_at,
          interessado.updated_at as interessado_updated_at,
          linked_by.id as linked_by_id,
          linked_by.email as linked_by_email,
          linked_by.name as linked_by_name,
          linked_by.role as linked_by_role
        from adminlog.demanda_interessados di
        inner join adminlog.interessados interessado on interessado.id = di.interessado_id
        left join adminlog.app_user linked_by on linked_by.id = di.created_by_user_id
        where di.pre_demanda_id = $1
        order by di.created_at desc, interessado.nome asc
      `,
      [preDemandaId],
    );

    return result.rows.map(mapDemandaInteressado);
  }

  private async loadVinculos(queryable: Queryable, preDemandaId: number) {
    const result = await queryable.query(
      `
        select
          other.id,
          other.pre_id,
          other.assunto,
          other.status,
          other.data_referencia,
          other.created_at,
          other.updated_at,
          dv.created_at as linked_at,
          linked_by.id as linked_by_id,
          linked_by.email as linked_by_email,
          linked_by.name as linked_by_name,
          linked_by.role as linked_by_role
        from adminlog.demanda_vinculos dv
        inner join adminlog.pre_demanda other
          on other.id = case
            when dv.origem_pre_demanda_id = $1 then dv.destino_pre_demanda_id
            else dv.origem_pre_demanda_id
          end
        left join adminlog.app_user linked_by on linked_by.id = dv.created_by_user_id
        where dv.origem_pre_demanda_id = $1 or dv.destino_pre_demanda_id = $1
        order by dv.created_at desc, other.pre_id asc
      `,
      [preDemandaId],
    );

    return result.rows.map(mapDemandaVinculo);
  }

  private async loadAndamentos(queryable: Queryable, preDemandaId: number, preId: string, limit?: number) {
    const result = await queryable.query(
      `
        select
          andamento.id,
          $2::text as pre_id,
          andamento.data_hora,
          andamento.descricao,
          andamento.tipo,
          created_by.id as created_by_id,
          created_by.email as created_by_email,
          created_by.name as created_by_name,
          created_by.role as created_by_role
        from adminlog.andamentos andamento
        left join adminlog.app_user created_by on created_by.id = andamento.created_by_user_id
        where andamento.pre_demanda_id = $1
        order by andamento.data_hora desc, andamento.id desc
        ${limit ? "limit $3" : ""}
      `,
      limit ? [preDemandaId, preId, limit] : [preDemandaId, preId],
    );

    return result.rows.map(mapAndamento);
  }

  private async loadTarefas(queryable: Queryable, preDemandaId: number, preId: string) {
    const result = await queryable.query(
      `
        select
          tarefa.id,
          $2::text as pre_id,
          tarefa.descricao,
          tarefa.tipo,
          tarefa.concluida,
          tarefa.concluida_em,
          tarefa.created_at,
          concluida_por.id as concluida_por_id,
          concluida_por.email as concluida_por_email,
          concluida_por.name as concluida_por_name,
          concluida_por.role as concluida_por_role,
          created_by.id as created_by_id,
          created_by.email as created_by_email,
          created_by.name as created_by_name,
          created_by.role as created_by_role
        from adminlog.tarefas_pendentes tarefa
        left join adminlog.app_user concluida_por on concluida_por.id = tarefa.concluida_por_user_id
        left join adminlog.app_user created_by on created_by.id = tarefa.created_by_user_id
        where tarefa.pre_demanda_id = $1
        order by tarefa.concluida asc, tarefa.created_at desc, tarefa.id desc
      `,
      [preDemandaId, preId],
    );

    return result.rows.map(mapTarefa);
  }

  private async hydrateDetail(queryable: Queryable, row: QueryResultRow, queueHealthThresholds: QueueHealthThresholds) {
    const detail = mapPreDemandaBase(row, queueHealthThresholds);
    const [interessados, vinculos, tarefasPendentes, recentAndamentos] = await Promise.all([
      this.loadInteressados(queryable, detail.id),
      this.loadVinculos(queryable, detail.id),
      this.loadTarefas(queryable, detail.id, detail.preId),
      this.loadAndamentos(queryable, detail.id, detail.preId, 8),
    ]);

    detail.interessados = interessados;
    detail.vinculos = vinculos;
    detail.tarefasPendentes = tarefasPendentes;
    detail.recentAndamentos = recentAndamentos;

    return detail;
  }

  private async getDetailByPreId(queryable: Queryable, preId: string, queueHealthThresholds: QueueHealthThresholds) {
    const row = await getPreDemandaRowByPreId(queryable, preId);
    return row ? this.hydrateDetail(queryable, row, queueHealthThresholds) : null;
  }

  private async insertAndamento(
    queryable: Queryable,
    input: {
      preDemandaId: number;
      preId: string;
      descricao: string;
      tipo: Andamento["tipo"];
      createdByUserId: number;
      dataHora?: string | null;
    },
  ) {
    const inserted = await queryable.query(
      `
        insert into adminlog.andamentos (pre_demanda_id, data_hora, descricao, tipo, created_by_user_id)
        values ($1, coalesce($2::timestamptz, now()), $3, $4, $5)
        returning id
      `,
      [input.preDemandaId, input.dataHora ?? null, input.descricao, input.tipo, input.createdByUserId],
    );

    const result = await queryable.query(
      `
        select
          andamento.id,
          $2::text as pre_id,
          andamento.data_hora,
          andamento.descricao,
          andamento.tipo,
          created_by.id as created_by_id,
          created_by.email as created_by_email,
          created_by.name as created_by_name,
          created_by.role as created_by_role
        from adminlog.andamentos andamento
        left join adminlog.app_user created_by on created_by.id = andamento.created_by_user_id
        where andamento.id = $1::uuid
        limit 1
      `,
      [inserted.rows[0].id, input.preId],
    );

    return mapAndamento(result.rows[0]);
  }

  async create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    const dbMetadata = normalizeMetadataForDb(input.metadata ?? null);

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
            prazo_final,
            numero_judicial,
            metadata,
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
            $7::date,
            $8,
            coalesce($9::jsonb, '{}'::jsonb),
            $10
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
          input.prazoFinal ?? null,
          input.numeroJudicial ?? null,
          dbMetadata ? JSON.stringify(dbMetadata) : null,
          input.createdByUserId,
        ],
      );

      const record = await this.getDetailByPreId(this.pool, String(result.rows[0].pre_id), queueHealthThresholds);
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

      const record = await this.hydrateDetail(this.pool, duplicate.rows[0], queueHealthThresholds);
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
      items: itemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
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
    return this.getDetailByPreId(this.pool, preId, await this.loadQueueHealthThresholds());
  }

  async updateCaseData(input: UpdatePreDemandaCaseDataInput) {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    const metadata = input.metadata === undefined ? undefined : normalizeMetadataForDb(input.metadata);
    const result = await this.pool.query(
      `
        update adminlog.pre_demanda
        set
          assunto = coalesce($2, assunto),
          descricao = case when $3::boolean then $4 else descricao end,
          fonte = case when $5::boolean then $6 else fonte end,
          observacoes = case when $7::boolean then $8 else observacoes end,
          prazo_final = case when $9::boolean then $10::date else prazo_final end,
          numero_judicial = case when $11::boolean then $12 else numero_judicial end,
          metadata = case when $13::boolean then coalesce(metadata, '{}'::jsonb) || coalesce($14::jsonb, '{}'::jsonb) else metadata end
        where pre_id = $1
        returning pre_id
      `,
      [
        input.preId,
        input.assunto ?? null,
        input.descricao !== undefined,
        input.descricao ?? null,
        input.fonte !== undefined,
        input.fonte ?? null,
        input.observacoes !== undefined,
        input.observacoes ?? null,
        input.prazoFinal !== undefined,
        input.prazoFinal ?? null,
        input.numeroJudicial !== undefined,
        input.numeroJudicial ?? null,
        input.metadata !== undefined,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );

    if (!result.rows[0]) {
      throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
    }

    const record = await this.getDetailByPreId(this.pool, input.preId, queueHealthThresholds);
    if (!record) {
      throw new AppError(500, "PRE_DEMANDA_UPDATE_FAILED", "Falha ao carregar a demanda atualizada.");
    }

    return record;
  }

  async updateAnotacoes(input: UpdatePreDemandaAnotacoesInput) {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    const result = await this.pool.query(
      `
        update adminlog.pre_demanda
        set anotacoes = $2
        where pre_id = $1
        returning pre_id
      `,
      [input.preId, input.anotacoes],
    );

    if (!result.rows[0]) {
      throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
    }

    const record = await this.getDetailByPreId(this.pool, input.preId, queueHealthThresholds);
    if (!record) {
      throw new AppError(500, "PRE_DEMANDA_UPDATE_FAILED", "Falha ao carregar a demanda atualizada.");
    }

    return record;
  }

  async addInteressado(input: AddDemandaInteressadoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const interessadoResult = await client.query("select nome from adminlog.interessados where id = $1::uuid limit 1", [input.interessadoId]);
      if (!interessadoResult.rows[0]) {
        throw new AppError(404, "INTERESSADO_NOT_FOUND", "Interessado nao encontrado.");
      }

      try {
        await client.query(
          `
            insert into adminlog.demanda_interessados (pre_demanda_id, interessado_id, papel, created_by_user_id)
            values ($1, $2::uuid, $3, $4)
          `,
          [demanda.id, input.interessadoId, input.papel, input.changedByUserId],
        );
      } catch (error) {
        const pgError = error as { code?: string };
        if (pgError.code === "23505") {
          throw new AppError(409, "DEMANDA_INTERESSADO_DUPLICATE", "O interessado ja esta vinculado a esta demanda.");
        }
        throw error;
      }

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Interessado ${String(interessadoResult.rows[0].nome)} vinculado ao processo como ${input.papel}.`,
        tipo: "interessado_added",
        createdByUserId: input.changedByUserId,
      });

      return this.loadInteressados(client, demanda.id);
    });
  }

  async removeInteressado(input: RemoveDemandaInteressadoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select interessado.nome
          from adminlog.demanda_interessados di
          inner join adminlog.interessados interessado on interessado.id = di.interessado_id
          where di.pre_demanda_id = $1 and di.interessado_id = $2::uuid
          limit 1
        `,
        [demanda.id, input.interessadoId],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "DEMANDA_INTERESSADO_NOT_FOUND", "Vinculo do interessado nao encontrado.");
      }

      await client.query("delete from adminlog.demanda_interessados where pre_demanda_id = $1 and interessado_id = $2::uuid", [demanda.id, input.interessadoId]);
      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Interessado ${String(current.rows[0].nome)} removido do processo.`,
        tipo: "interessado_removed",
        createdByUserId: input.changedByUserId,
      });

      return this.loadInteressados(client, demanda.id);
    });
  }

  async addVinculo(input: AddDemandaVinculoInput) {
    return inTransaction(this.pool, async (client) => {
      const origem = await getResolvedPreDemanda(client, input.preId);
      const destino = await getResolvedPreDemanda(client, input.destinoPreId);
      if (origem.id === destino.id) {
        throw new AppError(409, "PRE_DEMANDA_SELF_LINK", "Nao e permitido vincular o processo a ele mesmo.");
      }

      try {
        await client.query(
          `
            insert into adminlog.demanda_vinculos (origem_pre_demanda_id, destino_pre_demanda_id, created_by_user_id)
            values ($1, $2, $3)
          `,
          [origem.id, destino.id, input.changedByUserId],
        );
      } catch (error) {
        const pgError = error as { code?: string };
        if (pgError.code === "23505") {
          throw new AppError(409, "PRE_DEMANDA_LINK_DUPLICATE", "Os processos ja estao vinculados.");
        }
        throw error;
      }

      await this.insertAndamento(client, {
        preDemandaId: origem.id,
        preId: origem.preId,
        descricao: `Processo vinculado a ${destino.preId}.`,
        tipo: "vinculo_added",
        createdByUserId: input.changedByUserId,
      });

      return this.loadVinculos(client, origem.id);
    });
  }

  async removeVinculo(input: RemoveDemandaVinculoInput) {
    return inTransaction(this.pool, async (client) => {
      const origem = await getResolvedPreDemanda(client, input.preId);
      const destino = await getResolvedPreDemanda(client, input.destinoPreId);
      const removed = await client.query(
        `
          delete from adminlog.demanda_vinculos
          where (origem_pre_demanda_id = $1 and destino_pre_demanda_id = $2)
             or (origem_pre_demanda_id = $2 and destino_pre_demanda_id = $1)
          returning origem_pre_demanda_id
        `,
        [origem.id, destino.id],
      );

      if (!removed.rows[0]) {
        throw new AppError(404, "PRE_DEMANDA_LINK_NOT_FOUND", "Vinculo nao encontrado.");
      }

      await this.insertAndamento(client, {
        preDemandaId: origem.id,
        preId: origem.preId,
        descricao: `Vinculo com ${destino.preId} removido.`,
        tipo: "vinculo_removed",
        createdByUserId: input.changedByUserId,
      });

      return this.loadVinculos(client, origem.id);
    });
  }

  async tramitar(input: TramitarPreDemandaInput) {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    return inTransaction(this.pool, async (client) => {
      const row = await getPreDemandaRowByPreId(client, input.preId);
      if (!row) {
        throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
      }

      const setorResult = await client.query("select id, sigla from adminlog.setores where id = $1::uuid limit 1", [input.setorDestinoId]);
      if (!setorResult.rows[0]) {
        throw new AppError(404, "SETOR_NOT_FOUND", "Setor nao encontrado.");
      }

      await client.query("update adminlog.pre_demanda set setor_atual_id = $2::uuid where pre_id = $1", [input.preId, input.setorDestinoId]);
      const origemSigla = row.setor_sigla ? String(row.setor_sigla) : null;
      const destinoSigla = String(setorResult.rows[0].sigla);
      const descricao = origemSigla
        ? `Processo remetido de ${origemSigla} para ${destinoSigla}.`
        : `Processo remetido para ${destinoSigla}.`;

      await this.insertAndamento(client, {
        preDemandaId: Number(row.id),
        preId: input.preId,
        descricao,
        tipo: "tramitacao",
        createdByUserId: input.changedByUserId,
      });

      const record = await this.getDetailByPreId(client, input.preId, queueHealthThresholds);
      if (!record) {
        throw new AppError(500, "PRE_DEMANDA_UPDATE_FAILED", "Falha ao carregar a demanda atualizada.");
      }

      return record;
    });
  }

  async addAndamento(input: AddAndamentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      return this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: input.descricao,
        tipo: "manual",
        createdByUserId: input.changedByUserId,
        dataHora: input.dataHora ?? null,
      });
    });
  }

  async listTarefas(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    return this.loadTarefas(this.pool, demanda.id, demanda.preId);
  }

  async createTarefa(input: CreateTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const inserted = await client.query(
        `
          insert into adminlog.tarefas_pendentes (pre_demanda_id, descricao, tipo, created_by_user_id)
          values ($1, $2, $3, $4)
          returning id
        `,
        [demanda.id, input.descricao, input.tipo, input.changedByUserId],
      );

      const result = await client.query(
        `
          select
            tarefa.id,
            $2::text as pre_id,
            tarefa.descricao,
            tarefa.tipo,
            tarefa.concluida,
            tarefa.concluida_em,
            tarefa.created_at,
            concluida_por.id as concluida_por_id,
            concluida_por.email as concluida_por_email,
            concluida_por.name as concluida_por_name,
            concluida_por.role as concluida_por_role,
            created_by.id as created_by_id,
            created_by.email as created_by_email,
            created_by.name as created_by_name,
            created_by.role as created_by_role
          from adminlog.tarefas_pendentes tarefa
          left join adminlog.app_user concluida_por on concluida_por.id = tarefa.concluida_por_user_id
          left join adminlog.app_user created_by on created_by.id = tarefa.created_by_user_id
          where tarefa.id = $1::uuid
          limit 1
        `,
        [inserted.rows[0].id, demanda.preId],
      );

      return mapTarefa(result.rows[0]);
    });
  }

  async concluirTarefa(input: ConcluirTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, descricao, concluida
          from adminlog.tarefas_pendentes
          where id = $1::uuid and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.tarefaId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "TAREFA_NOT_FOUND", "Tarefa nao encontrada.");
      }

      if (current.rows[0].concluida) {
        throw new AppError(409, "TAREFA_ALREADY_DONE", "A tarefa ja foi concluida.");
      }

      await client.query(
        `
          update adminlog.tarefas_pendentes
          set concluida = true, concluida_em = now(), concluida_por_user_id = $3
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [input.tarefaId, demanda.id, input.changedByUserId],
      );

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Tarefa concluida: ${String(current.rows[0].descricao)}.`,
        tipo: "tarefa_concluida",
        createdByUserId: input.changedByUserId,
      });

      const tarefas = await this.loadTarefas(client, demanda.id, demanda.preId);
      const tarefa = tarefas.find((item) => item.id === input.tarefaId);
      if (!tarefa) {
        throw new AppError(500, "TAREFA_UPDATE_FAILED", "Falha ao carregar a tarefa atualizada.");
      }

      return tarefa;
    });
  }

  async associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    return inTransaction(this.pool, async (client) => {
      const demanda = await client.query(
        `
          select pre_id, id, status
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
          select pre_id, sei_numero, sei_numero_inicial
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
            insert into adminlog.pre_to_sei_link (pre_id, sei_numero, sei_numero_inicial, observacoes, linked_by_user_id)
            values ($1, $2, $2, $3, $4)
          `,
          [input.preId, input.seiNumero, input.observacoes ?? null, input.changedByUserId],
        );

        await this.insertAndamento(client, {
          preDemandaId: Number(demanda.rows[0].id),
          preId: input.preId,
          descricao: `Numero SEI associado: ${input.seiNumero}.`,
          tipo: "sei",
          createdByUserId: input.changedByUserId,
        });
      } else {
        const currentLink = currentLinkResult.rows[0];

        if (String(currentLink.sei_numero) !== input.seiNumero) {
          audited = true;
          await client.query(
            `
              insert into adminlog.pre_to_sei_link_audit (pre_id, sei_numero_anterior, sei_numero_novo, motivo, observacoes, changed_by_user_id)
              values ($1, $2, $3, $4, $5, $6)
            `,
            [input.preId, currentLink.sei_numero, input.seiNumero, input.motivo ?? null, input.observacoes ?? null, input.changedByUserId],
          );

          await this.insertAndamento(client, {
            preDemandaId: Number(demanda.rows[0].id),
            preId: input.preId,
            descricao: `Numero SEI alterado de ${String(currentLink.sei_numero)} para ${input.seiNumero}.`,
            tipo: "sei",
            createdByUserId: input.changedByUserId,
          });
        }

        await client.query(
          `
            update adminlog.pre_to_sei_link
            set sei_numero = $2, observacoes = $3, updated_at = now()
            where pre_id = $1
          `,
          [input.preId, input.seiNumero, input.observacoes ?? null],
        );
      }

      const currentStatus = demanda.rows[0].status as PreDemandaStatus;
      if (currentStatus !== "associada") {
        await client.query("update adminlog.pre_demanda set status = 'associada' where pre_id = $1", [input.preId]);
        await client.query(
          `
            insert into adminlog.pre_demanda_status_audit (pre_id, status_anterior, status_novo, motivo, observacoes, changed_by_user_id)
            values ($1, $2, 'associada', $3, $4, $5)
          `,
          [input.preId, currentStatus, input.motivo ?? "Associacao de numero SEI.", input.observacoes ?? null, input.changedByUserId],
        );
      }

      const record = await this.getDetailByPreId(client, input.preId, queueHealthThresholds);
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
          select pd.id, pd.status, pts.pre_id as has_link
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

      await client.query("update adminlog.pre_demanda set status = $2 where pre_id = $1", [input.preId, input.status]);
      await client.query(
        `
          insert into adminlog.pre_demanda_status_audit (pre_id, status_anterior, status_novo, motivo, observacoes, changed_by_user_id)
          values ($1, $2, $3, $4, $5, $6)
        `,
        [input.preId, currentStatus, input.status, input.motivo ?? null, input.observacoes ?? null, input.changedByUserId],
      );

      const descricao =
        input.status === "encerrada"
          ? `Processo encerrado. Motivo: ${input.motivo}.`
          : currentStatus === "encerrada"
            ? `Processo reaberto. Motivo: ${input.motivo}.`
            : `Status alterado de ${currentStatus} para ${input.status}.`;

      await this.insertAndamento(client, {
        preDemandaId: Number(currentResult.rows[0].id),
        preId: input.preId,
        descricao,
        tipo: "status",
        createdByUserId: input.changedByUserId,
      });

      const record = await this.getDetailByPreId(client, input.preId, queueHealthThresholds);
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
            concat('Demanda criada: ', pd.assunto)::text as descricao,
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
            concat('Status alterado de ', audit.status_anterior, ' para ', audit.status_novo, '.')::text as descricao,
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
            concat('Numero SEI associado: ', pts.sei_numero_inicial)::text as descricao,
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
            concat('Numero SEI alterado de ', audit.sei_numero_anterior, ' para ', audit.sei_numero_novo, '.')::text as descricao,
            null::text,
            null::text,
            audit.sei_numero_anterior::text,
            audit.sei_numero_novo::text
          from adminlog.pre_to_sei_link_audit audit
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
          where audit.pre_id = $1

          union all

          select
            concat('andamento-', andamento.id) as event_id,
            pd.pre_id,
            case
              when andamento.tipo = 'tramitacao' then 'tramitation'
              when andamento.tipo = 'tarefa_concluida' then 'task_completed'
              when andamento.tipo = 'interessado_added' then 'interessado_added'
              when andamento.tipo = 'interessado_removed' then 'interessado_removed'
              when andamento.tipo = 'vinculo_added' then 'vinculo_added'
              when andamento.tipo = 'vinculo_removed' then 'vinculo_removed'
              else 'andamento'
            end::text as event_type,
            andamento.data_hora as occurred_at,
            actor.id as actor_id,
            actor.email as actor_email,
            actor.name as actor_name,
            actor.role as actor_role,
            null::text as motivo,
            null::text as observacoes,
            andamento.descricao::text as descricao,
            null::text as status_anterior,
            null::text as status_novo,
            null::text as sei_numero_anterior,
            null::text as sei_numero_novo
          from adminlog.andamentos andamento
          inner join adminlog.pre_demanda pd on pd.id = andamento.pre_demanda_id
          left join adminlog.app_user actor on actor.id = andamento.created_by_user_id
          where pd.pre_id = $1
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
            concat('Demanda criada: ', pd.assunto)::text as descricao,
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
            concat('Status alterado de ', audit.status_anterior, ' para ', audit.status_novo, '.')::text as descricao,
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
            concat('Numero SEI associado: ', pts.sei_numero_inicial)::text as descricao,
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
            concat('Numero SEI alterado de ', audit.sei_numero_anterior, ' para ', audit.sei_numero_novo, '.')::text as descricao,
            null::text,
            null::text,
            audit.sei_numero_anterior::text,
            audit.sei_numero_novo::text
          from adminlog.pre_to_sei_link_audit audit
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id

          union all

          select
            concat('andamento-', andamento.id) as event_id,
            pd.pre_id,
            case
              when andamento.tipo = 'tramitacao' then 'tramitation'
              when andamento.tipo = 'tarefa_concluida' then 'task_completed'
              when andamento.tipo = 'interessado_added' then 'interessado_added'
              when andamento.tipo = 'interessado_removed' then 'interessado_removed'
              when andamento.tipo = 'vinculo_added' then 'vinculo_added'
              when andamento.tipo = 'vinculo_removed' then 'vinculo_removed'
              else 'andamento'
            end::text as event_type,
            andamento.data_hora as occurred_at,
            actor.id as actor_id,
            actor.email as actor_email,
            actor.name as actor_name,
            actor.role as actor_role,
            null::text as motivo,
            null::text as observacoes,
            andamento.descricao::text as descricao,
            null::text as status_anterior,
            null::text as status_novo,
            null::text as sei_numero_anterior,
            null::text as sei_numero_novo
          from adminlog.andamentos andamento
          inner join adminlog.pre_demanda pd on pd.id = andamento.pre_demanda_id
          left join adminlog.app_user actor on actor.id = andamento.created_by_user_id
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
    const [counts, lifecycleMetricsResult, staleItemsResult, awaitingSeiResult, agingMetricsResult, caseSignalsResult, dueSoonItemsResult, withoutSetorItemsResult, withoutInteressadosItemsResult, recentTimeline] = await Promise.all([
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
      this.pool.query(
        `
          select
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.prazo_final is not null
                and pd.prazo_final < current_date
            )::int as overdue_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.prazo_final is not null
                and pd.prazo_final between current_date and current_date + interval '7 days'
            )::int as due_soon_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.setor_atual_id is null
            )::int as without_setor_total,
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
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status <> 'encerrada'
            and pd.prazo_final is not null
            and pd.prazo_final between current_date and current_date + interval '7 days'
          order by pd.prazo_final asc, pd.updated_at asc, pd.id asc
          limit 5
        `,
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status <> 'encerrada'
            and pd.setor_atual_id is null
          order by pd.updated_at asc, pd.data_referencia asc, pd.id asc
          limit 5
        `,
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status <> 'encerrada'
            and not exists (
              select 1
              from adminlog.demanda_interessados di
              where di.pre_demanda_id = pd.id
            )
          order by pd.updated_at asc, pd.data_referencia asc, pd.id asc
          limit 5
        `,
      ),
      this.listRecentTimeline(8),
    ]);

    return {
      counts,
      reopenedLast30Days: Number(lifecycleMetricsResult.rows[0]?.reopened_last_30_days ?? 0),
      closedLast30Days: Number(lifecycleMetricsResult.rows[0]?.closed_last_30_days ?? 0),
      agingAttentionTotal: Number(agingMetricsResult.rows[0]?.aging_attention_total ?? 0),
      agingCriticalTotal: Number(agingMetricsResult.rows[0]?.aging_critical_total ?? 0),
      dueSoonTotal: Number(caseSignalsResult.rows[0]?.due_soon_total ?? 0),
      overdueTotal: Number(caseSignalsResult.rows[0]?.overdue_total ?? 0),
      withoutSetorTotal: Number(caseSignalsResult.rows[0]?.without_setor_total ?? 0),
      withoutInteressadosTotal: Number(caseSignalsResult.rows[0]?.without_interessados_total ?? 0),
      staleItems: staleItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      awaitingSeiItems: awaitingSeiResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      dueSoonItems: dueSoonItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      withoutSetorItems: withoutSetorItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      withoutInteressadosItems: withoutInteressadosItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      recentTimeline,
    };
  }
}
