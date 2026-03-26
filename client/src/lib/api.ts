import type {
  AdminOpsSummary,
  AdminUserAuditRecord,
  AdminUserSummary,
  Andamento,
  Audiencia,
  Assunto,
  AuthUser,
  DashboardTaskListResult,
  DashboardTaskSortMode,
  DashboardTaskStatusFilter,
  DashboardTaskItem,
  DemandaComentario,
  DemandaInteressado,
  DemandaInteressadoPapel,
  DemandaDocumento,
  DemandaSetorFluxo,
  DemandaVinculo,
  Interessado,
  Norma,
  PreDemanda,
  PreDemandaAuditRecord,
  GlobalAuditRecord,
  PreDemandaDashboardSummary,
  PreDemandaMetadata,
  QueueHealthConfig,
  QueueHealthLevel,
  PreDemandaSortBy,
  PreDemandaStatus,
  RuntimeStatus,
  SeiAssociation,
  Setor,
  SortOrder,
  StatusCount,
  TarefaPendente,
  TarefaRecorrenciaTipo,
  TarefaPendenteTipo,
  TimelineEvent,
} from "../types";

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
}

type CatalogCacheEntry<T> = {
  value: T | null;
  expiresAt: number;
  pending: Promise<T> | null;
};

const CATALOG_CACHE_TTL_MS = 60_000;
const RUNTIME_CACHE_TTL_MS = 30_000;
const setoresCache: CatalogCacheEntry<Setor[]> = { value: null, expiresAt: 0, pending: null };
const assuntosCache: CatalogCacheEntry<Assunto[]> = { value: null, expiresAt: 0, pending: null };
const runtimeCache: CatalogCacheEntry<RuntimeStatus> = { value: null, expiresAt: 0, pending: null };

function invalidateCatalogCache(entry: CatalogCacheEntry<unknown>) {
  entry.value = null;
  entry.expiresAt = 0;
  entry.pending = null;
}

async function loadCachedCatalog<T>(entry: CatalogCacheEntry<T>, loader: () => Promise<T>) {
  const now = Date.now();
  if (entry.value && entry.expiresAt > now) {
    return entry.value;
  }

  if (entry.pending) {
    return entry.pending;
  }

  entry.pending = loader()
    .then((result) => {
      entry.value = result;
      entry.expiresAt = Date.now() + CATALOG_CACHE_TTL_MS;
      return result;
    })
    .finally(() => {
      entry.pending = null;
    });

  return entry.pending;
}

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const hasJsonBody = init?.body !== undefined && !(init.body instanceof FormData);
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const requestId = response.headers.get("x-request-id") ?? undefined;
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? ((await response.json()) as ApiEnvelope<T>) : null;

  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.code ?? "REQUEST_FAILED", body?.error?.message ?? "Falha na requisicao.", body?.error?.details, requestId);
  }

  if (!body?.ok) {
    throw new ApiError(response.status, body?.error?.code ?? "INVALID_RESPONSE", body?.error?.message ?? "Resposta invalida do servidor.", body?.error?.details, requestId);
  }

  return body.data;
}

export function appendRequestReference(message: string, requestId?: string | null) {
  if (!requestId) {
    return message;
  }

  return `${message} Referencia: ${requestId}.`;
}

