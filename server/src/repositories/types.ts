import type {
  AdminUserAuditRecord,
  AdminUserSummary,
  Andamento,
  AppUser,
  DemandaComentario,
  DemandaInteressado,
  DemandaDocumento,
  DemandaSetorFluxo,
  DemandaVinculo,
  DemandaInteressadoPapel,
  DemandaComentarioFormato,
  Interessado,
  PreDemandaDashboardSummary,
  PreDemandaAuditRecord,
  PreDemandaDetail,
  PreDemandaMetadata,
  QueueHealthLevel,
  QueueHealthConfig,
  PreDemandaSortBy,
  PreDemandaStatusAuditRecord,
  PreDemandaStatus,
  Setor,
  SeiAssociation,
  SortOrder,
  TarefaPendente,
  TarefaPendenteTipo,
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
  prazoFinal?: string | null;
  seiNumero?: string | null;
  numeroJudicial?: string | null;
  metadata?: Partial<PreDemandaMetadata> | null;
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

export interface UpdatePreDemandaCaseDataInput {
  preId: string;
  assunto?: string;
  descricao?: string | null;
  fonte?: string | null;
  observacoes?: string | null;
  prazoFinal?: string | null;
  numeroJudicial?: string | null;
  metadata?: Partial<PreDemandaMetadata>;
}

export interface UpdatePreDemandaAnotacoesInput {
  preId: string;
  anotacoes: string | null;
}

export interface AddDemandaInteressadoInput {
  preId: string;
  interessadoId: string;
  papel: DemandaInteressadoPapel;
  changedByUserId: number;
}

export interface RemoveDemandaInteressadoInput {
  preId: string;
  interessadoId: string;
  changedByUserId: number;
}

export interface AddDemandaVinculoInput {
  preId: string;
  destinoPreId: string;
  changedByUserId: number;
}

export interface RemoveDemandaVinculoInput {
  preId: string;
  destinoPreId: string;
  changedByUserId: number;
}

export interface TramitarPreDemandaInput {
  preId: string;
  setorDestinoIds: string[];
  observacoes?: string | null;
  changedByUserId: number;
}

export interface ConcluirTramitacaoSetorInput {
  preId: string;
  setorId: string;
  observacoes?: string | null;
  changedByUserId: number;
}

export interface AddAndamentoInput {
  preId: string;
  descricao: string;
  dataHora?: string | null;
  changedByUserId: number;
}

export interface CreateTarefaInput {
  preId: string;
  descricao: string;
  tipo: TarefaPendenteTipo;
  changedByUserId: number;
}

export interface ConcluirTarefaInput {
  preId: string;
  tarefaId: string;
  changedByUserId: number;
}

export interface CreateComentarioInput {
  preId: string;
  conteudo: string;
  formato: DemandaComentarioFormato;
  changedByUserId: number;
}

export interface UpdateComentarioInput {
  preId: string;
  comentarioId: string;
  conteudo: string;
  changedByUserId: number;
}

export interface CreateDocumentoInput {
  preId: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  descricao?: string | null;
  conteudo: Buffer;
  changedByUserId: number;
}

export interface RemoveDocumentoInput {
  preId: string;
  documentoId: string;
  changedByUserId: number;
}

export interface DocumentoDownloadResult {
  documento: DemandaDocumento;
  conteudo: Buffer;
}

export interface ListPreDemandasParams {
  q?: string;
  statuses?: PreDemandaStatus[];
  queueHealthLevels?: QueueHealthLevel[];
  dateFrom?: string;
  dateTo?: string;
  hasSei?: boolean;
  setorAtualId?: string;
  withoutSetor?: boolean;
  dueState?: "overdue" | "due_soon" | "none";
  hasInteressados?: boolean;
  sortBy?: PreDemandaSortBy;
  sortOrder?: SortOrder;
  page: number;
  pageSize: number;
}

export interface ListPreDemandasResult {
  items: PreDemandaDetail[];
  total: number;
}

export interface ListInteressadosParams {
  q?: string;
  page: number;
  pageSize: number;
}

export interface ListInteressadosResult {
  items: Interessado[];
  total: number;
}

export interface CreateInteressadoInput {
  nome: string;
  matricula?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
}

export interface UpdateInteressadoInput extends CreateInteressadoInput {
  id: string;
}

export interface CreateSetorInput {
  sigla: string;
  nomeCompleto: string;
}

export interface UpdateSetorInput extends CreateSetorInput {
  id: string;
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

export interface UpdateQueueHealthConfigInput {
  attentionDays: number;
  criticalDays: number;
  updatedByUserId: number;
}

export interface SettingsRepository {
  getQueueHealthConfig(): Promise<QueueHealthConfig>;
  updateQueueHealthConfig(input: UpdateQueueHealthConfigInput): Promise<QueueHealthConfig>;
}

export interface InteressadoRepository {
  list(params: ListInteressadosParams): Promise<ListInteressadosResult>;
  getById(id: string): Promise<Interessado | null>;
  create(input: CreateInteressadoInput): Promise<Interessado>;
  update(input: UpdateInteressadoInput): Promise<Interessado>;
}

export interface SetorRepository {
  list(): Promise<Setor[]>;
  getById(id: string): Promise<Setor | null>;
  create(input: CreateSetorInput): Promise<Setor>;
  update(input: UpdateSetorInput): Promise<Setor>;
}

export interface PreDemandaRepository {
  create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult>;
  list(params: ListPreDemandasParams): Promise<ListPreDemandasResult>;
  getStatusCounts(): Promise<Array<{ status: PreDemandaStatus; total: number }>>;
  getByPreId(preId: string): Promise<PreDemandaDetail | null>;
  updateCaseData(input: UpdatePreDemandaCaseDataInput): Promise<PreDemandaDetail>;
  updateAnotacoes(input: UpdatePreDemandaAnotacoesInput): Promise<PreDemandaDetail>;
  addInteressado(input: AddDemandaInteressadoInput): Promise<DemandaInteressado[]>;
  removeInteressado(input: RemoveDemandaInteressadoInput): Promise<DemandaInteressado[]>;
  addVinculo(input: AddDemandaVinculoInput): Promise<DemandaVinculo[]>;
  removeVinculo(input: RemoveDemandaVinculoInput): Promise<DemandaVinculo[]>;
  tramitar(input: TramitarPreDemandaInput): Promise<PreDemandaDetail>;
  concluirTramitacaoSetor(input: ConcluirTramitacaoSetorInput): Promise<PreDemandaDetail>;
  addAndamento(input: AddAndamentoInput): Promise<Andamento>;
  listTarefas(preId: string): Promise<TarefaPendente[]>;
  createTarefa(input: CreateTarefaInput): Promise<TarefaPendente>;
  concluirTarefa(input: ConcluirTarefaInput): Promise<TarefaPendente>;
  listComentarios(preId: string): Promise<DemandaComentario[]>;
  createComentario(input: CreateComentarioInput): Promise<DemandaComentario>;
  updateComentario(input: UpdateComentarioInput): Promise<DemandaComentario>;
  listDocumentos(preId: string): Promise<DemandaDocumento[]>;
  createDocumento(input: CreateDocumentoInput): Promise<DemandaDocumento>;
  removeDocumento(input: RemoveDocumentoInput): Promise<DemandaDocumento[]>;
  downloadDocumento(preId: string, documentoId: string): Promise<DocumentoDownloadResult>;
  listSetoresAtivos(preId: string): Promise<DemandaSetorFluxo[]>;
  associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult>;
  updateStatus(input: UpdatePreDemandaStatusInput): Promise<UpdatePreDemandaStatusResult>;
  listAudit(preId: string): Promise<PreDemandaAuditRecord[]>;
  listStatusAudit(preId: string): Promise<PreDemandaStatusAuditRecord[]>;
  listTimeline(preId: string): Promise<TimelineEvent[]>;
  listRecentTimeline(limit?: number): Promise<TimelineEvent[]>;
  getDashboardSummary(): Promise<PreDemandaDashboardSummary>;
}
