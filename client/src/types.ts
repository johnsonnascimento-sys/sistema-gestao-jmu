export type UserRole = "admin" | "operador";
export type PreDemandaStatus = "em_andamento" | "aguardando_sei" | "encerrada";
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
  | "cadastro.norma.read"
  | "cadastro.norma.write"
  | "cadastro.assunto.read"
  | "cadastro.assunto.write"
  | "admin.ops.read"
  | "admin.ops.update"
  | "admin.user.read"
  | "admin.user.create"
  | "admin.user.update"
  | "admin.user.reset_password";
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
export type TarefaPrazoReferencia = "prazoInicial" | "prazoIntermediario" | "prazoFinal";
export type DemandaSetorFluxoStatus = "ativo" | "concluido";
export type DemandaComentarioFormato = "markdown";
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
  | "vinculo_removed"
  | "document_added"
  | "document_removed"
  | "comment_added";

export interface QueueHealth {
  level: QueueHealthLevel;
  staleDays: number;
  ageDays: number;
  attentionDays: number;
  criticalDays: number;
}

export interface AuditActor {
  id: number;
  email: string;
  name: string;
  role: UserRole;
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
  cargo: string | null;
  matricula: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Pessoa = Interessado;

export interface Norma {
  id: string;
  numero: string;
  dataNorma: string;
  origem: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssuntoProcedimento {
  id: string;
  ordem: number;
  descricao: string;
  setorDestino: Setor | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assunto {
  id: string;
  nome: string;
  descricao: string | null;
  normas: Norma[];
  procedimentos: AssuntoProcedimento[];
  createdAt: string;
  updatedAt: string;
}

export interface DemandaInteressado {
  interessado: Interessado;
  papel: DemandaInteressadoPapel;
  linkedAt: string;
  linkedBy: AuditActor | null;
}

export interface PreDemandaMetadata {
  frequencia: string | null;
  frequenciaDiasSemana: string[] | null;
  frequenciaDiaMes: number | null;
  pagamentoEnvolvido: boolean | null;
  urgente: boolean | null;
  audienciaData: string | null;
  audienciaStatus: string | null;
}

export interface DemandaNumeroJudicial {
  numero: string;
  principal: boolean;
  createdAt: string;
}

export interface PreDemandaSummaryLinked {
  id: number;
  preId: string;
  principalNumero: string;
  assunto: string;
  status: PreDemandaStatus;
  dataReferencia: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemandaVinculo {
  processo: PreDemandaSummaryLinked;
  linkedAt: string;
  linkedBy: AuditActor | null;
}

export interface DemandaSetorFluxo {
  id: string;
  status: DemandaSetorFluxoStatus;
  observacoes: string | null;
  createdAt: string;
  createdBy: AuditActor | null;
  concluidaEm: string | null;
  concluidaPor: AuditActor | null;
  setor: Setor;
  origemSetor: Setor | null;
}

export interface DemandaDocumento {
  id: string;
  preId: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  descricao: string | null;
  createdAt: string;
  createdBy: AuditActor | null;
}

export interface DemandaComentario {
  id: string;
  preId: string;
  conteudo: string;
  formato: DemandaComentarioFormato;
  createdAt: string;
  updatedAt: string;
  createdBy: AuditActor | null;
  editedBy: AuditActor | null;
}

export interface Andamento {
  id: string;
  preId: string;
  dataHora: string;
  descricao: string;
  tipo:
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
  createdBy: AuditActor | null;
}

export interface TarefaPendente {
  id: string;
  preId: string;
  ordem: number;
  descricao: string;
  tipo: TarefaPendenteTipo;
  assuntoId: string | null;
  procedimentoId: string | null;
  prazoReferencia: TarefaPrazoReferencia | null;
  prazoData: string | null;
  setorDestino: Setor | null;
  geradaAutomaticamente: boolean;
  concluida: boolean;
  concluidaEm: string | null;
  concluidaPor: AuditActor | null;
  createdAt: string;
  createdBy: AuditActor | null;
}

export interface DemandaAssunto {
  assunto: Assunto;
  linkedAt: string;
  linkedBy: AuditActor | null;
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
  principal: boolean;
  linkedAt: string;
  updatedAt: string;
  observacoes: string | null;
  linkedBy: AuditActor | null;
}

export interface PreDemanda {
  id: number;
  preId: string;
  solicitante: string;
  pessoaPrincipal: Pessoa | null;
  principalNumero: string;
  principalTipo: "demanda" | "sei";
  assunto: string;
  dataReferencia: string;
  status: PreDemandaStatus;
  descricao: string | null;
  fonte: string | null;
  observacoes: string | null;
  prazoInicial: string | null;
  prazoIntermediario: string | null;
  prazoFinal: string | null;
  dataConclusao: string | null;
  numeroJudicial: string | null;
  anotacoes: string | null;
  setorAtual: Setor | null;
  metadata: PreDemandaMetadata;
  createdAt: string;
  updatedAt: string;
  createdBy: AuditActor | null;
  currentAssociation: SeiAssociation | null;
  assuntos: DemandaAssunto[];
  seiAssociations: SeiAssociation[];
  numerosJudiciais: DemandaNumeroJudicial[];
  queueHealth: QueueHealth;
  allowedNextStatuses: PreDemandaStatus[];
  interessados: DemandaInteressado[];
  vinculos: DemandaVinculo[];
  setoresAtivos: DemandaSetorFluxo[];
  documentos: DemandaDocumento[];
  comentarios: DemandaComentario[];
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

export interface TimelineEvent {
  id: string;
  preId: string;
  principalNumero: string;
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

export interface StatusCount {
  status: PreDemandaStatus;
  total: number;
}

export interface PreDemandaDashboardSummary {
  counts: StatusCount[];
  deadlines: {
    prazoInicial: { overdueTotal: number; dueTodayTotal: number; dueSoonTotal: number; totalDefined: number };
    prazoIntermediario: { overdueTotal: number; dueTodayTotal: number; dueSoonTotal: number; totalDefined: number };
    prazoFinal: { overdueTotal: number; dueTodayTotal: number; dueSoonTotal: number; totalDefined: number };
  };
  reopenedLast30Days: number;
  closedLast30Days: number;
  agingAttentionTotal: number;
  agingCriticalTotal: number;
  dueTodayTotal: number;
  dueSoonTotal: number;
  overdueTotal: number;
  paymentMarkedTotal: number;
  urgentTotal: number;
  withoutSetorTotal: number;
  withoutInteressadosTotal: number;
  staleItems: PreDemanda[];
  awaitingSeiItems: PreDemanda[];
  dueSoonItems: PreDemanda[];
  paymentMarkedItems: PreDemanda[];
  urgentItems: PreDemanda[];
  withoutSetorItems: PreDemanda[];
  withoutInteressadosItems: PreDemanda[];
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

export interface AdminOpsIncidentSummary {
  total: number;
  warnTotal: number;
  errorTotal: number;
  latestOccurredAt: string | null;
  byKind: Array<{
    kind: OperationsIncidentKind;
    total: number;
  }>;
  topPaths: Array<{
    path: string;
    total: number;
  }>;
  clusters: Array<{
    key: string;
    kind: OperationsIncidentKind;
    level: OperationsIncidentLevel;
    path: string | null;
    total: number;
    firstOccurredAt: string;
    lastOccurredAt: string;
  }>;
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

export interface AdminOpsOperationalSummary {
  backupFreshness: "fresh" | "attention" | "critical" | "unknown";
  lastSuccessfulBackupAt: string | null;
  backupAgeHours: number | null;
  lastSuccessfulDeployAt: string | null;
  lastSuccessfulRestoreDrillAt: string | null;
  lastSuccessfulBootstrapAuditAt: string | null;
  lastSuccessfulRollbackAt: string | null;
  lastFailedMonitorAt: string | null;
  lastFailedMonitorMessage: string | null;
  failureCount24h: number;
  failuresByKind24h: Array<{
    kind: OperationalEventKind;
    total: number;
  }>;
  failureClusters24h: Array<{
    key: string;
    kind: OperationalEventKind;
    source: string;
    reference: string | null;
    total: number;
    firstOccurredAt: string;
    lastOccurredAt: string;
    lastMessage: string;
  }>;
}

export interface AdminOpsCaseSetorReportItem {
  setorId: string | null;
  sigla: string | null;
  nome: string | null;
  activeTotal: number;
  previousActiveTotal: number;
  activeDelta: number;
  overdueTotal: number;
  dueSoonTotal: number;
  awaitingSeiTotal: number;
  riskScore: number;
  riskLevel: "normal" | "attention" | "critical";
}

export interface AdminOpsCaseManagementReport {
  periodDays: number;
  createdInPeriod: number;
  closedInPeriod: number;
  tramitacoesInPeriod: number;
  overdueTotal: number;
  dueSoonTotal: number;
  withoutSetorTotal: number;
  withoutInteressadosTotal: number;
  previousPeriod: {
    createdInPeriod: number;
    closedInPeriod: number;
    tramitacoesInPeriod: number;
    overdueTotal: number;
    dueSoonTotal: number;
    withoutSetorTotal: number;
    withoutInteressadosTotal: number;
  };
  deltas: {
    createdInPeriod: number;
    closedInPeriod: number;
    tramitacoesInPeriod: number;
    overdueTotal: number;
    dueSoonTotal: number;
    withoutSetorTotal: number;
    withoutInteressadosTotal: number;
  };
  bySetor: AdminOpsCaseSetorReportItem[];
  prioritySetores: AdminOpsCaseSetorReportItem[];
}

export interface AdminOpsSummary {
  runtime: RuntimeStatus;
  counters: OperationsCounters;
  incidents: OperationsIncident[];
  incidentSummary: AdminOpsIncidentSummary;
  migrations: SchemaMigrationSummary | null;
  queueHealthConfig: QueueHealthConfig;
  backupStatus: BackupStatusSummary;
  operationalEvents: OperationalEvent[];
  operationalSummary: AdminOpsOperationalSummary;
  caseManagementReport: AdminOpsCaseManagementReport;
}
