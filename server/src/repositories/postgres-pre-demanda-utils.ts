import type { PoolClient, QueryResultRow } from "pg";
import type {
  Assunto,
  Andamento,
  AuditActor,
  Audiencia,
  AudienciaSituacao,
  DemandaAssunto,
  DemandaComentario,
  DemandaDocumento,
  DemandaInteressado,
  DemandaSetorFluxo,
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
  TarefaRecorrenciaTipo,
  TimelineEvent,
} from "../domain/types";
import type { DatabasePool } from "../db";
import { getAllowedNextStatuses } from "../domain/pre-demanda-status";
import { buildQueueHealth, type QueueHealthThresholds } from "../domain/queue-health";
import { AppError } from "../errors";
import type { AutoReopenInfo } from "./types";

export type Queryable = DatabasePool | PoolClient;

export const DEFAULT_INITIAL_SETOR_SIGLA = "SETAD2A2CJM";
export const ALL_STATUSES: PreDemandaStatus[] = ["em_andamento", "aguardando_sei", "encerrada"];
export const FILTERABLE_QUEUE_HEALTH_LEVELS: QueueHealthLevel[] = ["fresh", "attention", "critical"];

export const BASE_FROM = `
  from adminlog.pre_demanda pd
  left join lateral (
    select
      link.id,
      link.pre_id,
      link.sei_numero,
      link.sei_numero_inicial,
      link.linked_at,
      link.updated_at,
      link.observacoes,
      link.linked_by_user_id
    from adminlog.pre_to_sei_link link
    where link.pre_id = pd.pre_id
    order by link.updated_at desc, link.id desc
    limit 1
  ) pts on true
  left join adminlog.app_user created_by on created_by.id = pd.created_by_user_id
  left join adminlog.app_user linked_by on linked_by.id = pts.linked_by_user_id
  left join lateral (
    select min(tarefa.prazo_conclusao) as proximo_prazo_tarefa
    from adminlog.tarefas_pendentes tarefa
    where tarefa.pre_demanda_id = pd.id
      and tarefa.concluida = false
  ) prox_tarefa on true
  left join lateral (
    select
      pessoa.id as pessoa_principal_id,
      pessoa.nome as pessoa_principal_nome,
      pessoa.cargo as pessoa_principal_cargo,
      pessoa.matricula as pessoa_principal_matricula,
      pessoa.cpf as pessoa_principal_cpf,
      pessoa.data_nascimento as pessoa_principal_data_nascimento,
      pessoa.created_at as pessoa_principal_created_at,
      pessoa.updated_at as pessoa_principal_updated_at
    from adminlog.demanda_interessados di
    inner join adminlog.interessados pessoa on pessoa.id = di.interessado_id
    where di.pre_demanda_id = pd.id
    order by di.created_at desc, pessoa.nome asc
    limit 1
  ) pessoa_principal on true
  left join adminlog.setores setor on setor.id = pd.setor_atual_id
`;

export const BASE_SELECT = `
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
    pd.prazo_processo,
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
    pessoa_principal.pessoa_principal_id,
    pessoa_principal.pessoa_principal_nome,
    pessoa_principal.pessoa_principal_cargo,
    pessoa_principal.pessoa_principal_matricula,
    pessoa_principal.pessoa_principal_cpf,
    pessoa_principal.pessoa_principal_data_nascimento,
    pessoa_principal.pessoa_principal_created_at,
    pessoa_principal.pessoa_principal_updated_at,
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
    prox_tarefa.proximo_prazo_tarefa,
    case
      when pd.prazo_processo < current_date then 'atrasado'
      else 'no_prazo'
    end as prazo_status,
    linked_by.id as linked_by_id,
    linked_by.email as linked_by_email,
    linked_by.name as linked_by_name,
    linked_by.role as linked_by_role
  ${BASE_FROM}
`;

export const SORT_COLUMN_MAP: Record<PreDemandaSortBy, string> = {
  updatedAt: "pd.updated_at",
  createdAt: "pd.created_at",
  dataReferencia: "pd.data_referencia",
  solicitante: "pd.solicitante",
  status: "pd.status",
  prazoFinal: "pd.prazo_processo",
  prazoProcesso: "pd.prazo_processo",
  proximoPrazoTarefa: "prox_tarefa.proximo_prazo_tarefa",
  numeroJudicial: "pd.numero_judicial",
};

