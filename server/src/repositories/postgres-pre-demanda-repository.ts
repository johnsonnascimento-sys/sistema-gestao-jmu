import type { PoolClient, QueryResultRow } from "pg";
import type {
  Assunto,
  Andamento,
  AuditActor,
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
import type {
  AddAndamentoInput,
  AddDemandaAssuntoInput,
  AddDemandaInteressadoInput,
  AddDemandaVinculoInput,
  AddNumeroJudicialInput,
  AssociateSeiInput,
  AssociateSeiResult,
  ConcluirTramitacaoSetorInput,
  ConcluirTarefaInput,
  CreateComentarioInput,
  CreateDocumentoInput,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  CreateTarefaInput,
  DocumentoDownloadResult,
  ListPreDemandasParams,
  ListPreDemandasResult,
  PreDemandaRepository,
  RemoveDocumentoInput,
  RemoveDemandaAssuntoInput,
  RemoveDemandaInteressadoInput,
  RemoveDemandaVinculoInput,
  RemoveAndamentoInput,
  RemoveNumeroJudicialInput,
  SettingsRepository,
  TramitarPreDemandaInput,
  UpdateComentarioInput,
  UpdateAndamentoInput,
  UpdateTarefaInput,
  UpdatePreDemandaAnotacoesInput,
  UpdatePreDemandaCaseDataInput,
  UpdatePreDemandaStatusInput,
  UpdatePreDemandaStatusResult,
  RemoveTarefaInput,
} from "./types";

type Queryable = DatabasePool | PoolClient;

const BASE_FROM = `
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
    select count(*)::int as tarefas_vencidas
    from adminlog.tarefas_pendentes tarefa
    where tarefa.pre_demanda_id = pd.id
      and tarefa.concluida = false
      and tarefa.prazo_conclusao < current_date
  ) tarefas_sinal on true
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
  left join lateral (
    select json_agg(json_build_object(
      'interessado', json_build_object(
        'id', pessoa.id,
        'nome', pessoa.nome,
        'cargo', pessoa.cargo,
        'matricula', pessoa.matricula,
        'cpf', pessoa.cpf,
        'dataNascimento', pessoa.data_nascimento,
        'createdAt', pessoa.created_at,
        'updatedAt', pessoa.updated_at
      ),
      'papel', di.papel,
      'createdAt', di.created_at
    )) as interessados_json
    from adminlog.demanda_interessados di
    inner join adminlog.interessados pessoa on pessoa.id = di.interessado_id
    where di.pre_demanda_id = pd.id
  ) all_interessados on true
  left join adminlog.setores setor on setor.id = pd.setor_atual_id
`;

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
      when tarefas_sinal.tarefas_vencidas > 0 then 'critico'
      when prox_tarefa.proximo_prazo_tarefa is null then 'normal'
      when prox_tarefa.proximo_prazo_tarefa >= pd.prazo_processo then 'critico'
      when prox_tarefa.proximo_prazo_tarefa >= pd.prazo_processo - interval '2 days' then 'atencao'
      else 'normal'
    end as sinal_prazo_processo,
    linked_by.id as linked_by_id,
    linked_by.email as linked_by_email,
    linked_by.name as linked_by_name,
    linked_by.role as linked_by_role,
    all_interessados.interessados_json
  ${BASE_FROM}
`;

const SORT_COLUMN_MAP: Record<PreDemandaSortBy, string> = {
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

const ALL_STATUSES: PreDemandaStatus[] = ["em_andamento", "aguardando_sei", "encerrada"];
const FILTERABLE_QUEUE_HEALTH_LEVELS: QueueHealthLevel[] = ["fresh", "attention", "critical"];
const DEFAULT_INITIAL_SETOR_SIGLA = "SETAD2A2CJM";

function formatNumeroJudicialValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 20) {
    return trimmed;
  }

  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

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
    frequenciaDiasSemana: Array.isArray(value.frequencia_dias_semana) ? value.frequencia_dias_semana.filter((item): item is string => typeof item === "string") : null,
    frequenciaDiaMes: typeof value.frequencia_dia_mes === "number" ? value.frequencia_dia_mes : null,
    pagamentoEnvolvido: typeof value.pagamento_envolvido === "boolean" ? value.pagamento_envolvido : null,
    urgente: typeof value.urgente === "boolean" ? value.urgente : null,
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
    principal: true,
    linkedAt: new Date(row.linked_at).toISOString(),
    updatedAt: new Date(row.link_updated_at ?? row.updated_at).toISOString(),
    observacoes: row.link_observacoes ? String(row.link_observacoes) : null,
    linkedBy: mapActor(row, "linked_by"),
  };
}

function mapSeiAssociationRow(row: QueryResultRow, preId: string): SeiAssociation {
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

function mapNumeroJudicialRow(row: QueryResultRow) {
  return {
    numero: formatNumeroJudicialValue(String(row.numero_judicial)) ?? String(row.numero_judicial),
    principal: Boolean(row.principal),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapPreDemandaBase(row: QueryResultRow, queueHealthThresholds: QueueHealthThresholds): PreDemandaDetail {
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
    sinalPrazoProcesso: row.sinal_prazo_processo as PreDemandaDetail["sinalPrazoProcesso"],
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
    numerosJudiciais: numeroJudicial
      ? [{ numero: numeroJudicial, principal: true, createdAt: new Date(row.updated_at ?? row.created_at).toISOString() }]
      : [],
    interessados: row.interessados_json ? (row.interessados_json as any[]).map((i: any) => ({
      interessado: {
        id: String(i.interessado.id),
        nome: String(i.interessado.nome),
        cargo: i.interessado.cargo ? String(i.interessado.cargo) : null,
        matricula: i.interessado.matricula ? String(i.interessado.matricula) : null,
        cpf: i.interessado.cpf ? String(i.interessado.cpf) : null,
        dataNascimento: i.interessado.dataNascimento ? (i.interessado.dataNascimento instanceof Date ? i.interessado.dataNascimento.toISOString().slice(0, 10) : new Date(i.interessado.dataNascimento).toISOString().slice(0, 10)) : null,
        createdAt: i.interessado.createdAt instanceof Date ? i.interessado.createdAt.toISOString() : new Date(i.interessado.createdAt).toISOString(),
        updatedAt: i.interessado.updatedAt instanceof Date ? i.interessado.updatedAt.toISOString() : new Date(i.interessado.updatedAt).toISOString(),
      },
      papel: String(i.papel) as any,
      linkedAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : new Date(i.createdAt).toISOString(),
      linkedBy: null,
    })) : [],
    vinculos: [],
    setoresAtivos: [],
    documentos: [],
    comentarios: [],
    tarefasPendentes: [],
    recentAndamentos: [],
  };
}

function mapDemandaInteressado(row: QueryResultRow): DemandaInteressado {
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
    papel: "interessado",
    linkedAt: new Date(row.created_at).toISOString(),
    linkedBy: mapActor(row, "linked_by"),
  };
}

function mapDemandaVinculo(row: QueryResultRow): DemandaVinculo {
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

function mapDocumento(row: QueryResultRow): DemandaDocumento {
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

function mapComentario(row: QueryResultRow): DemandaComentario {
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

function mapDemandaSetorFluxo(row: QueryResultRow): DemandaSetorFluxo {
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
    ordem: Number(row.ordem),
    descricao: String(row.descricao),
    tipo: row.tipo as TarefaPendente["tipo"],
    assuntoId: row.assunto_id ? String(row.assunto_id) : null,
    procedimentoId: row.procedimento_id ? String(row.procedimento_id) : null,
    prazoConclusao: new Date(row.prazo_conclusao).toISOString().slice(0, 10),
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

function mapAssunto(row: QueryResultRow): Assunto {
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

function normalizeBool(value: boolean | undefined) {
  return value === undefined ? undefined : value;
}

function normalizeSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeMetadataForDb(metadata: Partial<PreDemandaMetadata> | null | undefined) {
  if (!metadata) {
    return null;
  }

  return {
    frequencia: metadata.frequencia ?? null,
    frequencia_dias_semana: metadata.frequenciaDiasSemana ?? null,
    frequencia_dia_mes: metadata.frequenciaDiaMes ?? null,
    pagamento_envolvido: metadata.pagamentoEnvolvido ?? null,
    urgente: metadata.urgente ?? null,
    audiencia_data: metadata.audienciaData ?? null,
    audiencia_status: metadata.audienciaStatus ?? null,
  };
}

function buildNormalizedLikeExpression(column: string, index: number) {
  return `translate(lower(coalesce(${column}, '')), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $${index}`;
}

function buildWhereClause(params: ListPreDemandasParams, queueHealthThresholds: QueueHealthThresholds) {
  const values: Array<string | number | string[] | boolean> = [];
  const clauses: string[] = [];

  if (params.q) {
    const normalizedQuery = normalizeSearchTerm(params.q);
    const normalizedTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const numericOnly = normalizedQuery.replace(/\D/g, "");
    const qClauses: string[] = [];

    if (normalizedTokens.length) {
      const tokenClauses: string[] = [];

      for (const token of normalizedTokens) {
        values.push(`%${token}%`);
        const index = values.length;
        tokenClauses.push(`(
          ${buildNormalizedLikeExpression("pd.assunto", index)}
          or ${buildNormalizedLikeExpression("pd.solicitante", index)}
          or ${buildNormalizedLikeExpression("pessoa_principal.pessoa_principal_nome", index)}
          or ${buildNormalizedLikeExpression("pd.pre_id", index)}
          or exists (
            select 1
            from adminlog.demanda_numeros_judiciais dnj
            where dnj.pre_demanda_id = pd.id
              and ${buildNormalizedLikeExpression("dnj.numero_judicial", index)}
          )
          or exists (
            select 1
            from adminlog.pre_to_sei_link sei_busca
            where sei_busca.pre_id = pd.pre_id
              and ${buildNormalizedLikeExpression("sei_busca.sei_numero", index)}
          )
          or exists (
            select 1
            from adminlog.demanda_sei_vinculos sei_relacionado
            where sei_relacionado.pre_demanda_id = pd.id
              and ${buildNormalizedLikeExpression("sei_relacionado.sei_numero", index)}
          )
        )`);
      }

      qClauses.push(`(${tokenClauses.join(" and ")})`);
    }

    if (numericOnly.length >= 3) {
      values.push(`%${numericOnly}%`);
      const index = values.length;
      qClauses.push(`(
        regexp_replace(coalesce(pd.pre_id, ''), '\\D', '', 'g') like $${index}
        or exists (
          select 1
          from adminlog.demanda_numeros_judiciais dnj
          where dnj.pre_demanda_id = pd.id
            and regexp_replace(coalesce(dnj.numero_judicial, ''), '\\D', '', 'g') like $${index}
        )
        or exists (
          select 1
          from adminlog.pre_to_sei_link sei_busca
          where sei_busca.pre_id = pd.pre_id
            and regexp_replace(coalesce(sei_busca.sei_numero, ''), '\\D', '', 'g') like $${index}
        )
        or exists (
          select 1
          from adminlog.demanda_sei_vinculos sei_relacionado
          where sei_relacionado.pre_demanda_id = pd.id
            and regexp_replace(coalesce(sei_relacionado.sei_numero, ''), '\\D', '', 'g') like $${index}
        )
      )`);
    }

    if (qClauses.length) {
      clauses.push(`(${qClauses.join(" or ")})`);
    }
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

  if (params.processSignal) {
    if (params.processSignal === "normal") {
      clauses.push(`(
        tarefas_sinal.tarefas_vencidas = 0
        and (
          prox_tarefa.proximo_prazo_tarefa is null
          or prox_tarefa.proximo_prazo_tarefa < pd.prazo_processo - interval '2 days'
        )
      )`);
    }

    if (params.processSignal === "atencao") {
      clauses.push(`(
        tarefas_sinal.tarefas_vencidas = 0
        and prox_tarefa.proximo_prazo_tarefa >= pd.prazo_processo - interval '2 days'
        and prox_tarefa.proximo_prazo_tarefa < pd.prazo_processo
      )`);
    }

    if (params.processSignal === "critico") {
      clauses.push(`(
        tarefas_sinal.tarefas_vencidas > 0
        or prox_tarefa.proximo_prazo_tarefa >= pd.prazo_processo
      )`);
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

  if (params.setorAtualId) {
    values.push(params.setorAtualId);
    clauses.push(`pd.setor_atual_id = $${values.length}::uuid`);
  }

  if (params.withoutSetor === true) {
    clauses.push("pd.setor_atual_id is null");
  }

  if (params.withoutSetor === false) {
    clauses.push("pd.setor_atual_id is not null");
  }

  const hasInteressados = normalizeBool(params.hasInteressados);
  if (hasInteressados === true) {
    clauses.push("exists (select 1 from adminlog.demanda_interessados di where di.pre_demanda_id = pd.id)");
  }
  if (hasInteressados === false) {
    clauses.push("not exists (select 1 from adminlog.demanda_interessados di where di.pre_demanda_id = pd.id)");
  }

  if (params.dueState === "overdue") {
    clauses.push("pd.prazo_processo < current_date");
  }
  if (params.dueState === "due_today") {
    clauses.push("pd.prazo_processo = current_date");
  }
  if (params.dueState === "due_soon") {
    clauses.push("pd.prazo_processo between current_date and current_date + interval '7 days'");
  }
  if (params.dueState === "none") {
    clauses.push("false");
  }

  if (params.deadlineCampo && params.prazoRecorte) {
    const columnMap = {
      prazoProcesso: "pd.prazo_processo",
      proximoPrazoTarefa: "prox_tarefa.proximo_prazo_tarefa",
    } as const;
    const column = columnMap[params.deadlineCampo];

    clauses.push("pd.status <> 'encerrada'");

    if (params.prazoRecorte === "overdue") {
      clauses.push(`${column} is not null and ${column} < current_date`);
    }
    if (params.prazoRecorte === "today") {
      clauses.push(`${column} = current_date`);
    }
    if (params.prazoRecorte === "soon") {
      clauses.push(`${column} is not null and ${column} between current_date and current_date + interval '7 days'`);
    }
  }

  const paymentInvolved = normalizeBool(params.paymentInvolved);
  if (paymentInvolved === true) {
    clauses.push("coalesce((pd.metadata ->> 'pagamento_envolvido')::boolean, false) = true");
  }
  if (paymentInvolved === false) {
    clauses.push("coalesce((pd.metadata ->> 'pagamento_envolvido')::boolean, false) = false");
  }

  if (params.closedWithinDays) {
    values.push(params.closedWithinDays);
    clauses.push(`
      exists (
        select 1
        from adminlog.pre_demanda_status_audit audit
        where audit.pre_id = pd.pre_id
          and audit.status_novo = 'encerrada'
          and audit.registrado_em >= now() - make_interval(days => $${values.length}::int)
      )
    `);
  }

  if (params.reopenedWithinDays) {
    values.push(params.reopenedWithinDays);
    clauses.push(`
      exists (
        select 1
        from adminlog.pre_demanda_status_audit audit
        where audit.pre_id = pd.pre_id
          and audit.status_anterior = 'encerrada'
          and audit.status_novo <> 'encerrada'
          and audit.registrado_em >= now() - make_interval(days => $${values.length}::int)
      )
    `);
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
  const result = await queryable.query(
    `
      select
        id,
        pre_id,
        prazo_processo
      from adminlog.pre_demanda
      where pre_id = $1
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
    prazoProcesso: new Date(result.rows[0].prazo_processo).toISOString().slice(0, 10),
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
          interessado.cargo as interessado_cargo,
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

  private async loadAssuntos(queryable: Queryable, preDemandaId: number): Promise<DemandaAssunto[]> {
    const links = await queryable.query(
      `
        select
          da.created_at,
          assunto.id as assunto_id,
          assunto.nome as assunto_nome,
          assunto.descricao as assunto_descricao,
          assunto.created_at as assunto_created_at,
          assunto.updated_at as assunto_updated_at,
          linked_by.id as linked_by_id,
          linked_by.email as linked_by_email,
          linked_by.name as linked_by_name,
          linked_by.role as linked_by_role
        from adminlog.demanda_assuntos da
        inner join adminlog.assuntos assunto on assunto.id = da.assunto_id
        left join adminlog.app_user linked_by on linked_by.id = da.created_by_user_id
        where da.pre_demanda_id = $1
        order by da.created_at desc, assunto.nome asc
      `,
      [preDemandaId],
    );

    if (!links.rows.length) {
      return [];
    }

    const assuntoIds = links.rows.map((row) => String(row.assunto_id));
    const [normasResult, procedimentosResult] = await Promise.all([
      queryable.query(
        `
          select
            assunto_norma.assunto_id,
            norma.*
          from adminlog.assunto_normas assunto_norma
          inner join adminlog.normas norma on norma.id = assunto_norma.norma_id
          where assunto_norma.assunto_id = any($1::uuid[])
          order by norma.data_norma desc, norma.numero asc
        `,
        [assuntoIds],
      ),
      queryable.query(
        `
          select
            procedimento.*,
            setor.id as setor_id,
            setor.sigla as setor_sigla,
            setor.nome_completo as setor_nome_completo,
            setor.created_at as setor_created_at,
            setor.updated_at as setor_updated_at
          from adminlog.assunto_procedimentos procedimento
          left join adminlog.setores setor on setor.id = procedimento.setor_destino_id
          where procedimento.assunto_id = any($1::uuid[])
          order by procedimento.ordem asc, procedimento.created_at asc
        `,
        [assuntoIds],
      ),
    ]);

    const normasByAssunto = new Map<string, Assunto["normas"]>();
    for (const row of normasResult.rows) {
      const list = normasByAssunto.get(String(row.assunto_id)) ?? [];
      list.push({
        id: String(row.id),
        numero: String(row.numero),
        dataNorma: new Date(row.data_norma).toISOString().slice(0, 10),
        origem: String(row.origem),
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      });
      normasByAssunto.set(String(row.assunto_id), list);
    }

    const procedimentosByAssunto = new Map<string, Assunto["procedimentos"]>();
    for (const row of procedimentosResult.rows) {
      const list = procedimentosByAssunto.get(String(row.assunto_id)) ?? [];
      list.push({
        id: String(row.id),
        ordem: Number(row.ordem),
        descricao: String(row.descricao),
        setorDestino: mapSetor(row, "setor"),
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      });
      procedimentosByAssunto.set(String(row.assunto_id), list);
    }

    return links.rows.map((row) => {
      const assunto = mapAssunto(row);
      assunto.normas = normasByAssunto.get(assunto.id) ?? [];
      assunto.procedimentos = procedimentosByAssunto.get(assunto.id) ?? [];
      return {
        assunto,
        linkedAt: new Date(row.created_at).toISOString(),
        linkedBy: mapActor(row, "linked_by"),
      };
    });
  }

  private async loadSeiAssociations(queryable: Queryable, preDemandaId: number, preId: string) {
    const result = await queryable.query(
      `
        select
          vinculo.sei_numero,
          vinculo.principal,
          vinculo.observacoes,
          vinculo.created_at,
          vinculo.created_by_user_id as linked_by_id,
          linked_by.email as linked_by_email,
          linked_by.name as linked_by_name,
          linked_by.role as linked_by_role
        from adminlog.demanda_sei_vinculos vinculo
        left join adminlog.app_user linked_by on linked_by.id = vinculo.created_by_user_id
        where vinculo.pre_demanda_id = $1
        order by vinculo.principal desc, vinculo.created_at desc, vinculo.sei_numero asc
      `,
      [preDemandaId],
    );

    return result.rows.map((row) => mapSeiAssociationRow(row, preId));
  }

  private async loadNumerosJudiciais(queryable: Queryable, preDemandaId: number) {
    const result = await queryable.query(
      `
        select numero_judicial, principal, created_at
        from adminlog.demanda_numeros_judiciais
        where pre_demanda_id = $1
        order by principal desc, created_at desc, numero_judicial asc
      `,
      [preDemandaId],
    );

    return result.rows.map(mapNumeroJudicialRow);
  }

  private async resolveDefaultInitialSetor(queryable: Queryable) {
    const result = await queryable.query(
      `
        select id, sigla, nome_completo, created_at, updated_at
        from adminlog.setores
        where sigla = $1
        limit 1
      `,
      [DEFAULT_INITIAL_SETOR_SIGLA],
    );

    if (!result.rows[0]) {
      return null;
    }

    return {
      id: String(result.rows[0].id),
      sigla: String(result.rows[0].sigla),
      nomeCompleto: String(result.rows[0].nome_completo),
      createdAt: new Date(result.rows[0].created_at).toISOString(),
      updatedAt: new Date(result.rows[0].updated_at).toISOString(),
    };
  }

  private async loadVinculos(queryable: Queryable, preDemandaId: number) {
    const result = await queryable.query(
      `
        select
          other.id,
          other.pre_id,
          coalesce(other_link.sei_numero, other.pre_id) as principal_numero,
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
        left join adminlog.pre_to_sei_link other_link on other_link.pre_id = other.pre_id
        left join adminlog.app_user linked_by on linked_by.id = dv.created_by_user_id
        where dv.origem_pre_demanda_id = $1 or dv.destino_pre_demanda_id = $1
        order by dv.created_at desc, other.pre_id asc
      `,
      [preDemandaId],
    );

    return result.rows.map(mapDemandaVinculo);
  }

  private async loadSetoresAtivos(queryable: Queryable, preDemandaId: number) {
    const result = await queryable.query(
      `
        select
          fluxo.id,
          fluxo.status,
          fluxo.observacoes,
          fluxo.created_at,
          fluxo.concluida_em,
          created_by.id as created_by_id,
          created_by.email as created_by_email,
          created_by.name as created_by_name,
          created_by.role as created_by_role,
          concluida_por.id as concluida_por_id,
          concluida_por.email as concluida_por_email,
          concluida_por.name as concluida_por_name,
          concluida_por.role as concluida_por_role,
          setor.id as setor_id,
          setor.sigla as setor_sigla,
          setor.nome_completo as setor_nome_completo,
          setor.created_at as setor_created_at,
          setor.updated_at as setor_updated_at,
          origem.id as origem_setor_id,
          origem.sigla as origem_setor_sigla,
          origem.nome_completo as origem_setor_nome_completo,
          origem.created_at as origem_setor_created_at,
          origem.updated_at as origem_setor_updated_at
        from adminlog.demanda_setores_fluxo fluxo
        inner join adminlog.setores setor on setor.id = fluxo.setor_id
        left join adminlog.setores origem on origem.id = fluxo.origem_setor_id
        left join adminlog.app_user created_by on created_by.id = fluxo.created_by_user_id
        left join adminlog.app_user concluida_por on concluida_por.id = fluxo.concluida_por_user_id
        where fluxo.pre_demanda_id = $1
          and fluxo.status = 'ativo'
        order by fluxo.created_at desc, setor.sigla asc
      `,
      [preDemandaId],
    );

    return result.rows.map(mapDemandaSetorFluxo);
  }

  private async loadDocumentos(queryable: Queryable, preDemandaId: number, preId: string) {
    const result = await queryable.query(
      `
        select
          documento.id,
          $2::text as pre_id,
          documento.nome_arquivo,
          documento.mime_type,
          documento.tamanho_bytes,
          documento.descricao,
          documento.created_at,
          created_by.id as created_by_id,
          created_by.email as created_by_email,
          created_by.name as created_by_name,
          created_by.role as created_by_role
        from adminlog.demanda_documentos documento
        left join adminlog.app_user created_by on created_by.id = documento.created_by_user_id
        where documento.pre_demanda_id = $1
        order by documento.created_at desc, documento.nome_arquivo asc
      `,
      [preDemandaId, preId],
    );

    return result.rows.map(mapDocumento);
  }

  private async loadComentarios(queryable: Queryable, preDemandaId: number, preId: string) {
    const result = await queryable.query(
      `
        select
          comentario.id,
          $2::text as pre_id,
          comentario.conteudo,
          comentario.formato,
          comentario.created_at,
          comentario.updated_at,
          created_by.id as created_by_id,
          created_by.email as created_by_email,
          created_by.name as created_by_name,
          created_by.role as created_by_role,
          edited_by.id as edited_by_id,
          edited_by.email as edited_by_email,
          edited_by.name as edited_by_name,
          edited_by.role as edited_by_role
        from adminlog.demanda_comentarios comentario
        left join adminlog.app_user created_by on created_by.id = comentario.created_by_user_id
        left join adminlog.app_user edited_by on edited_by.id = comentario.edited_by_user_id
        where comentario.pre_demanda_id = $1
        order by comentario.created_at desc, comentario.id desc
      `,
      [preDemandaId, preId],
    );

    return result.rows.map(mapComentario);
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
          tarefa.ordem,
          tarefa.assunto_id,
          tarefa.procedimento_id,
          tarefa.prazo_conclusao,
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

  private async hydrateDetail(queryable: Queryable, row: QueryResultRow, queueHealthThresholds: QueueHealthThresholds) {
    const detail = mapPreDemandaBase(row, queueHealthThresholds);
    const [assuntos, interessados, vinculos, setoresAtivos, documentos, comentarios, tarefasPendentes, recentAndamentos, seiAssociations, numerosJudiciais] = await Promise.all([
      this.loadAssuntos(queryable, detail.id),
      this.loadInteressados(queryable, detail.id),
      this.loadVinculos(queryable, detail.id),
      this.loadSetoresAtivos(queryable, detail.id),
      this.loadDocumentos(queryable, detail.id, detail.preId),
      this.loadComentarios(queryable, detail.id, detail.preId),
      this.loadTarefas(queryable, detail.id, detail.preId),
      this.loadAndamentos(queryable, detail.id, detail.preId, 20),
      this.loadSeiAssociations(queryable, detail.id, detail.preId),
      this.loadNumerosJudiciais(queryable, detail.id),
    ]);

    detail.assuntos = assuntos;
    detail.interessados = interessados;
    detail.vinculos = vinculos;
    detail.setoresAtivos = setoresAtivos;
    detail.documentos = documentos;
    detail.comentarios = comentarios;
    detail.tarefasPendentes = tarefasPendentes;
    detail.recentAndamentos = recentAndamentos;
    detail.seiAssociations = seiAssociations;
    detail.currentAssociation = seiAssociations.find((item) => item.principal) ?? detail.currentAssociation;
    detail.numerosJudiciais = numerosJudiciais;
    detail.numeroJudicial = numerosJudiciais.find((item) => item.principal)?.numero ?? detail.numeroJudicial;
    detail.principalNumero = detail.currentAssociation?.seiNumero ?? detail.preId;
    detail.principalTipo = detail.currentAssociation ? "sei" : "demanda";
    detail.solicitante = detail.pessoaPrincipal?.nome ?? detail.interessados[0]?.interessado.nome ?? detail.solicitante;
    if (!detail.pessoaPrincipal) {
      detail.pessoaPrincipal = detail.interessados[0]?.interessado ?? null;
    }

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

  private async syncAssuntoProcedimentoTarefas(
    queryable: Queryable,
    input: { preDemandaId: number; preId: string; assuntoId: string; prazoProcesso: string; changedByUserId: number },
  ) {
    const assuntoResult = await queryable.query(
      `
        select id, nome
        from adminlog.assuntos
        where id = $1::uuid
        limit 1
      `,
      [input.assuntoId],
    );

    if (!assuntoResult.rows[0]) {
      throw new AppError(404, "ASSUNTO_NOT_FOUND", "Assunto nao encontrado.");
    }

    const procedimentos = await queryable.query(
      `
        select procedimento.id, procedimento.ordem, procedimento.descricao, procedimento.setor_destino_id
        from adminlog.assunto_procedimentos procedimento
        where procedimento.assunto_id = $1::uuid
        order by procedimento.ordem asc, procedimento.created_at asc
      `,
      [input.assuntoId],
    );

    for (const procedimento of procedimentos.rows) {
      await queryable.query(
        `
          insert into adminlog.tarefas_pendentes (
            pre_demanda_id,
            ordem,
            descricao,
            tipo,
            assunto_id,
            procedimento_id,
            prazo_conclusao,
            setor_destino_id,
            gerada_automaticamente,
            created_by_user_id
          )
          values ($1, $2, $3, 'fixa', $4::uuid, $5::uuid, $6::date, $7::uuid, true, $8)
          on conflict (pre_demanda_id, procedimento_id) where procedimento_id is not null do nothing
        `,
        [
          input.preDemandaId,
          Number(procedimento.ordem),
          `[${String(assuntoResult.rows[0].nome)}] ${Number(procedimento.ordem)}. ${String(procedimento.descricao)}`,
          input.assuntoId,
          String(procedimento.id),
          input.prazoProcesso,
          procedimento.setor_destino_id ? String(procedimento.setor_destino_id) : null,
          input.changedByUserId,
        ],
      );
    }
  }

  private async activateSetorFromTarefa(
    queryable: Queryable,
    input: { preDemandaId: number; preId: string; setorDestinoId: string; changedByUserId: number },
  ) {
    const row = await getPreDemandaRowByPreId(queryable, input.preId);
    if (!row) {
      throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
    }

    const setorResult = await queryable.query(
      "select id, sigla from adminlog.setores where id = $1::uuid limit 1",
      [input.setorDestinoId],
    );
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
    await this.insertAndamento(queryable, {
      preDemandaId: input.preDemandaId,
      preId: input.preId,
      descricao: origemSigla ? `Processo remetido de ${origemSigla} para ${destinoSigla}.` : `Processo remetido para ${destinoSigla}.`,
      tipo: "tramitacao",
      createdByUserId: input.changedByUserId,
    });
  }

  async create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult> {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    const dbMetadata = normalizeMetadataForDb(input.metadata ?? null);
    const initialStatus: PreDemandaStatus = "em_andamento";

    try {
      const record = await inTransaction(this.pool, async (client) => {
        if (!input.prazoProcesso) {
          throw new AppError(400, "PRE_DEMANDA_PRAZO_REQUIRED", "Prazo do processo e obrigatorio.");
        }

        const resolvedSolicitante = input.solicitante?.trim() || "Nao informado";
        const numeroJudicial = formatNumeroJudicialValue(input.numeroJudicial);

        const defaultSetor = await this.resolveDefaultInitialSetor(client);
        if (!defaultSetor) {
          throw new AppError(500, "DEFAULT_SETOR_NOT_FOUND", `Setor inicial ${DEFAULT_INITIAL_SETOR_SIGLA} nao encontrado.`);
        }

        const result = await client.query(
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
            prazo_processo,
            numero_judicial,
            setor_atual_id,
              metadata,
              created_by_user_id
            )
            values (
              adminlog.fn_generate_pre_id($1::date),
              $2,
              $3,
              $1::date,
              $4,
              $5,
              $6,
              $7,
              $8::date,
              $9,
              $10::uuid,
              coalesce($11::jsonb, '{}'::jsonb),
              $12
            )
            returning id, pre_id
          `,
          [
            input.dataReferencia,
            resolvedSolicitante,
            input.assunto,
            initialStatus,
            input.descricao ?? null,
            input.fonte ?? null,
            input.observacoes ?? null,
            input.prazoProcesso,
            numeroJudicial,
            defaultSetor.id,
            dbMetadata ? JSON.stringify(dbMetadata) : null,
            input.createdByUserId,
          ],
        );

        const nextPreId = String(result.rows[0].pre_id);
        const preDemandaId = Number(result.rows[0].id);

        await client.query(
          `
            insert into adminlog.demanda_setores_fluxo (
              pre_demanda_id,
              setor_id,
              origem_setor_id,
              status,
              observacoes,
              created_by_user_id
            )
            values ($1, $2::uuid, null, 'ativo', 'Setor inicial da demanda.', $3)
            on conflict do nothing
          `,
          [preDemandaId, defaultSetor.id, input.createdByUserId],
        );

        if (input.seiNumero) {
          await client.query(
            `
              insert into adminlog.pre_to_sei_link (pre_id, sei_numero, sei_numero_inicial, observacoes, linked_by_user_id)
              values ($1, $2, $2, $3, $4)
            `,
            [nextPreId, input.seiNumero, "Processo registado ja com numeracao de origem.", input.createdByUserId],
          );

          await client.query(
            `
              insert into adminlog.pre_to_sei_link_audit (pre_id, sei_numero_anterior, sei_numero_novo, motivo, observacoes, changed_by_user_id)
              values ($1, $2, $2, $3, $4, $5)
            `,
            [
              nextPreId,
              input.seiNumero,
              "Processo registado ja com numeracao de origem",
              "Associacao inicial criada na abertura do processo.",
              input.createdByUserId,
            ],
          );

          await client.query(
            `
              insert into adminlog.demanda_sei_vinculos (pre_demanda_id, sei_numero, principal, observacoes, created_by_user_id)
              values ($1, $2, true, $3, $4)
              on conflict (pre_demanda_id, sei_numero) do update
              set principal = true,
                  observacoes = excluded.observacoes
            `,
            [preDemandaId, input.seiNumero, "Processo registado ja com numeracao de origem.", input.createdByUserId],
          );
        }

        if (numeroJudicial) {
          await client.query(
            `
              insert into adminlog.demanda_numeros_judiciais (pre_demanda_id, numero_judicial, principal, created_by_user_id)
              values ($1, $2, true, $3)
              on conflict (pre_demanda_id, numero_judicial) do update
              set principal = true
            `,
          [preDemandaId, numeroJudicial, input.createdByUserId],
          );
        }

        for (const assuntoId of Array.from(new Set(input.assuntoIds ?? []))) {
          await client.query(
            `
              insert into adminlog.demanda_assuntos (pre_demanda_id, assunto_id, created_by_user_id)
              values ($1, $2::uuid, $3)
              on conflict do nothing
            `,
            [preDemandaId, assuntoId, input.createdByUserId],
          );
          await this.syncAssuntoProcedimentoTarefas(client, {
            preDemandaId,
            preId: nextPreId,
            assuntoId,
            prazoProcesso: input.prazoProcesso,
            changedByUserId: input.createdByUserId,
          });
        }

        const detailRow = await getPreDemandaRowByPreId(client, nextPreId);
        if (!detailRow) {
          throw new AppError(500, "PRE_DEMANDA_CREATE_FAILED", "Falha ao carregar a demanda criada.");
        }

        return this.hydrateDetail(client, detailRow, queueHealthThresholds);
      });

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

      const duplicateSolicitante = input.solicitante?.trim() || "Nao informado";
      const duplicate = await this.pool.query(
        `
          ${BASE_SELECT}
          where pd.solicitante_norm = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
            and pd.assunto_norm = lower(regexp_replace(trim($2), '\s+', ' ', 'g'))
            and pd.data_referencia = $3::date
          limit 1
        `,
        [duplicateSolicitante, input.assunto, input.dataReferencia],
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
          ${BASE_FROM}
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
    const numeroJudicial = input.numeroJudicial === undefined ? undefined : formatNumeroJudicialValue(input.numeroJudicial);
    return inTransaction(this.pool, async (client) => {
      const demanda = await this.getDetailByPreId(client, input.preId, queueHealthThresholds);
      if (!demanda) {
        throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
      }

      const effectivePrazoProcesso = input.prazoProcesso !== undefined ? input.prazoProcesso : demanda.prazoProcesso;
      if (!effectivePrazoProcesso) {
        throw new AppError(400, "PRE_DEMANDA_PRAZO_REQUIRED", "Prazo do processo e obrigatorio.");
      }

      if (input.prazoProcesso !== undefined) {
        const conflitoTarefas = await client.query(
          `
            select 1
            from adminlog.tarefas_pendentes
            where pre_demanda_id = $1
              and concluida = false
              and prazo_conclusao > $2::date
            limit 1
          `,
          [demanda.id, effectivePrazoProcesso],
        );

        if (conflitoTarefas.rows[0]) {
          throw new AppError(400, "PRE_DEMANDA_PRAZO_CONFLITO_TAREFAS", "Existem tarefas com prazo posterior ao prazo geral do processo.");
        }
      }

      await client.query(
        `
          update adminlog.pre_demanda
          set
            assunto = coalesce($2, assunto),
            descricao = case when $3::boolean then $4 else descricao end,
            fonte = case when $5::boolean then $6 else fonte end,
            observacoes = case when $7::boolean then $8 else observacoes end,
            prazo_processo = case when $9::boolean then $10::date else prazo_processo end,
            numero_judicial = case when $11::boolean then $12 else numero_judicial end,
            metadata = case when $13::boolean then coalesce(metadata, '{}'::jsonb) || coalesce($14::jsonb, '{}'::jsonb) else metadata end
          where pre_id = $1
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
          input.prazoProcesso !== undefined,
          input.prazoProcesso ?? null,
          numeroJudicial !== undefined,
          numeroJudicial ?? null,
          input.metadata !== undefined,
          metadata ? JSON.stringify(metadata) : null,
        ],
      );

      if (numeroJudicial !== undefined) {
        if (numeroJudicial) {
          await client.query("update adminlog.demanda_numeros_judiciais set principal = false where pre_demanda_id = $1", [demanda.id]);
          await client.query(
            `
              insert into adminlog.demanda_numeros_judiciais (pre_demanda_id, numero_judicial, principal, created_by_user_id)
              values ($1, $2, true, null)
              on conflict (pre_demanda_id, numero_judicial) do update
              set principal = true
            `,
            [demanda.id, numeroJudicial],
          );
        } else {
          await client.query("update adminlog.demanda_numeros_judiciais set principal = false where pre_demanda_id = $1", [demanda.id]);
        }
      }

      const record = await this.getDetailByPreId(client, input.preId, queueHealthThresholds);
      if (!record) {
        throw new AppError(500, "PRE_DEMANDA_UPDATE_FAILED", "Falha ao carregar a demanda atualizada.");
      }

      return record;
    });
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

  async addAssunto(input: AddDemandaAssuntoInput) {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      try {
        await client.query(
          `
            insert into adminlog.demanda_assuntos (pre_demanda_id, assunto_id, created_by_user_id)
            values ($1, $2::uuid, $3)
          `,
          [demanda.id, input.assuntoId, input.changedByUserId],
        );
      } catch (error) {
        const pgError = error as { code?: string };
        if (pgError.code === "23505") {
          throw new AppError(409, "DEMANDA_ASSUNTO_DUPLICATE", "O assunto ja esta vinculado a esta demanda.");
        }
        throw error;
      }

      await this.syncAssuntoProcedimentoTarefas(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        assuntoId: input.assuntoId,
        prazoProcesso: demanda.prazoProcesso,
        changedByUserId: input.changedByUserId,
      });

      const assunto = await this.loadAssuntos(client, demanda.id);
      const linked = assunto.find((item) => item.assunto.id === input.assuntoId);
      if (linked) {
        await this.insertAndamento(client, {
          preDemandaId: demanda.id,
          preId: demanda.preId,
          descricao: `Assunto vinculado ao processo: ${linked.assunto.nome}.`,
          tipo: "sistema",
          createdByUserId: input.changedByUserId,
        });
      }

      const record = await this.getDetailByPreId(client, input.preId, queueHealthThresholds);
      if (!record) {
        throw new AppError(500, "PRE_DEMANDA_UPDATE_FAILED", "Falha ao carregar a demanda atualizada.");
      }
      return record;
    });
  }

  async removeAssunto(input: RemoveDemandaAssuntoInput) {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await this.loadAssuntos(client, demanda.id);
      const linked = current.find((item) => item.assunto.id === input.assuntoId);
      if (!linked) {
        throw new AppError(404, "DEMANDA_ASSUNTO_NOT_FOUND", "Assunto nao vinculado a esta demanda.");
      }

      await client.query("delete from adminlog.demanda_assuntos where pre_demanda_id = $1 and assunto_id = $2::uuid", [demanda.id, input.assuntoId]);
      await client.query(
        `
          delete from adminlog.tarefas_pendentes
          where pre_demanda_id = $1
            and assunto_id = $2::uuid
            and gerada_automaticamente = true
            and concluida = false
        `,
        [demanda.id, input.assuntoId],
      );

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Assunto removido do processo: ${linked.assunto.nome}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      const record = await this.getDetailByPreId(client, input.preId, queueHealthThresholds);
      if (!record) {
        throw new AppError(500, "PRE_DEMANDA_UPDATE_FAILED", "Falha ao carregar a demanda atualizada.");
      }
      return record;
    });
  }

  async addNumeroJudicial(input: AddNumeroJudicialInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const numeroJudicial = formatNumeroJudicialValue(input.numeroJudicial);
      if (!numeroJudicial) {
        throw new AppError(400, "NUMERO_JUDICIAL_INVALID", "Numero judicial invalido.");
      }
      await client.query("update adminlog.demanda_numeros_judiciais set principal = false where pre_demanda_id = $1", [demanda.id]);
      await client.query(
        `
          insert into adminlog.demanda_numeros_judiciais (pre_demanda_id, numero_judicial, principal, created_by_user_id)
          values ($1, $2, true, $3)
          on conflict (pre_demanda_id, numero_judicial) do update
          set principal = true
        `,
        [demanda.id, numeroJudicial, input.changedByUserId],
      );
      await client.query("update adminlog.pre_demanda set numero_judicial = $2 where id = $1", [demanda.id, numeroJudicial]);
      return this.loadNumerosJudiciais(client, demanda.id);
    });
  }

  private validatePrazoConclusaoTarefa(demanda: { prazoProcesso: string }, prazoConclusao: string) {
    if (!prazoConclusao) {
      throw new AppError(400, "TAREFA_PRAZO_REQUIRED", "Toda tarefa precisa ter prazo de conclusao.");
    }

    if (new Date(`${prazoConclusao}T00:00:00`).getTime() > new Date(`${demanda.prazoProcesso}T00:00:00`).getTime()) {
      throw new AppError(400, "TAREFA_PRAZO_FORA_DO_PROCESSO", "O prazo da tarefa nao pode ser maior que o prazo do processo.");
    }
  }

  private getProximaDataRecorrente(input: {
    prazoConclusao: string;
    recorrenciaTipo: TarefaRecorrenciaTipo | null;
    recorrenciaDiasSemana: string[] | null;
    recorrenciaDiaMes: number | null;
  }) {
    if (!input.recorrenciaTipo) {
      return null;
    }

    const current = new Date(`${input.prazoConclusao}T00:00:00`);

    if (input.recorrenciaTipo === "diaria") {
      current.setDate(current.getDate() + 1);
      return current.toISOString().slice(0, 10);
    }

    if (input.recorrenciaTipo === "semanal") {
      const weekdayMap = new Map<string, number>([
        ["dom", 0],
        ["seg", 1],
        ["ter", 2],
        ["qua", 3],
        ["qui", 4],
        ["sex", 5],
        ["sab", 6],
      ]);
      const targets = (input.recorrenciaDiasSemana ?? [])
        .map((value) => weekdayMap.get(String(value).slice(0, 3).toLowerCase()))
        .filter((value): value is number => value !== undefined)
        .sort((left, right) => left - right);

      if (!targets.length) {
        current.setDate(current.getDate() + 7);
        return current.toISOString().slice(0, 10);
      }

      for (let offset = 1; offset <= 7; offset += 1) {
        const candidate = new Date(current);
        candidate.setDate(candidate.getDate() + offset);
        if (targets.includes(candidate.getDay())) {
          return candidate.toISOString().slice(0, 10);
        }
      }
    }

    if (input.recorrenciaTipo === "mensal") {
      const day = input.recorrenciaDiaMes ?? current.getDate();
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth() + 1;
      const nextMonthDate = new Date(Date.UTC(year, month, 1));
      const lastDay = new Date(Date.UTC(nextMonthDate.getUTCFullYear(), nextMonthDate.getUTCMonth() + 1, 0)).getUTCDate();
      nextMonthDate.setUTCDate(Math.min(day, lastDay));
      return nextMonthDate.toISOString().slice(0, 10);
    }

    return null;
  }

  async removeNumeroJudicial(input: RemoveNumeroJudicialInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const numeroJudicial = formatNumeroJudicialValue(input.numeroJudicial);
      if (!numeroJudicial) {
        throw new AppError(400, "NUMERO_JUDICIAL_INVALID", "Numero judicial invalido.");
      }
      await client.query(
        `
          delete from adminlog.demanda_numeros_judiciais
          where pre_demanda_id = $1
            and numero_judicial = $2
        `,
        [demanda.id, numeroJudicial],
      );

      const numeros = await this.loadNumerosJudiciais(client, demanda.id);
      const principal = numeros[0] ?? null;
      await client.query("update adminlog.demanda_numeros_judiciais set principal = false where pre_demanda_id = $1", [demanda.id]);
      if (principal) {
        await client.query(
          "update adminlog.demanda_numeros_judiciais set principal = true where pre_demanda_id = $1 and numero_judicial = $2",
          [demanda.id, principal.numero],
        );
      }
      await client.query("update adminlog.pre_demanda set numero_judicial = $2 where id = $1", [demanda.id, principal?.numero ?? null]);
      return this.loadNumerosJudiciais(client, demanda.id);
    });
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

      const requestedIds = Array.from(new Set(input.setorDestinoIds));
      if (!requestedIds.length) {
        throw new AppError(400, "SETOR_DESTINO_REQUIRED", "Informe ao menos um setor destino.");
      }

      const setoresResult = await client.query(
        "select id, sigla from adminlog.setores where id = any($1::uuid[]) order by sigla asc",
        [requestedIds],
      );
      if (setoresResult.rows.length !== requestedIds.length) {
        throw new AppError(404, "SETOR_NOT_FOUND", "Um ou mais setores nao foram encontrados.");
      }

      const existentesResult = await client.query(
        `
          select setor_id
          from adminlog.demanda_setores_fluxo
          where pre_demanda_id = $1
            and status = 'ativo'
            and setor_id = any($2::uuid[])
        `,
        [Number(row.id), requestedIds],
      );
      const existentes = new Set(existentesResult.rows.map((item) => String(item.setor_id)));
      const setoresNovos = setoresResult.rows.filter((item) => !existentes.has(String(item.id)));
      if (!setoresNovos.length) {
        throw new AppError(409, "TRAMITACAO_ALREADY_ACTIVE", "Os setores informados ja estao com tramitacao ativa para este processo.");
      }

      for (const setor of setoresNovos) {
        await client.query(
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
          [Number(row.id), String(setor.id), row.setor_id ?? null, input.observacoes ?? null, input.changedByUserId],
        );
      }

      const ultimoDestinoId = String(setoresNovos[setoresNovos.length - 1].id);
      await client.query("update adminlog.pre_demanda set setor_atual_id = $2::uuid where pre_id = $1", [input.preId, ultimoDestinoId]);
      const origemSigla = row.setor_sigla ? String(row.setor_sigla) : null;
      const destinoSiglas = setoresNovos.map((item) => String(item.sigla)).join(", ");
      const descricao = origemSigla
        ? `Processo remetido de ${origemSigla} para ${destinoSiglas}.`
        : `Processo remetido para ${destinoSiglas}.`;

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

  async concluirTramitacaoSetor(input: ConcluirTramitacaoSetorInput) {
    const queueHealthThresholds = await this.loadQueueHealthThresholds();
    return inTransaction(this.pool, async (client) => {
      const row = await getPreDemandaRowByPreId(client, input.preId);
      if (!row) {
        throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
      }

      const fluxoResult = await client.query(
        `
          select fluxo.id, setor.sigla
          from adminlog.demanda_setores_fluxo fluxo
          inner join adminlog.setores setor on setor.id = fluxo.setor_id
          where fluxo.pre_demanda_id = $1
            and fluxo.setor_id = $2::uuid
            and fluxo.status = 'ativo'
          limit 1
          for update
        `,
        [Number(row.id), input.setorId],
      );

      if (!fluxoResult.rows[0]) {
        throw new AppError(404, "TRAMITACAO_NOT_FOUND", "Tramitacao ativa nao encontrada para este setor.");
      }

      await client.query(
        `
          update adminlog.demanda_setores_fluxo
          set status = 'concluido',
              observacoes = coalesce($3, observacoes),
              concluida_em = now(),
              concluida_por_user_id = $4
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [String(fluxoResult.rows[0].id), Number(row.id), input.observacoes ?? null, input.changedByUserId],
      );

      const ativosRemanescentes = await client.query(
        `
          select setor_id
          from adminlog.demanda_setores_fluxo
          where pre_demanda_id = $1
            and status = 'ativo'
          order by created_at desc
          limit 1
        `,
        [Number(row.id)],
      );

      await client.query("update adminlog.pre_demanda set setor_atual_id = $2 where pre_id = $1", [
        input.preId,
        ativosRemanescentes.rows[0]?.setor_id ?? null,
      ]);

      await this.insertAndamento(client, {
        preDemandaId: Number(row.id),
        preId: input.preId,
        descricao: `Tramitacao concluida no setor ${String(fluxoResult.rows[0].sigla)}.`,
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

  async updateAndamento(input: UpdateAndamentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, descricao, data_hora, tipo
          from adminlog.andamentos
          where id = $1::uuid
            and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.andamentoId, demanda.id],
      );

      const row = current.rows[0];
      if (!row) {
        throw new AppError(404, "ANDAMENTO_NOT_FOUND", "Andamento nao encontrado.");
      }

      if (row.tipo !== "manual") {
        throw new AppError(409, "ANDAMENTO_NOT_EDITABLE", "Somente andamentos manuais podem ser editados.");
      }

      await client.query(
        `
          update adminlog.andamentos
          set descricao = $2,
              data_hora = coalesce($3::timestamptz, data_hora)
          where id = $1::uuid
        `,
        [input.andamentoId, input.descricao, input.dataHora ?? null],
      );

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Andamento manual atualizado. Antes: ${String(row.descricao)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      const updated = await client.query(
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
        [input.andamentoId, demanda.preId],
      );

      return mapAndamento(updated.rows[0]);
    });
  }

  async removeAndamento(input: RemoveAndamentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, descricao, tipo
          from adminlog.andamentos
          where id = $1::uuid
            and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.andamentoId, demanda.id],
      );

      const row = current.rows[0];
      if (!row) {
        throw new AppError(404, "ANDAMENTO_NOT_FOUND", "Andamento nao encontrado.");
      }

      if (row.tipo !== "manual") {
        throw new AppError(409, "ANDAMENTO_NOT_DELETABLE", "Somente andamentos manuais podem ser excluidos.");
      }

      await client.query("delete from adminlog.andamentos where id = $1::uuid", [input.andamentoId]);

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Andamento manual removido. Conteudo anterior: ${String(row.descricao)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return { removedId: input.andamentoId };
    });
  }

  async listTarefas(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    return this.loadTarefas(this.pool, demanda.id, demanda.preId);
  }

  async createTarefa(input: CreateTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      this.validatePrazoConclusaoTarefa(demanda, input.prazoConclusao);
      const orderResult = await client.query(
        `select coalesce(max(ordem), 0) as max_ordem from adminlog.tarefas_pendentes where pre_demanda_id = $1`,
        [demanda.id],
      );
      const nextOrdem = Number(orderResult.rows[0]?.max_ordem ?? 0) + 1;
      const inserted = await client.query(
        `
          insert into adminlog.tarefas_pendentes (
            pre_demanda_id,
            ordem,
            descricao,
            tipo,
            assunto_id,
            procedimento_id,
            prazo_conclusao,
            recorrencia_tipo,
            recorrencia_dias_semana,
            recorrencia_dia_mes,
            setor_destino_id,
            gerada_automaticamente,
            created_by_user_id
          )
          values ($1, $2, $3, $4, $5::uuid, $6::uuid, $7::date, $8, $9::jsonb, $10::int, $11::uuid, $12, $13)
          returning id
        `,
        [
          demanda.id,
          nextOrdem,
          input.descricao,
          input.tipo,
          input.assuntoId ?? null,
          input.procedimentoId ?? null,
          input.prazoConclusao,
          input.recorrenciaTipo ?? null,
          input.recorrenciaDiasSemana ? JSON.stringify(input.recorrenciaDiasSemana) : null,
          input.recorrenciaDiaMes ?? null,
          input.setorDestinoId ?? null,
          input.geradaAutomaticamente ?? false,
          input.changedByUserId,
        ],
      );

      const tarefas = await this.loadTarefas(client, demanda.id, demanda.preId);
      const tarefa = tarefas.find((item) => item.id === String(inserted.rows[0].id));
      if (!tarefa) {
        throw new AppError(500, "TAREFA_CREATE_FAILED", "Falha ao carregar a tarefa criada.");
      }

      return tarefa;
    });
  }

  async updateTarefa(input: UpdateTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, concluida, descricao, tipo
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
        throw new AppError(409, "TAREFA_NOT_EDITABLE", "Tarefas concluidas nao podem ser alteradas.");
      }

      this.validatePrazoConclusaoTarefa(demanda, input.prazoConclusao);

      await client.query(
        `
          update adminlog.tarefas_pendentes
          set descricao = $3, tipo = $4, prazo_conclusao = $5::date, recorrencia_tipo = $6, recorrencia_dias_semana = $7::jsonb, recorrencia_dia_mes = $8::int
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [
          input.tarefaId,
          demanda.id,
          input.descricao,
          input.tipo,
          input.prazoConclusao,
          input.recorrenciaTipo ?? null,
          input.recorrenciaDiasSemana ? JSON.stringify(input.recorrenciaDiasSemana) : null,
          input.recorrenciaDiaMes ?? null,
        ],
      );

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Tarefa atualizada: ${input.descricao}.`,
        tipo: "sistema",
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

  async reorderTarefas(input: { preId: string; tarefaIds: string[]; changedByUserId: number }) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id
          from adminlog.tarefas_pendentes
          where pre_demanda_id = $1 and concluida = false
          order by ordem asc, created_at asc, id asc
          for update
        `,
        [demanda.id],
      );

      const currentIds = current.rows.map((row) => String(row.id));
      const requestedIds = input.tarefaIds;

      if (currentIds.length !== requestedIds.length || currentIds.some((id) => !requestedIds.includes(id))) {
        throw new AppError(400, "TAREFA_REORDER_INVALID", "A ordenacao informada nao corresponde as tarefas pendentes da demanda.");
      }

      for (let index = 0; index < requestedIds.length; index += 1) {
        await client.query(
          `update adminlog.tarefas_pendentes set ordem = $3 where id = $1::uuid and pre_demanda_id = $2`,
          [requestedIds[index], demanda.id, index + 1],
        );
      }

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: "Checklist reorganizada manualmente.",
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return this.loadTarefas(client, demanda.id, demanda.preId);
    });
  }

  async removeTarefa(input: RemoveTarefaInput) {
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
        throw new AppError(409, "TAREFA_NOT_DELETABLE", "Tarefas concluidas nao podem ser excluidas.");
      }

      await client.query(
        `
          delete from adminlog.tarefas_pendentes
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [input.tarefaId, demanda.id],
      );

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Tarefa removida: ${String(current.rows[0].descricao)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return { removedId: input.tarefaId };
    });
  }

  async concluirTarefa(input: ConcluirTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, descricao, concluida, tipo, ordem, assunto_id, procedimento_id
               , setor_destino_id
               , prazo_conclusao, recorrencia_tipo, recorrencia_dias_semana, recorrencia_dia_mes, gerada_automaticamente
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

      const proximaDataRecorrente = this.getProximaDataRecorrente({
        prazoConclusao: new Date(current.rows[0].prazo_conclusao).toISOString().slice(0, 10),
        recorrenciaTipo: current.rows[0].recorrencia_tipo ? (String(current.rows[0].recorrencia_tipo) as TarefaRecorrenciaTipo) : null,
        recorrenciaDiasSemana: Array.isArray(current.rows[0].recorrencia_dias_semana)
          ? current.rows[0].recorrencia_dias_semana.filter((item: unknown): item is string => typeof item === "string")
          : null,
        recorrenciaDiaMes: typeof current.rows[0].recorrencia_dia_mes === "number"
          ? current.rows[0].recorrencia_dia_mes
          : current.rows[0].recorrencia_dia_mes
            ? Number(current.rows[0].recorrencia_dia_mes)
            : null,
      });

      if (proximaDataRecorrente && new Date(`${proximaDataRecorrente}T00:00:00`).getTime() <= new Date(`${demanda.prazoProcesso}T00:00:00`).getTime()) {
        const ordemResult = await client.query(
          `select coalesce(max(ordem), 0) as max_ordem from adminlog.tarefas_pendentes where pre_demanda_id = $1`,
          [demanda.id],
        );
        const nextOrdem = Number(ordemResult.rows[0]?.max_ordem ?? current.rows[0].ordem ?? 0) + 1;

        await client.query(
          `
            insert into adminlog.tarefas_pendentes (
              pre_demanda_id,
              ordem,
              descricao,
              tipo,
              assunto_id,
              procedimento_id,
              prazo_conclusao,
              recorrencia_tipo,
              recorrencia_dias_semana,
              recorrencia_dia_mes,
              setor_destino_id,
              gerada_automaticamente,
              created_by_user_id
            )
            values ($1, $2, $3, $4, $5::uuid, $6::uuid, $7::date, $8, $9::jsonb, $10::int, $11::uuid, $12, $13)
          `,
          [
            demanda.id,
            nextOrdem,
            String(current.rows[0].descricao),
            String(current.rows[0].tipo),
            current.rows[0].assunto_id ?? null,
            current.rows[0].procedimento_id ?? null,
            proximaDataRecorrente,
            current.rows[0].recorrencia_tipo ?? null,
            current.rows[0].recorrencia_dias_semana ? JSON.stringify(current.rows[0].recorrencia_dias_semana) : null,
            current.rows[0].recorrencia_dia_mes ?? null,
            current.rows[0].setor_destino_id ?? null,
            Boolean(current.rows[0].gerada_automaticamente),
            input.changedByUserId,
          ],
        );

        await this.insertAndamento(client, {
          preDemandaId: demanda.id,
          preId: demanda.preId,
          descricao: `Nova ocorrencia gerada para a tarefa recorrente ${String(current.rows[0].descricao)} com prazo em ${new Date(`${proximaDataRecorrente}T00:00:00`).toLocaleDateString("pt-BR")}.`,
          tipo: "sistema",
          createdByUserId: input.changedByUserId,
        });
      }

      if (current.rows[0].setor_destino_id) {
        await this.activateSetorFromTarefa(client, {
          preDemandaId: demanda.id,
          preId: demanda.preId,
          setorDestinoId: String(current.rows[0].setor_destino_id),
          changedByUserId: input.changedByUserId,
        });
      }

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

  async listComentarios(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    return this.loadComentarios(this.pool, demanda.id, demanda.preId);
  }

  async createComentario(input: CreateComentarioInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const inserted = await client.query(
        `
          insert into adminlog.demanda_comentarios (pre_demanda_id, conteudo, formato, created_by_user_id, edited_by_user_id)
          values ($1, $2, $3, $4, $4)
          returning id
        `,
        [demanda.id, input.conteudo, input.formato, input.changedByUserId],
      );

      const result = await client.query(
        `
          select
            comentario.id,
            $2::text as pre_id,
            comentario.conteudo,
            comentario.formato,
            comentario.created_at,
            comentario.updated_at,
            created_by.id as created_by_id,
            created_by.email as created_by_email,
            created_by.name as created_by_name,
            created_by.role as created_by_role,
            edited_by.id as edited_by_id,
            edited_by.email as edited_by_email,
            edited_by.name as edited_by_name,
            edited_by.role as edited_by_role
          from adminlog.demanda_comentarios comentario
          left join adminlog.app_user created_by on created_by.id = comentario.created_by_user_id
          left join adminlog.app_user edited_by on edited_by.id = comentario.edited_by_user_id
          where comentario.id = $1::uuid
          limit 1
        `,
        [inserted.rows[0].id, demanda.preId],
      );

      return mapComentario(result.rows[0]);
    });
  }

  async updateComentario(input: UpdateComentarioInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const updated = await client.query(
        `
          update adminlog.demanda_comentarios
          set conteudo = $3,
              edited_by_user_id = $4
          where id = $1::uuid
            and pre_demanda_id = $2
          returning id
        `,
        [input.comentarioId, demanda.id, input.conteudo, input.changedByUserId],
      );

      if (!updated.rows[0]) {
        throw new AppError(404, "COMENTARIO_NOT_FOUND", "Comentario nao encontrado.");
      }

      const result = await client.query(
        `
          select
            comentario.id,
            $2::text as pre_id,
            comentario.conteudo,
            comentario.formato,
            comentario.created_at,
            comentario.updated_at,
            created_by.id as created_by_id,
            created_by.email as created_by_email,
            created_by.name as created_by_name,
            created_by.role as created_by_role,
            edited_by.id as edited_by_id,
            edited_by.email as edited_by_email,
            edited_by.name as edited_by_name,
            edited_by.role as edited_by_role
          from adminlog.demanda_comentarios comentario
          left join adminlog.app_user created_by on created_by.id = comentario.created_by_user_id
          left join adminlog.app_user edited_by on edited_by.id = comentario.edited_by_user_id
          where comentario.id = $1::uuid
          limit 1
        `,
        [input.comentarioId, demanda.preId],
      );

      return mapComentario(result.rows[0]);
    });
  }

  async listDocumentos(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    return this.loadDocumentos(this.pool, demanda.id, demanda.preId);
  }

  async createDocumento(input: CreateDocumentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const inserted = await client.query(
        `
          insert into adminlog.demanda_documentos (
            pre_demanda_id,
            nome_arquivo,
            mime_type,
            tamanho_bytes,
            descricao,
            conteudo,
            created_by_user_id
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          returning id
        `,
        [demanda.id, input.nomeArquivo, input.mimeType, input.tamanhoBytes, input.descricao ?? null, input.conteudo, input.changedByUserId],
      );

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Documento anexado: ${input.nomeArquivo}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      const result = await client.query(
        `
          select
            documento.id,
            $2::text as pre_id,
            documento.nome_arquivo,
            documento.mime_type,
            documento.tamanho_bytes,
            documento.descricao,
            documento.created_at,
            created_by.id as created_by_id,
            created_by.email as created_by_email,
            created_by.name as created_by_name,
            created_by.role as created_by_role
          from adminlog.demanda_documentos documento
          left join adminlog.app_user created_by on created_by.id = documento.created_by_user_id
          where documento.id = $1::uuid
          limit 1
        `,
        [inserted.rows[0].id, demanda.preId],
      );

      return mapDocumento(result.rows[0]);
    });
  }

  async removeDocumento(input: RemoveDocumentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const deleted = await client.query(
        `
          delete from adminlog.demanda_documentos
          where id = $1::uuid
            and pre_demanda_id = $2
          returning nome_arquivo
        `,
        [input.documentoId, demanda.id],
      );

      if (!deleted.rows[0]) {
        throw new AppError(404, "DOCUMENTO_NOT_FOUND", "Documento nao encontrado.");
      }

      await this.insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Documento removido: ${String(deleted.rows[0].nome_arquivo)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return this.loadDocumentos(client, demanda.id, demanda.preId);
    });
  }

  async downloadDocumento(preId: string, documentoId: string): Promise<DocumentoDownloadResult> {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    const result = await this.pool.query(
      `
        select
          documento.id,
          $2::text as pre_id,
          documento.nome_arquivo,
          documento.mime_type,
          documento.tamanho_bytes,
          documento.descricao,
          documento.conteudo,
          documento.created_at,
          created_by.id as created_by_id,
          created_by.email as created_by_email,
          created_by.name as created_by_name,
          created_by.role as created_by_role
        from adminlog.demanda_documentos documento
        left join adminlog.app_user created_by on created_by.id = documento.created_by_user_id
        where documento.id = $1::uuid
          and documento.pre_demanda_id = $3
        limit 1
      `,
      [documentoId, demanda.preId, demanda.id],
    );

    if (!result.rows[0]) {
      throw new AppError(404, "DOCUMENTO_NOT_FOUND", "Documento nao encontrado.");
    }

    return {
      documento: mapDocumento(result.rows[0]),
      conteudo: result.rows[0].conteudo as Buffer,
    };
  }

  async listSetoresAtivos(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    return this.loadSetoresAtivos(this.pool, demanda.id);
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

      await client.query("update adminlog.demanda_sei_vinculos set principal = false where pre_demanda_id = $1", [Number(demanda.rows[0].id)]);
      await client.query(
        `
          insert into adminlog.demanda_sei_vinculos (pre_demanda_id, sei_numero, principal, observacoes, created_by_user_id)
          values ($1, $2, true, $3, $4)
          on conflict (pre_demanda_id, sei_numero) do update
          set principal = true,
              observacoes = excluded.observacoes
        `,
        [Number(demanda.rows[0].id), input.seiNumero, input.observacoes ?? null, input.changedByUserId],
      );

      const currentStatus = demanda.rows[0].status as PreDemandaStatus;
      if (currentStatus !== "em_andamento") {
        await client.query("update adminlog.pre_demanda set status = 'em_andamento' where pre_id = $1", [input.preId]);
        await client.query(
          `
            insert into adminlog.pre_demanda_status_audit (pre_id, status_anterior, status_novo, motivo, observacoes, changed_by_user_id)
            values ($1, $2, 'em_andamento', $3, $4, $5)
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
          select pd.id, pd.status
          from adminlog.pre_demanda pd
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
      const associationResult = await client.query(
        `
          select 1
          from adminlog.pre_to_sei_link pts
          where pts.pre_id = $1
          limit 1
        `,
        [input.preId],
      );
      const hasAssociation = (associationResult.rowCount ?? 0) > 0;
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
            coalesce(pts.sei_numero, pd.pre_id) as principal_numero,
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          left join adminlog.app_user created_by on created_by.id = pd.created_by_user_id
          where pd.pre_id = $1

          union all

          select
            concat('status-', audit.id) as event_id,
            audit.pre_id,
            coalesce(pts.sei_numero, audit.pre_id) as principal_numero,
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = audit.pre_id
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
          where audit.pre_id = $1

          union all

          select
            concat('sei-linked-', pts.id) as event_id,
            pts.pre_id,
            pts.sei_numero as principal_numero,
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
            coalesce(pts.sei_numero, audit.sei_numero_novo, audit.pre_id) as principal_numero,
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = audit.pre_id
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id
          where audit.pre_id = $1

          union all

          select
            concat('andamento-', andamento.id) as event_id,
            pd.pre_id,
            coalesce(pts.sei_numero, pd.pre_id) as principal_numero,
            case
              when andamento.tipo = 'tramitacao' then 'tramitation'
              when andamento.tipo = 'tarefa_concluida' then 'task_completed'
              when andamento.tipo = 'interessado_added' then 'interessado_added'
              when andamento.tipo = 'interessado_removed' then 'interessado_removed'
              when andamento.tipo = 'vinculo_added' then 'vinculo_added'
              when andamento.tipo = 'vinculo_removed' then 'vinculo_removed'
              when andamento.tipo = 'sistema' and andamento.descricao like 'Documento anexado:%' then 'document_added'
              when andamento.tipo = 'sistema' and andamento.descricao like 'Documento removido:%' then 'document_removed'
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          left join adminlog.app_user actor on actor.id = andamento.created_by_user_id
          where pd.pre_id = $1

          union all

          select
            concat('comment-', comentario.id) as event_id,
            pd.pre_id,
            coalesce(pts.sei_numero, pd.pre_id) as principal_numero,
            'comment_added'::text as event_type,
            comentario.created_at as occurred_at,
            actor.id as actor_id,
            actor.email as actor_email,
            actor.name as actor_name,
            actor.role as actor_role,
            null::text as motivo,
            null::text as observacoes,
            concat('Comentario registado: ', left(comentario.conteudo, 160))::text as descricao,
            null::text as status_anterior,
            null::text as status_novo,
            null::text as sei_numero_anterior,
            null::text as sei_numero_novo
          from adminlog.demanda_comentarios comentario
          inner join adminlog.pre_demanda pd on pd.id = comentario.pre_demanda_id
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          left join adminlog.app_user actor on actor.id = comentario.created_by_user_id
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
            coalesce(pts.sei_numero, pd.pre_id) as principal_numero,
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          left join adminlog.app_user created_by on created_by.id = pd.created_by_user_id

          union all

          select
            concat('status-', audit.id) as event_id,
            audit.pre_id,
            coalesce(pts.sei_numero, audit.pre_id) as principal_numero,
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = audit.pre_id
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id

          union all

          select
            concat('sei-linked-', pts.id) as event_id,
            pts.pre_id,
            pts.sei_numero as principal_numero,
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
            coalesce(pts.sei_numero, audit.sei_numero_novo, audit.pre_id) as principal_numero,
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = audit.pre_id
          left join adminlog.app_user changed_by on changed_by.id = audit.changed_by_user_id

          union all

          select
            concat('andamento-', andamento.id) as event_id,
            pd.pre_id,
            coalesce(pts.sei_numero, pd.pre_id) as principal_numero,
            case
              when andamento.tipo = 'tramitacao' then 'tramitation'
              when andamento.tipo = 'tarefa_concluida' then 'task_completed'
              when andamento.tipo = 'interessado_added' then 'interessado_added'
              when andamento.tipo = 'interessado_removed' then 'interessado_removed'
              when andamento.tipo = 'vinculo_added' then 'vinculo_added'
              when andamento.tipo = 'vinculo_removed' then 'vinculo_removed'
              when andamento.tipo = 'sistema' and andamento.descricao like 'Documento anexado:%' then 'document_added'
              when andamento.tipo = 'sistema' and andamento.descricao like 'Documento removido:%' then 'document_removed'
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
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          left join adminlog.app_user actor on actor.id = andamento.created_by_user_id

          union all

          select
            concat('comment-', comentario.id) as event_id,
            pd.pre_id,
            coalesce(pts.sei_numero, pd.pre_id) as principal_numero,
            'comment_added'::text as event_type,
            comentario.created_at as occurred_at,
            actor.id as actor_id,
            actor.email as actor_email,
            actor.name as actor_name,
            actor.role as actor_role,
            null::text as motivo,
            null::text as observacoes,
            concat('Comentario registado: ', left(comentario.conteudo, 160))::text as descricao,
            null::text as status_anterior,
            null::text as status_novo,
            null::text as sei_numero_anterior,
            null::text as sei_numero_novo
          from adminlog.demanda_comentarios comentario
          inner join adminlog.pre_demanda pd on pd.id = comentario.pre_demanda_id
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          left join adminlog.app_user actor on actor.id = comentario.created_by_user_id
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
    const [counts, lifecycleMetricsResult, staleItemsResult, awaitingSeiResult, agingMetricsResult, caseSignalsResult, dueSoonItemsResult, paymentMarkedItemsResult, urgentItemsResult, withoutSetorItemsResult, withoutInteressadosItemsResult, recentTimeline] = await Promise.all([
      this.getStatusCounts(),
      this.pool.query(
        `
          select
            count(*) filter (
              where audit.status_anterior = 'encerrada'
                and audit.status_novo in ('em_andamento', 'aguardando_sei')
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
                and pd.prazo_processo < current_date
            )::int as overdue_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.prazo_processo = current_date
            )::int as due_today_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.prazo_processo between current_date and current_date + interval '7 days'
            )::int as due_soon_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and coalesce((pd.metadata ->> 'pagamento_envolvido')::boolean, false) = true
            )::int as payment_marked_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and coalesce((pd.metadata ->> 'urgente')::boolean, false) = true
            )::int as urgent_total,
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
            )::int as without_interessados_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and pd.prazo_processo is not null
            )::int as prazo_processo_defined_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and exists (
                  select 1
                  from adminlog.tarefas_pendentes tarefa
                  where tarefa.pre_demanda_id = pd.id
                    and tarefa.concluida = false
                    and tarefa.prazo_conclusao < current_date
                )
            )::int as tarefas_overdue_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and exists (
                  select 1
                  from adminlog.tarefas_pendentes tarefa
                  where tarefa.pre_demanda_id = pd.id
                    and tarefa.concluida = false
                    and tarefa.prazo_conclusao = current_date
                )
            )::int as tarefas_due_today_total,
            count(*) filter (
              where pd.status <> 'encerrada'
                and exists (
                  select 1
                  from adminlog.tarefas_pendentes tarefa
                  where tarefa.pre_demanda_id = pd.id
                    and tarefa.concluida = false
                    and tarefa.prazo_conclusao between current_date and current_date + interval '7 days'
                )
            )::int as tarefas_due_soon_total,
            coalesce(sum((
              select count(*)
              from adminlog.tarefas_pendentes tarefa
              where tarefa.pre_demanda_id = pd.id
                and tarefa.concluida = false
            )), 0)::int as tarefas_pending_total,
            count(*) filter (where pd.status <> 'encerrada' and prox_tarefa.proximo_prazo_tarefa >= pd.prazo_processo - interval '2 days' and prox_tarefa.proximo_prazo_tarefa < pd.prazo_processo)::int as processos_em_atencao_prazo,
            count(*) filter (where pd.status <> 'encerrada' and (prox_tarefa.proximo_prazo_tarefa >= pd.prazo_processo or exists (select 1 from adminlog.tarefas_pendentes tarefa where tarefa.pre_demanda_id = pd.id and tarefa.concluida = false and tarefa.prazo_conclusao < current_date)))::int as processos_criticos_prazo
          from adminlog.pre_demanda pd
          left join lateral (
            select min(tarefa.prazo_conclusao) as proximo_prazo_tarefa
            from adminlog.tarefas_pendentes tarefa
            where tarefa.pre_demanda_id = pd.id
              and tarefa.concluida = false
          ) prox_tarefa on true
        `,
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status <> 'encerrada'
            and coalesce(prox_tarefa.proximo_prazo_tarefa, pd.prazo_processo) between current_date and current_date + interval '7 days'
          order by coalesce(prox_tarefa.proximo_prazo_tarefa, pd.prazo_processo) asc, pd.updated_at asc, pd.id asc
          limit 5
        `,
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status <> 'encerrada'
            and coalesce((pd.metadata ->> 'pagamento_envolvido')::boolean, false) = true
          order by pd.prazo_processo asc nulls last, pd.updated_at asc, pd.id asc
          limit 5
        `,
      ),
      this.pool.query(
        `
          ${BASE_SELECT}
          where pd.status <> 'encerrada'
            and coalesce((pd.metadata ->> 'urgente')::boolean, false) = true
          order by pd.prazo_processo asc nulls last, pd.updated_at asc, pd.id asc
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
      deadlines: {
        processo: {
          overdueTotal: Number(caseSignalsResult.rows[0]?.overdue_total ?? 0),
          dueTodayTotal: Number(caseSignalsResult.rows[0]?.due_today_total ?? 0),
          dueSoonTotal: Number(caseSignalsResult.rows[0]?.due_soon_total ?? 0),
          totalDefined: Number(caseSignalsResult.rows[0]?.prazo_processo_defined_total ?? 0),
        },
        tarefas: {
          overdueTotal: Number(caseSignalsResult.rows[0]?.tarefas_overdue_total ?? 0),
          dueTodayTotal: Number(caseSignalsResult.rows[0]?.tarefas_due_today_total ?? 0),
          dueSoonTotal: Number(caseSignalsResult.rows[0]?.tarefas_due_soon_total ?? 0),
          totalPending: Number(caseSignalsResult.rows[0]?.tarefas_pending_total ?? 0),
        },
      },
      processosEmAtencaoPrazo: Number(caseSignalsResult.rows[0]?.processos_em_atencao_prazo ?? 0),
      processosCriticosPrazo: Number(caseSignalsResult.rows[0]?.processos_criticos_prazo ?? 0),
      reopenedLast30Days: Number(lifecycleMetricsResult.rows[0]?.reopened_last_30_days ?? 0),
      closedLast30Days: Number(lifecycleMetricsResult.rows[0]?.closed_last_30_days ?? 0),
      agingAttentionTotal: Number(agingMetricsResult.rows[0]?.aging_attention_total ?? 0),
      agingCriticalTotal: Number(agingMetricsResult.rows[0]?.aging_critical_total ?? 0),
      dueTodayTotal: Number(caseSignalsResult.rows[0]?.due_today_total ?? 0),
      dueSoonTotal: Number(caseSignalsResult.rows[0]?.due_soon_total ?? 0),
      overdueTotal: Number(caseSignalsResult.rows[0]?.overdue_total ?? 0),
      paymentMarkedTotal: Number(caseSignalsResult.rows[0]?.payment_marked_total ?? 0),
      urgentTotal: Number(caseSignalsResult.rows[0]?.urgent_total ?? 0),
      withoutSetorTotal: Number(caseSignalsResult.rows[0]?.without_setor_total ?? 0),
      withoutInteressadosTotal: Number(caseSignalsResult.rows[0]?.without_interessados_total ?? 0),
      staleItems: staleItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      awaitingSeiItems: awaitingSeiResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      dueSoonItems: dueSoonItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      paymentMarkedItems: paymentMarkedItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      urgentItems: urgentItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      withoutSetorItems: withoutSetorItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      withoutInteressadosItems: withoutInteressadosItemsResult.rows.map((row) => mapPreDemandaBase(row, queueHealthThresholds)),
      recentTimeline,
    };
  }
}
