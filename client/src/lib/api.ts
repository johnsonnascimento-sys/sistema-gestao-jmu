import type { AuthUser, PreDemanda, PreDemandaAuditRecord, StatusCount } from "../types";

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

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
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

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.message ?? "Falha na requisicao.",
      body.error?.details,
    );
  }

  return body.data;
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

export interface ListPreDemandasParams {
  q?: string;
  status?: string[];
  page?: number;
  pageSize?: number;
}

export function listPreDemandas(params: ListPreDemandasParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.status?.length) {
    searchParams.set("status", params.status.join(","));
  }

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

export function createPreDemanda(payload: {
  solicitante: string;
  assunto: string;
  data_referencia: string;
  descricao?: string;
  fonte?: string;
  observacoes?: string;
}) {
  return request<PreDemanda & { idempotent: boolean }>("/api/pre-demandas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPreDemanda(preId: string) {
  return request<PreDemanda>(`/api/pre-demandas/${preId}`);
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

export function getAudit(preId: string) {
  return request<PreDemandaAuditRecord[]>(`/api/pre-demandas/${preId}/auditoria`);
}
