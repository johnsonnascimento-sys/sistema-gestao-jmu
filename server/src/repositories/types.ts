import type {
  AdminUserAuditRecord,
  AdminUserSummary,
  AppUser,
  PreDemandaDashboardSummary,
  PreDemanda,
  PreDemandaAuditRecord,
  PreDemandaDetail,
  PreDemandaSortBy,
  PreDemandaStatusAuditRecord,
  PreDemandaStatus,
  SeiAssociation,
  SortOrder,
  TimelineEvent,
} from "../domain/types";

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "operador";
  changedByUserId?: number | null;
}

export interface UpdateUserInput {
  id: number;
  name?: string;
  role?: "admin" | "operador";
  active?: boolean;
  changedByUserId?: number | null;
}

export interface ResetUserPasswordInput {
  id: number;
  passwordHash: string;
  changedByUserId?: number | null;
}

export interface CreatePreDemandaInput {
  solicitante: string;
  assunto: string;
  dataReferencia: string;
  descricao?: string | null;
  fonte?: string | null;
  observacoes?: string | null;
  createdByUserId: number;
}

export interface CreatePreDemandaResult {
  record: PreDemandaDetail;
  idempotent: boolean;
  existingPreId: string | null;
}

export interface AssociateSeiInput {
  preId: string;
  seiNumero: string;
  motivo?: string | null;
  observacoes?: string | null;
  changedByUserId: number;
}

export interface AssociateSeiResult {
  association: SeiAssociation;
  audited: boolean;
}

export interface UpdatePreDemandaStatusInput {
  preId: string;
  status: PreDemandaStatus;
  motivo?: string | null;
  observacoes?: string | null;
  changedByUserId: number;
}

export interface UpdatePreDemandaStatusResult {
  record: PreDemandaDetail;
}

export interface ListPreDemandasParams {
  q?: string;
  statuses?: PreDemandaStatus[];
  dateFrom?: string;
  dateTo?: string;
  hasSei?: boolean;
  sortBy?: PreDemandaSortBy;
  sortOrder?: SortOrder;
  page: number;
  pageSize: number;
}

export interface ListPreDemandasResult {
  items: PreDemandaDetail[];
  total: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<AppUser | null>;
  findById(id: number): Promise<AppUser | null>;
  create(input: CreateUserInput): Promise<AppUser>;
  list(): Promise<AdminUserSummary[]>;
  listAudit(limit?: number): Promise<AdminUserAuditRecord[]>;
  update(input: UpdateUserInput): Promise<AdminUserSummary>;
  resetPassword(input: ResetUserPasswordInput): Promise<AdminUserSummary>;
}

export interface PreDemandaRepository {
  create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult>;
  list(params: ListPreDemandasParams): Promise<ListPreDemandasResult>;
  getStatusCounts(): Promise<Array<{ status: PreDemandaStatus; total: number }>>;
  getByPreId(preId: string): Promise<PreDemandaDetail | null>;
  associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult>;
  updateStatus(input: UpdatePreDemandaStatusInput): Promise<UpdatePreDemandaStatusResult>;
  listAudit(preId: string): Promise<PreDemandaAuditRecord[]>;
  listStatusAudit(preId: string): Promise<PreDemandaStatusAuditRecord[]>;
  listTimeline(preId: string): Promise<TimelineEvent[]>;
  listRecentTimeline(limit?: number): Promise<TimelineEvent[]>;
  getDashboardSummary(): Promise<PreDemandaDashboardSummary>;
}
