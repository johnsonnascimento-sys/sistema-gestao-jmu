export type UserRole = "admin" | "operador";
export type AppPermission =
  | "dashboard.read"
  | "pre_demanda.read"
  | "pre_demanda.create"
  | "pre_demanda.update"
  | "pre_demanda.update_status"
  | "pre_demanda.associate_sei"
  | "pre_demanda.read_timeline"
  | "pre_demanda.manage_interessados"
  | "pre_demanda.manage_vinculos"
  | "pre_demanda.manage_tramitacao"
  | "pre_demanda.manage_tarefas"
  | "cadastro.interessado.read"
  | "cadastro.interessado.write"
  | "cadastro.setor.read"
  | "cadastro.setor.write"
  | "admin.ops.read"
  | "admin.ops.update"
  | "admin.user.read"
  | "admin.user.create"
  | "admin.user.update"
  | "admin.user.reset_password";

export interface AuditActor {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface AppUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
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

export type PreDemandaStatus = "aberta" | "aguardando_sei" | "associada" | "encerrada";
export type PreDemandaSortBy =
  | "updatedAt"
  | "createdAt"
  | "dataReferencia"
  | "solicitante"
  | "status"
  | "prazoFinal"
  | "numeroJudicial";
export type SortOrder = "asc" | "desc";
export type QueueHealthLevel = "fresh" | "attention" | "critical" | "closed";
export type DemandaInteressadoPapel = "solicitante" | "interessado";
export type TarefaPendenteTipo = "fixa" | "livre";
export type AndamentoTipo =
  | "manual"
  | "tramitacao"
  | "tarefa_concluida"
  | "status"
  | "sistema"
  | "interessado_added"
  | "interessado_removed"
  | "vinculo_added"
  | "vinculo_removed"
  | "sei";

export interface QueueHealth {
  level: QueueHealthLevel;
  staleDays: number;
  ageDays: number;
  attentionDays: number;
  criticalDays: number;
}

export interface Setor {
  id: string;
  sigla: string;
  nomeCompleto: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interessado {
  id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreDemandaMetadata {
  frequencia: string | null;
  pagamentoEnvolvido: boolean | null;
  audienciaData: string | null;
  audienciaStatus: string | null;
}

export interface PreDemandaSummaryLinked {
  id: number;
  preId: string;
  assunto: string;
  status: PreDemandaStatus;
  dataReferencia: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemandaInteressado {
  interessado: Interessado;
  papel: DemandaInteressadoPapel;
  linkedAt: string;
  linkedBy: AuditActor | null;
}

export interface DemandaVinculo {
  processo: PreDemandaSummaryLinked;
  linkedAt: string;
  linkedBy: AuditActor | null;
}

export interface Andamento {
  id: string;
  preId: string;
  dataHora: string;
  descricao: string;
  tipo: AndamentoTipo;
  createdBy: AuditActor | null;
}

export interface TarefaPendente {
  id: string;
  preId: string;
  descricao: string;
  tipo: TarefaPendenteTipo;
  concluida: boolean;
  concluidaEm: string | null;
  concluidaPor: AuditActor | null;
  createdAt: string;
  createdBy: AuditActor | null;
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
  prazoFinal: string | null;
  dataConclusao: string | null;
  numeroJudicial: string | null;
  anotacoes: string | null;
  setorAtual: Setor | null;
  metadata: PreDemandaMetadata;
  createdAt: string;
  updatedAt: string;
  createdBy: AuditActor | null;
  queueHealth: QueueHealth;
  allowedNextStatuses: PreDemandaStatus[];
}

export interface SeiAssociation {
  preId: string;
  seiNumero: string;
  linkedAt: string;
  updatedAt: string;
  observacoes: string | null;
  linkedBy: AuditActor | null;
}

export interface PreDemandaDetail extends PreDemanda {
  currentAssociation: SeiAssociation | null;
  interessados: DemandaInteressado[];
  vinculos: DemandaVinculo[];
  tarefasPendentes: TarefaPendente[];
  recentAndamentos: Andamento[];
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

export interface PreDemandaStatusAuditRecord {
  id: number;
  preId: string;
  statusAnterior: PreDemandaStatus;
  statusNovo: PreDemandaStatus;
  motivo: string | null;
  observacoes: string | null;
  registradoEm: string;
  changedBy: AuditActor | null;
}

export interface PreDemandaDashboardSummary {
  counts: Array<{ status: PreDemandaStatus; total: number }>;
  reopenedLast30Days: number;
  closedLast30Days: number;
  agingAttentionTotal: number;
  agingCriticalTotal: number;
  dueSoonTotal: number;
  overdueTotal: number;
  withoutSetorTotal: number;
  withoutInteressadosTotal: number;
  staleItems: PreDemandaDetail[];
  awaitingSeiItems: PreDemandaDetail[];
  dueSoonItems: PreDemandaDetail[];
  withoutSetorItems: PreDemandaDetail[];
  withoutInteressadosItems: PreDemandaDetail[];
  recentTimeline: TimelineEvent[];
}

export interface QueueHealthConfig {
  attentionDays: number;
  criticalDays: number;
  updatedAt: string | null;
  updatedBy: AuditActor | null;
  source: "database" | "fallback";
}

export interface RuntimeStatus {
  status: "up" | "ready";
  environment: "development" | "test" | "production";
  version: string;
  commitSha: string | null;
  startedAt: string;
  checkedAt: string;
  uptimeSeconds: number;
  database?: {
    status: "ready" | "error";
    checkedAt: string;
    latencyMs?: number;
    message?: string | null;
  };
}

export type OperationsIncidentKind = "auth_failure" | "server_error" | "database_readiness_failure";
export type OperationsIncidentLevel = "warn" | "error";

export interface OperationsIncident {
  id: string;
  kind: OperationsIncidentKind;
  level: OperationsIncidentLevel;
  message: string;
  occurredAt: string;
  requestId: string | null;
  userId: number | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
}

export interface OperationsCounters {
  requestsTotal: number;
  successfulRequestsTotal: number;
  clientErrorsTotal: number;
  serverErrorsTotal: number;
  loginSuccessTotal: number;
  loginFailuresTotal: number;
  authFailuresTotal: number;
  readyChecksFailedTotal: number;
  unhandledErrorsTotal: number;
}

export type SchemaMigrationState = "applied" | "pending" | "drifted";

export interface SchemaMigrationItem {
  version: string;
  state: SchemaMigrationState;
  appliedAt: string | null;
}

export interface SchemaMigrationSummary {
  totalFiles: number;
  appliedCount: number;
  pendingCount: number;
  driftedCount: number;
  items: SchemaMigrationItem[];
}

export interface BackupArtifactSummary {
  fileName: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface BackupStatusSummary {
  directory: string;
  schemaName: string;
  visible: boolean;
  lastBackup: BackupArtifactSummary | null;
  recentBackups: BackupArtifactSummary[];
  message: string | null;
}

export type OperationalEventKind = "backup" | "restore" | "restore_drill" | "deploy" | "rollback" | "monitor" | "bootstrap_audit";
export type OperationalEventStatus = "success" | "failure";

export interface OperationalEvent {
  id: string;
  kind: OperationalEventKind;
  status: OperationalEventStatus;
  source: string;
  message: string;
  reference: string | null;
  occurredAt: string;
}

export interface AdminOpsSummary {
  runtime: RuntimeStatus;
  counters: OperationsCounters;
  incidents: OperationsIncident[];
  migrations: SchemaMigrationSummary | null;
  queueHealthConfig: QueueHealthConfig;
  backupStatus: BackupStatusSummary;
  operationalEvents: OperationalEvent[];
}

export type TimelineEventType =
  | "created"
  | "status_changed"
  | "sei_linked"
  | "sei_reassociated"
  | "andamento"
  | "tramitation"
  | "task_completed"
  | "interessado_added"
  | "interessado_removed"
  | "vinculo_added"
  | "vinculo_removed";

export interface TimelineEvent {
  id: string;
  preId: string;
  type: TimelineEventType;
  occurredAt: string;
  actor: AuditActor | null;
  motivo: string | null;
  observacoes: string | null;
  descricao: string | null;
  statusAnterior: PreDemandaStatus | null;
  statusNovo: PreDemandaStatus | null;
  seiNumeroAnterior: string | null;
  seiNumeroNovo: string | null;
}