export function formatNumeroJudicialValue(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\\D/g, "");
  if (digits.length !== 20) return trimmed;

  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

export function mapActor(row: QueryResultRow, prefix: string): AuditActor | null {
  if (row[`${prefix}_id`] === null || row[`${prefix}_id`] === undefined) return null;
  return {
    id: Number(row[`${prefix}_id`]),
    email: String(row[`${prefix}_email`]),
    name: String(row[`${prefix}_name`]),
    role: row[`${prefix}_role`] as AuditActor["role"],
  };
}

export function mapMetadata(raw: unknown): PreDemandaMetadata {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    frequencia: typeof value.frequencia === "string" ? value.frequencia : null,
    frequenciaDiasSemana: Array.isArray(value.frequencia_dias_semana) ? value.frequencia_dias_semana.filter((item): item is string => typeof item === "string") : null,
    frequenciaDiaMes: typeof value.frequencia_dia_mes === "number" ? value.frequencia_dia_mes : null,
    pagamentoEnvolvido: typeof value.pagamento_envolvido === "boolean" ? value.pagamento_envolvido : null,
    urgente: typeof value.urgente === "boolean" ? value.urgente : null,
    urgenteManual: typeof value.urgente_manual === "boolean" ? value.urgente_manual : null,
    audienciaData: typeof value.audiencia_data === "string" ? value.audiencia_data : null,
    audienciaStatus: typeof value.audiencia_status === "string" ? value.audiencia_status : null,
    audienciaHorarioInicio: typeof value.audiencia_horario_inicio === "string" ? value.audiencia_horario_inicio : null,
    audienciaHorarioFim: typeof value.audiencia_horario_fim === "string" ? value.audiencia_horario_fim : null,
    audienciaSala: typeof value.audiencia_sala === "string" ? value.audiencia_sala : null,
    audienciaDescricao: typeof value.audiencia_descricao === "string" ? value.audiencia_descricao : null,
  };
}

export function mapSetor(row: QueryResultRow, prefix = "setor"): Setor | null {
  if (!row[`${prefix}_id`]) return null;
  return {
    id: String(row[`${prefix}_id`]),
    sigla: String(row[`${prefix}_sigla`]),
    nomeCompleto: String(row[`${prefix}_nome_completo`]),
    createdAt: new Date(row[`${prefix}_created_at`]).toISOString(),
    updatedAt: new Date(row[`${prefix}_updated_at`]).toISOString(),
  };
}

export function mapAssociation(row: QueryResultRow): SeiAssociation {
  return {
    preId: String(row.pre_id),
    seiNumero: String(row.sei_numero),
    principal: true,
    linkedAt: new Date(row.linked_at).toISOString(),
    updatedAt: new Date(row.link_updated_at ?? row.updated_at).toISOString(),
    observacoes: row.link_observacoes ? String(row.link_observacoes) : null,
    linkedBy: mapActor(row, "linked_by"),
  };
}

export function mapSeiAssociationRow(row: QueryResultRow, preId: string): SeiAssociation {
  return {
    preId,
    seiNumero: String(row.sei_numero),
    principal: Boolean(row.principal),
    linkedAt: new Date(row.created_at ?? row.linked_at).toISOString(),
    updatedAt: new Date(row.updated_at ?? row.created_at ?? row.linked_at).toISOString(),
    observacoes: row.observacoes ? String(row.observacoes) : null,
    linkedBy: mapActor(row, "linked_by"),
  };
}

