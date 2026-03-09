export type UserRole = "admin" | "operador";
export type PreDemandaStatus = "aberta" | "aguardando_sei" | "associada" | "encerrada";
export type AppPermission =
  | "dashboard.read"
  | "pre_demanda.read"
  | "pre_demanda.create"
  | "pre_demanda.update_status"
  | "pre_demanda.associate_sei"
  | "pre_demanda.read_timeline"
  | "admin.user.read"
  | "admin.user.create"
  | "admin.user.update"
  | "admin.user.reset_password";
export type PreDemandaSortBy = "updatedAt" | "createdAt" | "dataReferencia" | "solicitante" | "status";
export type SortOrder = "asc" | "desc";

export interface AuditActor {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  permissions: AppPermission[];
}

export interface AdminUserSummary {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserAuditTarget {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export type AdminUserAuditAction =
  | "user_created"
  | "user_name_changed"
  | "user_role_changed"
  | "user_activated"
  | "user_deactivated"
  | "user_password_reset";

export interface AdminUserAuditRecord {
  id: number;
  action: AdminUserAuditAction;
  actor: AuditActor | null;
  targetUser: AdminUserAuditTarget;
  nameAnterior: string | null;
  nameNovo: string | null;
  roleAnterior: UserRole | null;
  roleNovo: UserRole | null;
  activeAnterior: boolean | null;
  activeNovo: boolean | null;
  registradoEm: string;
}

export interface SeiAssociation {
  preId: string;
  seiNumero: string;
  linkedAt: string;
  updatedAt: string;
  observacoes: string | null;
  linkedBy: AuditActor | null;
}

export interface PreDemanda {
  id: number;
  preId: string;
  solicitante: string;
  assunto: string;
  dataReferencia: string;
  status: PreDemandaStatus;
  descricao: string | null;
  fonte: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: AuditActor | null;
  currentAssociation: SeiAssociation | null;
}

export interface PreDemandaAuditRecord {
  id: number;
  preId: string;
  seiNumeroAnterior: string;
  seiNumeroNovo: string;
  motivo: string | null;
  observacoes: string | null;
  registradoEm: string;
  changedBy: AuditActor | null;
}

export interface PreDemandaDashboardSummary {
  counts: StatusCount[];
  reopenedLast30Days: number;
  closedLast30Days: number;
  awaitingSeiItems: PreDemanda[];
  recentTimeline: TimelineEvent[];
}

export type TimelineEventType = "created" | "status_changed" | "sei_linked" | "sei_reassociated";

export interface TimelineEvent {
  id: string;
  preId: string;
  type: TimelineEventType;
  occurredAt: string;
  actor: AuditActor | null;
  motivo: string | null;
  observacoes: string | null;
  statusAnterior: PreDemandaStatus | null;
  statusNovo: PreDemandaStatus | null;
  seiNumeroAnterior: string | null;
  seiNumeroNovo: string | null;
}

export interface StatusCount {
  status: PreDemandaStatus;
  total: number;
}