export function formatAppError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return appendRequestReference(error.message || fallback, error.requestId);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export interface ListPreDemandasParams {
  q?: string;
  status?: string[];
  queueHealth?: QueueHealthLevel[];
  dateFrom?: string;
  dateTo?: string;
  hasSei?: boolean;
  setorAtualId?: string;
  withoutSetor?: boolean;
  dueState?: "overdue" | "due_today" | "due_soon" | "none";
  deadlineCampo?: "prazoProcesso" | "proximoPrazoTarefa";
  prazoRecorte?: "overdue" | "today" | "soon";
  taskRecurrence?: TarefaRecorrenciaTipo | "sem_recorrencia";
  paymentInvolved?: boolean;
  hasInteressados?: boolean;
  closedWithinDays?: number;
  reopenedWithinDays?: number;
  sortBy?: PreDemandaSortBy;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface CreatePreDemandaPayload {
  solicitante?: string;
  assunto: string;
  data_referencia: string;
  descricao?: string;
  fonte?: string;
  observacoes?: string;
  prazo_processo: string;
  sei_numero?: string | null;
  numero_judicial?: string | null;
  assunto_ids?: string[];
  metadata?: {
    frequencia?: string | null;
    frequencia_dias_semana?: string[] | null;
    frequencia_dia_mes?: number | null;
    pagamento_envolvido?: boolean | null;
    urgente?: boolean | null;
    audiencia_data?: string | null;
    audiencia_status?: string | null;
  } | null;
}

export interface UpdatePreDemandaCasePayload {
  assunto?: string;
  descricao?: string | null;
  fonte?: string | null;
  observacoes?: string | null;
  prazo_processo?: string | null;
  numero_judicial?: string | null;
  metadata?: {
    pagamento_envolvido?: boolean | null;
    urgente?: boolean | null;
    audiencia_data?: string | null;
    audiencia_status?: string | null;
  };
}

export interface ListInteressadosParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

export type ListPessoasParams = ListInteressadosParams;

export function login(email: string, password: string) {
  return request<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<{ loggedOut: true }>("/api/auth/logout", {
    method: "POST",
  });
}

export function getCurrentUser() {
  return request<AuthUser>("/api/auth/me");
}

export function getRuntimeHealth() {
  return loadCachedCatalog(runtimeCache, () => request<RuntimeStatus>("/api/health").catch((error) => {
    invalidateCatalogCache(runtimeCache);
    throw error;
  }));
}

export function getAdminOpsSummary(limit = 12, days = 30) {
  return request<AdminOpsSummary>(`/api/admin/ops/resumo?limit=${limit}&days=${days}`);
}

export async function downloadAdminOpsCaseReportCsv(days = 30) {
  const response = await fetch(`/api/admin/ops/case-report.csv?days=${days}`, {
    credentials: "include",
  });

  const requestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? ((await response.json()) as ApiEnvelope<never>) : null;
    throw new ApiError(response.status, body?.error?.code ?? "REQUEST_FAILED", body?.error?.message ?? "Falha ao exportar relatorio.", body?.error?.details, requestId);
  }

  const blob = await response.blob();
  const fileName = `gestor-case-report-${days}d.csv`;
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function updateQueueHealthConfig(payload: { attentionDays: number; criticalDays: number }) {
  return request<QueueHealthConfig>("/api/admin/ops/queue-health-config", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listPreDemandas(params: ListPreDemandasParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.status?.length) searchParams.set("status", params.status.join(","));
  if (params.queueHealth?.length) searchParams.set("queueHealth", params.queueHealth.join(","));
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.hasSei !== undefined) searchParams.set("hasSei", String(params.hasSei));
  if (params.setorAtualId) searchParams.set("setorAtualId", params.setorAtualId);
  if (params.withoutSetor !== undefined) searchParams.set("withoutSetor", String(params.withoutSetor));
  if (params.dueState) searchParams.set("dueState", params.dueState);
  if (params.deadlineCampo) searchParams.set("deadlineCampo", params.deadlineCampo);
  if (params.prazoRecorte) searchParams.set("prazoRecorte", params.prazoRecorte);
  if (params.taskRecurrence) searchParams.set("taskRecurrence", params.taskRecurrence);
  if (params.paymentInvolved !== undefined) searchParams.set("paymentInvolved", String(params.paymentInvolved));
  if (params.hasInteressados !== undefined) searchParams.set("hasInteressados", String(params.hasInteressados));
  if (params.closedWithinDays) searchParams.set("closedWithinDays", String(params.closedWithinDays));
  if (params.reopenedWithinDays) searchParams.set("reopenedWithinDays", String(params.reopenedWithinDays));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 10));

  const query = searchParams.toString();
  const path = query ? `/api/pre-demandas?${query}` : "/api/pre-demandas";

  return request<{
    items: PreDemanda[];
    total: number;
    page: number;
    pageSize: number;
    counts: StatusCount[];
  }>(path);
}