export function mapNumeroJudicialRow(row: QueryResultRow) {
  return {
    numero: formatNumeroJudicialValue(String(row.numero_judicial)) ?? String(row.numero_judicial),
    principal: Boolean(row.principal),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapPreDemandaBase(row: QueryResultRow, queueHealthThresholds: QueueHealthThresholds): PreDemandaDetail {
  const currentAssociation = row.sei_link_id === null || row.sei_link_id === undefined ? null : mapAssociation(row);
  const status = row.status as PreDemandaStatus;
  const pessoaPrincipal =
    row.pessoa_principal_id === null || row.pessoa_principal_id === undefined
      ? null
      : {
          id: String(row.pessoa_principal_id),
          nome: String(row.pessoa_principal_nome),
          cargo: row.pessoa_principal_cargo ? String(row.pessoa_principal_cargo) : null,
          matricula: row.pessoa_principal_matricula ? String(row.pessoa_principal_matricula) : null,
          cpf: row.pessoa_principal_cpf ? String(row.pessoa_principal_cpf) : null,
          dataNascimento: row.pessoa_principal_data_nascimento ? new Date(row.pessoa_principal_data_nascimento).toISOString().slice(0, 10) : null,
          createdAt: new Date(row.pessoa_principal_created_at).toISOString(),
          updatedAt: new Date(row.pessoa_principal_updated_at).toISOString(),
        };
  const solicitante = pessoaPrincipal?.nome ?? String(row.solicitante);
  const numeroJudicial = row.numero_judicial ? formatNumeroJudicialValue(String(row.numero_judicial)) : null;

  return {
    id: Number(row.id),
    preId: String(row.pre_id),
    solicitante,
    pessoaPrincipal,
    principalNumero: currentAssociation?.seiNumero ?? String(row.pre_id),
    principalTipo: currentAssociation ? "sei" : "demanda",
    assunto: String(row.assunto),
    dataReferencia: new Date(row.data_referencia).toISOString().slice(0, 10),
    status,
    descricao: row.descricao ? String(row.descricao) : null,
    fonte: row.fonte ? String(row.fonte) : null,
    observacoes: row.observacoes ? String(row.observacoes) : null,
    prazoProcesso: new Date(row.prazo_processo).toISOString().slice(0, 10),
    proximoPrazoTarefa: row.proximo_prazo_tarefa ? new Date(row.proximo_prazo_tarefa).toISOString().slice(0, 10) : null,
    prazoStatus: row.prazo_status as PreDemandaDetail["prazoStatus"],
    dataConclusao: row.data_conclusao ? new Date(row.data_conclusao).toISOString().slice(0, 10) : null,
    numeroJudicial,
    anotacoes: row.anotacoes ? String(row.anotacoes) : null,
    setorAtual: mapSetor(row),
    metadata: mapMetadata(row.metadata),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
    queueHealth: buildQueueHealth(status, row.updated_at, row.data_referencia, queueHealthThresholds),
    allowedNextStatuses: getAllowedNextStatuses({ currentStatus: status, hasAssociation: currentAssociation !== null }),
    currentAssociation,
    assuntos: [],
    seiAssociations: currentAssociation ? [currentAssociation] : [],
    numerosJudiciais: numeroJudicial ? [{ numero: numeroJudicial, principal: true, createdAt: new Date(row.updated_at ?? row.created_at).toISOString() }] : [],
    interessados: [],
    vinculos: [],
    setoresAtivos: [],
    documentos: [],
    comentarios: [],
    tarefasPendentes: [],
    audiencias: [],
    recentAndamentos: [],
  };
}

export function mapDemandaInteressado(row: QueryResultRow): DemandaInteressado {
  return {
    interessado: {
      id: String(row.interessado_id),
      nome: String(row.interessado_nome),
      cargo: row.interessado_cargo ? String(row.interessado_cargo) : null,
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

export function mapDemandaVinculo(row: QueryResultRow): DemandaVinculo {
  return {
    processo: {
      id: Number(row.id),
      preId: String(row.pre_id),
      principalNumero: row.principal_numero ? String(row.principal_numero) : String(row.pre_id),
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

export function mapDocumento(row: QueryResultRow): DemandaDocumento {
  return {
    id: String(row.id),
    preId: String(row.pre_id),
    nomeArquivo: String(row.nome_arquivo),
    mimeType: String(row.mime_type),
    tamanhoBytes: Number(row.tamanho_bytes),
    descricao: row.descricao ? String(row.descricao) : null,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
  };
}

export function mapComentario(row: QueryResultRow): DemandaComentario {
  return {
    id: String(row.id),
    preId: String(row.pre_id),
    conteudo: String(row.conteudo),
    formato: row.formato as DemandaComentario["formato"],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
    editedBy: mapActor(row, "edited_by"),
  };
}

export function mapDemandaSetorFluxo(row: QueryResultRow): DemandaSetorFluxo {
  return {
    id: String(row.id),
    status: row.status as DemandaSetorFluxo["status"],
    observacoes: row.observacoes ? String(row.observacoes) : null,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
    concluidaEm: row.concluida_em ? new Date(row.concluida_em).toISOString() : null,
    concluidaPor: mapActor(row, "concluida_por"),
    setor: mapSetor(row, "setor")!,
    origemSetor: mapSetor(row, "origem_setor"),
  };
}

export function mapAndamento(row: QueryResultRow): Andamento {
  return {
    id: String(row.id),
    preId: String(row.pre_id),
    dataHora: new Date(row.data_hora).toISOString(),
    descricao: String(row.descricao),
    tipo: row.tipo as Andamento["tipo"],
    createdBy: mapActor(row, "created_by"),
  };
}

export function mapTarefa(row: QueryResultRow): TarefaPendente {
  return {
    id: String(row.id),
    preId: String(row.pre_id),
    ordem: Number(row.ordem),
    descricao: String(row.descricao),
    tipo: row.tipo as TarefaPendente["tipo"],
    urgente: Boolean(row.urgente),
    assuntoId: row.assunto_id ? String(row.assunto_id) : null,
    procedimentoId: row.procedimento_id ? String(row.procedimento_id) : null,
    prazoConclusao: new Date(row.prazo_conclusao).toISOString().slice(0, 10),
    horarioInicio: row.horario_inicio ? String(row.horario_inicio).slice(0, 5) : null,
    horarioFim: row.horario_fim ? String(row.horario_fim).slice(0, 5) : null,
    recorrenciaTipo: row.recorrencia_tipo ? (String(row.recorrencia_tipo) as TarefaRecorrenciaTipo) : null,
    recorrenciaDiasSemana: Array.isArray(row.recorrencia_dias_semana) ? row.recorrencia_dias_semana.filter((item): item is string => typeof item === "string") : null,
    recorrenciaDiaMes: typeof row.recorrencia_dia_mes === "number" ? row.recorrencia_dia_mes : row.recorrencia_dia_mes ? Number(row.recorrencia_dia_mes) : null,
    setorDestino: mapSetor(row, "setor_destino"),
    geradaAutomaticamente: Boolean(row.gerada_automaticamente),
    concluida: Boolean(row.concluida),
    concluidaEm: row.concluida_em ? new Date(row.concluida_em).toISOString() : null,
    concluidaPor: mapActor(row, "concluida_por"),
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
  };
}

export function mapAudiencia(row: QueryResultRow): Audiencia {
  return {
    id: String(row.id),
    preId: String(row.pre_id),
    dataHoraInicio: new Date(row.data_hora_inicio).toISOString(),
    dataHoraFim: row.data_hora_fim ? new Date(row.data_hora_fim).toISOString() : null,
    descricao: row.descricao ? String(row.descricao) : null,
    sala: row.sala ? String(row.sala) : null,
    situacao: row.situacao as AudienciaSituacao,
    observacoes: row.observacoes ? String(row.observacoes) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: mapActor(row, "created_by"),
    updatedBy: mapActor(row, "updated_by"),
  };
}

export function mapAssunto(row: QueryResultRow): Assunto {
  return {
    id: String(row.assunto_id),
    nome: String(row.assunto_nome),
    descricao: row.assunto_descricao ? String(row.assunto_descricao) : null,
    createdAt: new Date(row.assunto_created_at).toISOString(),
    updatedAt: new Date(row.assunto_updated_at).toISOString(),
    normas: [],
    procedimentos: [],
  };
}

export function mapSeiAudit(row: QueryResultRow): PreDemandaAuditRecord {
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

export function mapStatusAudit(row: QueryResultRow): PreDemandaStatusAuditRecord {
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

export function mapTimelineEvent(row: QueryResultRow): TimelineEvent {
  return {
    id: String(row.event_id),
    preId: String(row.pre_id),
    principalNumero: row.principal_numero ? String(row.principal_numero) : String(row.pre_id),
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

export function normalizeBool(value: boolean | undefined) {
  return value === undefined ? undefined : value;
}

export function normalizeSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeMetadataForDb(metadata: Partial<PreDemandaMetadata> | null | undefined) {
  if (!metadata) return null;
  return {
    frequencia: metadata.frequencia ?? null,
    frequencia_dias_semana: metadata.frequenciaDiasSemana ?? null,
    frequencia_dia_mes: metadata.frequenciaDiaMes ?? null,
    pagamento_envolvido: metadata.pagamentoEnvolvido ?? null,
    urgente: metadata.urgente ?? null,
    urgente_manual: metadata.urgenteManual ?? null,
    audiencia_data: metadata.audienciaData ?? null,
    audiencia_status: metadata.audienciaStatus ?? null,
    audiencia_horario_inicio: metadata.audienciaHorarioInicio ?? null,
    audiencia_horario_fim: metadata.audienciaHorarioFim ?? null,
    audiencia_sala: metadata.audienciaSala ?? null,
    audiencia_descricao: metadata.audienciaDescricao ?? null,
  };
}

export function buildNormalizedLikeExpression(column: string, index: number) {
  return `translate(lower(coalesce(${column}, '')), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $${index}`;
}

export function ensureStatusTransition(currentStatus: PreDemandaStatus, nextStatus: PreDemandaStatus, hasAssociation: boolean, motivo: string | null | undefined) {
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

export async function inTransaction<T>(pool: DatabasePool, callback: (client: PoolClient) => Promise<T>) {
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

export async function getPreDemandaRowByPreId(queryable: Queryable, preId: string) {
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

export async function getResolvedPreDemanda(
  queryable: Queryable,
  preId: string,
): Promise<{ id: number; preId: string; principalNumero: string; prazoProcesso: string; numeroJudicial: string | null; status: PreDemandaStatus }> {
  const result = await queryable.query(
    `
      select
        pd.id,
        pd.pre_id,
        pd.prazo_processo,
        pd.status,
        pd.numero_judicial,
        coalesce(link.sei_numero, pd.pre_id) as principal_numero
      from adminlog.pre_demanda pd
      left join lateral (
        select pts.sei_numero
        from adminlog.pre_to_sei_link pts
        where pts.pre_id = pd.pre_id
        order by pts.updated_at desc, pts.id desc
        limit 1
      ) link on true
      where pd.pre_id = $1
      limit 1
    `,
    [preId],
  );
  if (!result.rows[0]) {
    throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
  }
  return {
    id: Number(result.rows[0].id),
    preId: String(result.rows[0].pre_id),
    principalNumero: String(result.rows[0].principal_numero ?? result.rows[0].pre_id),
    prazoProcesso: new Date(result.rows[0].prazo_processo).toISOString().slice(0, 10),
    status: result.rows[0].status as PreDemandaStatus,
    numeroJudicial: result.rows[0].numero_judicial ? formatNumeroJudicialValue(String(result.rows[0].numero_judicial)) : null,
  };
}

export async function reopenProcessForRelevantMutation(
  queryable: Queryable,
  input: {
    preDemandaId: number;
    preId: string;
    currentStatus: PreDemandaStatus;
    changedByUserId: number;
    reason: string;
  },
): Promise<AutoReopenInfo | null> {
  if (input.currentStatus !== "encerrada") {
    return null;
  }

  await queryable.query(
    `
      update adminlog.pre_demanda
      set status = 'em_andamento'
      where id = $1
    `,
    [input.preDemandaId],
  );

  await queryable.query(
    `
      insert into adminlog.pre_demanda_status_audit (
        pre_id,
        status_anterior,
        status_novo,
        motivo,
        observacoes,
        changed_by_user_id
      )
      values ($1, 'encerrada', 'em_andamento', $2, null, $3)
    `,
    [input.preId, input.reason, input.changedByUserId],
  );

  await insertAndamento(queryable, {
    preDemandaId: input.preDemandaId,
    preId: input.preId,
    descricao: `Processo reaberto automaticamente. Motivo: ${input.reason}.`,
    tipo: "status",
    createdByUserId: input.changedByUserId,
  });

  return {
    previousStatus: "encerrada",
    currentStatus: "em_andamento",
    reason: input.reason,
  };
}

export async function loadTarefas(queryable: Queryable, preDemandaId: number, preId: string) {
  const result = await queryable.query(
    `
      select
        tarefa.id,
        $2::text as pre_id,
        tarefa.descricao,
        tarefa.tipo,
        tarefa.urgente,
        tarefa.ordem,
        tarefa.assunto_id,
        tarefa.procedimento_id,
        tarefa.prazo_conclusao,
        tarefa.horario_inicio,
        tarefa.horario_fim,
        tarefa.recorrencia_tipo,
        tarefa.recorrencia_dias_semana,
        tarefa.recorrencia_dia_mes,
        tarefa.gerada_automaticamente,
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
        created_by.role as created_by_role,
        setor_destino.id as setor_destino_id,
        setor_destino.sigla as setor_destino_sigla,
        setor_destino.nome_completo as setor_destino_nome_completo,
        setor_destino.created_at as setor_destino_created_at,
        setor_destino.updated_at as setor_destino_updated_at
      from adminlog.tarefas_pendentes tarefa
      left join adminlog.app_user concluida_por on concluida_por.id = tarefa.concluida_por_user_id
      left join adminlog.app_user created_by on created_by.id = tarefa.created_by_user_id
      left join adminlog.setores setor_destino on setor_destino.id = tarefa.setor_destino_id
      where tarefa.pre_demanda_id = $1
      order by tarefa.concluida asc, tarefa.ordem asc, tarefa.created_at asc, tarefa.id asc
    `,
    [preDemandaId, preId],
  );
  return result.rows.map(mapTarefa);
}

export async function loadAndamentos(queryable: Queryable, preDemandaId: number, preId: string, limit?: number) {
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

export async function loadAudiencias(queryable: Queryable, preDemandaId: number, preId: string) {
  const result = await queryable.query(
    `
      select
        audiencia.id,
        $2::text as pre_id,
        audiencia.data_hora_inicio,
        audiencia.data_hora_fim,
        audiencia.descricao,
        audiencia.sala,
        audiencia.situacao,
        audiencia.observacoes,
        audiencia.created_at,
        audiencia.updated_at,
        created_by.id as created_by_id,
        created_by.email as created_by_email,
        created_by.name as created_by_name,
        created_by.role as created_by_role,
        updated_by.id as updated_by_id,
        updated_by.email as updated_by_email,
        updated_by.name as updated_by_name,
        updated_by.role as updated_by_role
      from adminlog.demanda_audiencias_judiciais audiencia
      left join adminlog.app_user created_by on created_by.id = audiencia.created_by_user_id
      left join adminlog.app_user updated_by on updated_by.id = audiencia.updated_by_user_id
      where audiencia.pre_demanda_id = $1
      order by audiencia.data_hora_inicio asc, audiencia.created_at asc, audiencia.id asc
    `,
    [preDemandaId, preId],
  );

  return result.rows.map(mapAudiencia);
}

export async function insertAndamento(
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

export async function activateSetorFromTarefa(
  queryable: Queryable,
  input: { preDemandaId: number; preId: string; setorDestinoId: string; changedByUserId: number },
) {
  const row = await getPreDemandaRowByPreId(queryable, input.preId);
  if (!row) {
    throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
  }

  const setorResult = await queryable.query("select id, sigla from adminlog.setores where id = $1::uuid limit 1", [input.setorDestinoId]);
  if (!setorResult.rows[0]) {
    throw new AppError(404, "SETOR_NOT_FOUND", "Setor destino nao encontrado.");
  }

  const active = await queryable.query(
    `
      select id
      from adminlog.demanda_setores_fluxo
      where pre_demanda_id = $1
        and setor_id = $2::uuid
        and status = 'ativo'
      limit 1
    `,
    [input.preDemandaId, input.setorDestinoId],
  );

  if (!active.rows[0]) {
    await queryable.query(
      `
        insert into adminlog.demanda_setores_fluxo (
          pre_demanda_id,
          setor_id,
          status,
          origem_setor_id,
          observacoes,
          created_by_user_id
        )
        values ($1, $2::uuid, 'ativo', $3::uuid, $4, $5)
      `,
      [
        input.preDemandaId,
        input.setorDestinoId,
        row.setor_id ?? null,
        "Tramitacao gerada automaticamente por conclusao de procedimento.",
        input.changedByUserId,
      ],
    );
  }

  await queryable.query("update adminlog.pre_demanda set setor_atual_id = $2::uuid where pre_id = $1", [input.preId, input.setorDestinoId]);
  const origemSigla = row.setor_sigla ? String(row.setor_sigla) : null;
  const destinoSigla = String(setorResult.rows[0].sigla);
  await insertAndamento(queryable, {
    preDemandaId: input.preDemandaId,
    preId: input.preId,
    descricao: origemSigla ? `Processo remetido de ${origemSigla} para ${destinoSigla}.` : `Processo remetido para ${destinoSigla}.`,
    tipo: "tramitacao",
    createdByUserId: input.changedByUserId,
  });
}
