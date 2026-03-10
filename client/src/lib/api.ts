import type {
  AdminOpsSummary,
  AdminUserAuditRecord,
  AdminUserSummary,
  Andamento,
  AuthUser,
  DemandaInteressado,
  DemandaInteressadoPapel,
  DemandaVinculo,
  Interessado,
  PreDemanda,
  PreDemandaAuditRecord,
  PreDemandaDashboardSummary,
  PreDemandaMetadata,
  QueueHealthConfig,
  QueueHealthLevel,
  PreDemandaSortBy,
  PreDemandaStatus,
  RuntimeStatus,
  Setor,
  SortOrder,
  StatusCount,
  TarefaPendente,
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
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
  dueState?: "overdue" | "due_soon" | "none";
  hasInteressados?: boolean;
  sortBy?: PreDemandaSortBy;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface CreatePreDemandaPayload {
  solicitante: string;
  assunto: string;
  data_referencia: string;
  descricao?: string;
  fonte?: string;
  observacoes?: string;
  prazo_final?: string | null;
  numero_judicial?: string | null;
  metadata?: {
    frequencia?: string | null;
    pagamento_envolvido?: boolean | null;
    audiencia_data?: string | null;
    audiencia_status?: string | null;
  } | null;
}

export interface UpdatePreDemandaCasePayload {
  assunto?: string;
  descricao?: string | null;
  fonte?: string | null;
  observacoes?: string | null;
  prazo_final?: string | null;
  numero_judicial?: string | null;
  metadata?: {
    frequencia?: string | null;
    pagamento_envolvido?: boolean | null;
    audiencia_data?: string | null;
    audiencia_status?: string | null;
  };
}

export interface ListInteressadosParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

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
  return request<RuntimeStatus>("/api/health");
}

export function getAdminOpsSummary(limit = 12, days = 30) {
  return request<AdminOpsSummary>(`/api/admin/ops/resumo?limit=${limit}&days=${days}`);
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
  if (params.dueState) searchParams.set("dueState", params.dueState);
  if (params.hasInteressados !== undefined) searchParams.set("hasInteressados", String(params.hasInteressados));
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

export function getPreDemanda(preId: string) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}`);
}

export function updatePreDemandaCase(preId: string, payload: UpdatePreDemandaCasePayload) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePreDemandaAnotacoes(preId: string, anotacoes: string | null) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}/anotacoes`, {
    method: "PATCH",
    body: JSON.stringify({ anotacoes }),
  });
}

export function updatePreDemandaStatus(preId: string, payload: { status: PreDemandaStatus; motivo?: string; observacoes?: string }) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}/status`, {
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

export function tramitarPreDemanda(preId: string, setorDestinoId: string) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}/tramitar`, {
    method: "POST",
    body: JSON.stringify({ setor_destino_id: setorDestinoId }),
  });
}

export function addPreDemandaAndamento(preId: string, payload: { descricao: string; data_hora?: string | null }) {
  return request<Andamento>(`/api/pre-demandas/${preId}/andamentos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listPreDemandaTarefas(preId: string) {
  return request<TarefaPendente[]>(`/api/pre-demandas/${preId}/tarefas`);
}

export function createPreDemandaTarefa(preId: string, payload: { descricao: string; tipo: TarefaPendenteTipo }) {
  return request<TarefaPendente>(`/api/pre-demandas/${preId}/tarefas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function concluirPreDemandaTarefa(preId: string, tarefaId: string) {
  return request<TarefaPendente>(`/api/pre-demandas/${preId}/tarefas/${tarefaId}/concluir`, {
    method: "PATCH",
  });
}

export function getAudit(preId: string) {
  return request<PreDemandaAuditRecord[]>(`/api/pre-demandas/${preId}/auditoria`);
}

export function getTimeline(preId: string) {
  return request<TimelineEvent[]>(`/api/pre-demandas/${preId}/timeline`);
}

export function getRecentTimeline(limit = 8) {
  return request<TimelineEvent[]>(`/api/pre-demandas/timeline/recentes?limit=${limit}`);
}

export function getDashboardSummary() {
  return request<PreDemandaDashboardSummary>("/api/pre-demandas/dashboard/resumo");
}

export function listInteressados(params: ListInteressadosParams = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  search.set("page", String(params.page ?? 1));
  search.set("pageSize", String(params.pageSize ?? 10));
  return request<{ items: Interessado[]; total: number; page: number; pageSize: number }>(`/api/interessados?${search.toString()}`);
}

export function createInteressado(payload: { nome: string; matricula?: string | null; cpf?: string | null; data_nascimento?: string | null }) {
  return request<Interessado>("/api/interessados", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInteressado(id: string, payload: { nome: string; matricula?: string | null; cpf?: string | null; data_nascimento?: string | null }) {
  return request<Interessado>(`/api/interessados/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listSetores() {
  return request<Setor[]>("/api/setores");
}

export function createSetor(payload: { sigla: string; nome_completo: string }) {
  return request<Setor>("/api/setores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSetor(id: string, payload: { sigla: string; nome_completo: string }) {
  return request<Setor>(`/api/setores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
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