export function createPreDemanda(payload: CreatePreDemandaPayload) {
  return request<PreDemanda & { idempotent: boolean; existingPreId: string | null }>("/api/pre-demandas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addPreDemandaAssunto(preId: string, assuntoId: string) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}/assuntos`, {
    method: "POST",
    body: JSON.stringify({ assunto_id: assuntoId }),
  });
}

export function removePreDemandaAssunto(preId: string, assuntoId: string) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}/assuntos/${assuntoId}`, {
    method: "DELETE",
  });
}

export function getPreDemanda(preId: string) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}`);
}

export function updatePreDemandaCase(preId: string, payload: UpdatePreDemandaCasePayload) {
  return request<{ preId: string }>(`/api/pre-demandas/${preId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePreDemandaAnotacoes(preId: string, anotacoes: string | null) {
  return request<{ preId: string }>(`/api/pre-demandas/${preId}/anotacoes`, {
    method: "PATCH",
    body: JSON.stringify({ anotacoes }),
  });
}

export function updatePreDemandaStatus(preId: string, payload: { status: PreDemandaStatus; motivo?: string; observacoes?: string; delete_pending_tasks?: boolean }) {
  return request<{ preId: string; status: PreDemandaStatus; allowedNextStatuses: PreDemandaStatus[] }>(`/api/pre-demandas/${preId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function associateSei(preId: string, payload: { sei_numero: string; motivo?: string; observacoes?: string }) {
  return request<{
    association: PreDemanda["currentAssociation"];
    audited: boolean;
  }>(`/api/pre-demandas/${preId}/associacoes-sei`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listPreDemandaSeiAssociations(preId: string) {
  return request<SeiAssociation[]>(`/api/pre-demandas/${preId}/associacoes-sei`);
}

export function addPreDemandaInteressado(preId: string, payload: { interessado_id: string; papel: DemandaInteressadoPapel }) {
  return request<DemandaInteressado[]>(`/api/pre-demandas/${preId}/interessados`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removePreDemandaInteressado(preId: string, interessadoId: string) {
  return request<DemandaInteressado[]>(`/api/pre-demandas/${preId}/interessados/${interessadoId}`, {
    method: "DELETE",
  });
}

export function listPreDemandaInteressados(preId: string) {
  return request<DemandaInteressado[]>(`/api/pre-demandas/${preId}/interessados`);
}

export function listPreDemandaAssuntos(preId: string) {
  return request<PreDemanda["assuntos"]>(`/api/pre-demandas/${preId}/assuntos`);
}

export function addPreDemandaVinculo(preId: string, destinoPreId: string) {
  return request<DemandaVinculo[]>(`/api/pre-demandas/${preId}/vinculos`, {
    method: "POST",
    body: JSON.stringify({ destino_pre_id: destinoPreId }),
  });
}

export function removePreDemandaVinculo(preId: string, destinoPreId: string) {
  return request<DemandaVinculo[]>(`/api/pre-demandas/${preId}/vinculos/${destinoPreId}`, {
    method: "DELETE",
  });
}

export function listPreDemandaVinculos(preId: string) {
  return request<DemandaVinculo[]>(`/api/pre-demandas/${preId}/vinculos`);
}

export function createPreDemandaAudiencia(
  preId: string,
  payload: {
    data_hora_inicio: string;
    data_hora_fim?: string | null;
    descricao?: string | null;
    sala?: string | null;
    situacao: Audiencia["situacao"];
    observacoes?: string | null;
  },
) {
  return request<Audiencia>(`/api/pre-demandas/${preId}/audiencias`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePreDemandaAudiencia(
  preId: string,
  audienciaId: string,
  payload: {
    data_hora_inicio: string;
    data_hora_fim?: string | null;
    descricao?: string | null;
    sala?: string | null;
    situacao: Audiencia["situacao"];
    observacoes?: string | null;
  },
) {
  return request<Audiencia>(`/api/pre-demandas/${preId}/audiencias/${audienciaId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function removePreDemandaAudiencia(preId: string, audienciaId: string) {
  return request<{ removedId: string }>(`/api/pre-demandas/${preId}/audiencias/${audienciaId}`, {
    method: "DELETE",
  });
}

export function listPreDemandaAudiencias(preId: string) {
  return request<Audiencia[]>(`/api/pre-demandas/${preId}/audiencias`);
}

export function tramitarPreDemanda(preId: string, setorDestinoId: string) {
  return request<{ preId: string }>(`/api/pre-demandas/${preId}/tramitar`, {
    method: "POST",
    body: JSON.stringify({ setor_destino_id: setorDestinoId }),
  });
}

export function tramitarPreDemandaMultiplos(preId: string, setorDestinoIds: string[], observacoes?: string | null) {
  return request<{ preId: string }>(`/api/pre-demandas/${preId}/tramitar`, {
    method: "POST",
    body: JSON.stringify({ setores_destino_ids: setorDestinoIds, observacoes }),
  });
}

export function concluirTramitacaoSetor(preId: string, setorId: string, observacoes?: string | null) {
  return request<{ preId: string }>(`/api/pre-demandas/${preId}/setores/${setorId}/concluir-tramitacao`, {
    method: "PATCH",
    body: JSON.stringify({ observacoes }),
  });
}

export function addPreDemandaAndamento(preId: string, payload: { descricao: string; data_hora?: string | null }) {
  return request<Andamento>(`/api/pre-demandas/${preId}/andamentos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePreDemandaAndamento(preId: string, andamentoId: string, payload: { descricao: string; data_hora?: string | null }) {
  return request<Andamento>(`/api/pre-demandas/${preId}/andamentos/${andamentoId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function removePreDemandaAndamento(preId: string, andamentoId: string, confirmacao = "EXCLUIR") {
  return request<{ removedId: string }>(`/api/pre-demandas/${preId}/andamentos/${andamentoId}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmacao }),
  });
}

export function listPreDemandaTarefas(preId: string) {
  return request<TarefaPendente[]>(`/api/pre-demandas/${preId}/tarefas`);
}

export function createPreDemandaTarefa(
  preId: string,
  payload: {
    descricao: string;
    tipo: TarefaPendenteTipo;
    prazo_conclusao: string;
    horario_inicio?: string | null;
    horario_fim?: string | null;
    recorrencia_tipo?: TarefaRecorrenciaTipo | null;
    recorrencia_dias_semana?: string[] | null;
    recorrencia_dia_mes?: number | null;
    setor_destino_id?: string | null;
    confirmar_alteracao_prazo?: boolean;
  },
) {
  return request<TarefaPendente>(`/api/pre-demandas/${preId}/tarefas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePreDemandaTarefa(
  preId: string,
  tarefaId: string,
  payload: {
    descricao: string;
    tipo: TarefaPendenteTipo;
    prazo_conclusao: string;
    horario_inicio?: string | null;
    horario_fim?: string | null;
    recorrencia_tipo?: TarefaRecorrenciaTipo | null;
    recorrencia_dias_semana?: string[] | null;
    recorrencia_dia_mes?: number | null;
    confirmar_alteracao_prazo?: boolean;
  },
) {
  return request<TarefaPendente>(`/api/pre-demandas/${preId}/tarefas/${tarefaId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function reorderPreDemandaTarefas(preId: string, tarefaIds: string[]) {
  return request<TarefaPendente[]>(`/api/pre-demandas/${preId}/tarefas/ordem`, {
    method: "PATCH",
    body: JSON.stringify({ tarefa_ids: tarefaIds }),
  });
}

export function removePreDemandaTarefa(preId: string, tarefaId: string) {
  return request<{ removedId: string }>(`/api/pre-demandas/${preId}/tarefas/${tarefaId}`, {
    method: "DELETE",
  });
}

export function concluirPreDemandaTarefa(preId: string, tarefaId: string) {
  return request<TarefaPendente>(`/api/pre-demandas/${preId}/tarefas/${tarefaId}/concluir`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export function getAudit(preId: string) {
  return request<PreDemandaAuditRecord[]>(`/api/pre-demandas/${preId}/auditoria`);
}

export function getTimeline(preId: string) {
  return request<TimelineEvent[]>(`/api/pre-demandas/${preId}/timeline`);
}

export function listPreDemandaComentarios(preId: string) {
  return request<DemandaComentario[]>(`/api/pre-demandas/${preId}/comentarios`);
}

export function createPreDemandaComentario(preId: string, payload: { conteudo: string; formato?: "markdown" }) {
  return request<DemandaComentario>(`/api/pre-demandas/${preId}/comentarios`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePreDemandaComentario(preId: string, comentarioId: string, payload: { conteudo: string; formato?: "markdown" }) {
  return request<DemandaComentario>(`/api/pre-demandas/${preId}/comentarios/${comentarioId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listPreDemandaDocumentos(preId: string) {
  return request<DemandaDocumento[]>(`/api/pre-demandas/${preId}/documentos`);
}

export function createPreDemandaDocumento(
  preId: string,
  payload: { nome_arquivo: string; mime_type: string; descricao?: string | null; conteudo_base64: string },
) {
  return request<DemandaDocumento>(`/api/pre-demandas/${preId}/documentos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function downloadPreDemandaDocumento(preId: string, documentoId: string, nomeArquivo: string) {
  const response = await fetch(`/api/pre-demandas/${preId}/documentos/${documentoId}/download`, {
    credentials: "include",
  });

  const requestId = response.headers.get("x-request-id") ?? undefined;
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? ((await response.json()) as ApiEnvelope<never>) : null;
    throw new ApiError(response.status, body?.error?.code ?? "REQUEST_FAILED", body?.error?.message ?? "Falha ao baixar documento.", body?.error?.details, requestId);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nomeArquivo;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function removePreDemandaDocumento(preId: string, documentoId: string) {
  return request<DemandaDocumento[]>(`/api/pre-demandas/${preId}/documentos/${documentoId}`, {
    method: "DELETE",
  });
}

export function listPreDemandaSetoresAtivos(preId: string) {
  return request<DemandaSetorFluxo[]>(`/api/pre-demandas/${preId}/setores-ativos`);
}

export function getRecentTimeline(limit = 8) {
  return request<TimelineEvent[]>(`/api/pre-demandas/timeline/recentes?limit=${limit}`);
}

export function getDashboardSummary() {
  return request<PreDemandaDashboardSummary>("/api/pre-demandas/dashboard/resumo");
}

export function listDashboardTasks(params: {
  status: DashboardTaskStatusFilter;
  sort: DashboardTaskSortMode;
  date?: string;
  recurrence?: TarefaRecorrenciaTipo | "sem_recorrencia";
  openWithoutTasksQ?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  search.set("status", params.status);
  search.set("sort", params.sort);
  if (params.date) search.set("date", params.date);
  if (params.recurrence) search.set("recurrence", params.recurrence);
  if (params.openWithoutTasksQ) search.set("openWithoutTasksQ", params.openWithoutTasksQ);
  search.set("page", String(params.page ?? 1));
  search.set("pageSize", String(params.pageSize ?? 20));
  return request<DashboardTaskListResult>(`/api/pre-demandas/dashboard/tarefas?${search.toString()}`);
}

export function listInteressados(params: ListInteressadosParams = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  search.set("page", String(params.page ?? 1));
  search.set("pageSize", String(params.pageSize ?? 10));
  return request<{ items: Interessado[]; total: number; page: number; pageSize: number }>(`/api/interessados?${search.toString()}`);
}

export function listPessoas(params: ListPessoasParams = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  search.set("page", String(params.page ?? 1));
  search.set("pageSize", String(params.pageSize ?? 10));
  return request<{ items: Interessado[]; total: number; page: number; pageSize: number }>(`/api/pessoas?${search.toString()}`);
}

export function createInteressado(payload: { nome: string; cargo?: string | null; matricula?: string | null; cpf?: string | null; data_nascimento?: string | null }) {
  return request<Interessado>("/api/interessados", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createPessoa(payload: { nome: string; cargo?: string | null; matricula?: string | null; cpf?: string | null; data_nascimento?: string | null }) {
  return request<Interessado>("/api/pessoas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInteressado(id: string, payload: { nome: string; cargo?: string | null; matricula?: string | null; cpf?: string | null; data_nascimento?: string | null }) {
  return request<Interessado>(`/api/interessados/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePessoa(id: string, payload: { nome: string; cargo?: string | null; matricula?: string | null; cpf?: string | null; data_nascimento?: string | null }) {
  return request<Interessado>(`/api/pessoas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listSetores() {
  return loadCachedCatalog(setoresCache, () => request<Setor[]>("/api/setores"));
}

export function listNormas() {
  return request<Norma[]>("/api/normas");
}

export function createNorma(payload: { numero: string; data_norma: string; origem: string }) {
  return request<Norma>("/api/normas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateNorma(id: string, payload: { numero: string; data_norma: string; origem: string }) {
  return request<Norma>(`/api/normas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listAssuntos() {
  return loadCachedCatalog(assuntosCache, () => request<Assunto[]>("/api/assuntos"));
}

export function createAssunto(payload: {
  nome: string;
  descricao?: string | null;
  norma_ids?: string[];
  procedimentos?: Array<{ ordem?: number; descricao: string; horario_inicio?: string | null; horario_fim?: string | null; setor_destino_id?: string | null }>;
}) {
  return request<Assunto>("/api/assuntos", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((result) => {
    invalidateCatalogCache(assuntosCache);
    return result;
  });
}

export function updateAssunto(
  id: string,
  payload: {
    nome: string;
    descricao?: string | null;
    norma_ids?: string[];
    procedimentos?: Array<{ ordem?: number; descricao: string; horario_inicio?: string | null; horario_fim?: string | null; setor_destino_id?: string | null }>;
  },
) {
  return request<Assunto>(`/api/assuntos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then((result) => {
    invalidateCatalogCache(assuntosCache);
    return result;
  });
}

export function createSetor(payload: { sigla: string; nome_completo: string }) {
  return request<Setor>("/api/setores", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((result) => {
    invalidateCatalogCache(setoresCache);
    return result;
  });
}

export function updateSetor(id: string, payload: { sigla: string; nome_completo: string }) {
  return request<Setor>(`/api/setores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then((result) => {
    invalidateCatalogCache(setoresCache);
    return result;
  });
}

export function listAdminUsers() {
  return request<AdminUserSummary[]>("/api/admin/users");
}

export function listAdminUserAudit(limit = 12) {
  return request<AdminUserAuditRecord[]>(`/api/admin/users/auditoria?limit=${limit}`);
}

export function createAdminUser(payload: { email: string; name: string; password: string; role: "admin" | "operador" }) {
  return request<AdminUserSummary>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(id: number, payload: { name?: string; role?: "admin" | "operador"; active?: boolean }) {
  return request<AdminUserSummary>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function resetAdminUserPassword(id: number, password: string) {
  return request<AdminUserSummary>(`/api/admin/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function listAdminAudit(limit = 50) {
  return request<GlobalAuditRecord[]>(`/api/admin/auditoria?limit=${limit}`);
}
