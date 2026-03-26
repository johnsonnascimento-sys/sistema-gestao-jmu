import type {
  AdminUserAuditRecord,
  AdminUserSummary,
  Andamento,
  Audiencia,
  AppUser,
  DashboardTaskItem,
  DashboardTaskListResult,
  DashboardTaskSortMode,
  DashboardTaskStatusFilter,
  DemandaAssunto,
  DemandaComentario,
  DemandaInteressado,
  DemandaDocumento,
  DemandaNumeroJudicial,
  DemandaSetorFluxo,
  DemandaVinculo,
  DemandaInteressadoPapel,
  DemandaComentarioFormato,
  Interessado,
  Assunto,
  Norma,
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
  TaskScheduleSuggestion,
  TarefaPendente,
  TarefaRecorrenciaTipo,
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
  solicitante?: string;
  pessoaSolicitanteId?: string | null;
  assunto: string;
  dataReferencia: string;
  descricao?: string | null;
  fonte?: string | null;
  observacoes?: string | null;
  prazoProcesso: string;
  prazoInicial?: string | null;
  prazoIntermediario?: string | null;
  prazoFinal?: string | null;
  seiNumero?: string | null;
  numeroJudicial?: string | null;
  assuntoIds?: string[];
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
  deletePendingTasks?: boolean;
  changedByUserId: number;
}

export interface UpdatePreDemandaStatusResult {
  preId: string;
  status: PreDemandaStatus;
  allowedNextStatuses: PreDemandaStatus[];
}

export interface PreDemandaMutationAck {
  preId: string;
}

export interface UpdatePreDemandaCaseDataInput {
  preId: string;
  assunto?: string;
  descricao?: string | null;
  fonte?: string | null;
  observacoes?: string | null;
  prazoProcesso?: string | null;
  prazoInicial?: string | null;
  prazoIntermediario?: string | null;
  prazoFinal?: string | null;
  numeroJudicial?: string | null;
  metadata?: Partial<PreDemandaMetadata>;
}

export interface UpdatePreDemandaAnotacoesInput {
  preId: string;
  anotacoes: string | null;
}

export interface AddNumeroJudicialInput {
  preId: string;
  numeroJudicial: string;
  changedByUserId: number;
}

export interface RemoveNumeroJudicialInput {
  preId: string;
  numeroJudicial: string;
  changedByUserId: number;
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

export interface UpdateAndamentoInput {
  preId: string;
  andamentoId: string;
  descricao: string;
  dataHora?: string | null;
  changedByUserId: number;
}

export interface RemoveAndamentoInput {
  preId: string;
  andamentoId: string;
  changedByUserId: number;
}

export interface CreateTarefaInput {
  preId: string;
  descricao: string;
  tipo: TarefaPendenteTipo;
  prazoConclusao: string;
  horarioInicio?: string | null;
  horarioFim?: string | null;
  recorrenciaTipo?: TarefaRecorrenciaTipo | null;
  recorrenciaDiasSemana?: string[] | null;
  recorrenciaDiaMes?: number | null;
  prazoReferencia?: "prazoInicial" | "prazoIntermediario" | "prazoFinal" | null;
  prazoData?: string | null;
  assuntoId?: string | null;
  procedimentoId?: string | null;
  setorDestinoId?: string | null;
  geradaAutomaticamente?: boolean;
  changedByUserId: number;
}

export interface UpdateTarefaInput {
  preId: string;
  tarefaId: string;
  descricao: string;
  tipo: TarefaPendenteTipo;
  prazoConclusao: string;
  horarioInicio?: string | null;
  horarioFim?: string | null;
  recorrenciaTipo?: TarefaRecorrenciaTipo | null;
  recorrenciaDiasSemana?: string[] | null;
  recorrenciaDiaMes?: number | null;
  prazoReferencia?: "prazoInicial" | "prazoIntermediario" | "prazoFinal" | null;
  prazoData?: string | null;
  changedByUserId: number;
}

export interface ReorderTarefasInput {
  preId: string;
  tarefaIds: string[];
  changedByUserId: number;
}

export interface AddDemandaAssuntoInput {
  preId: string;
  assuntoId: string;
  changedByUserId: number;
}

export interface RemoveDemandaAssuntoInput {
  preId: string;
  assuntoId: string;
  changedByUserId: number;
}

export interface ConcluirTarefaInput {
  preId: string;
  tarefaId: string;
  changedByUserId: number;
}

export interface RemoveTarefaInput {
  preId: string;
  tarefaId: string;
  changedByUserId: number;
}

export interface CreateAudienciaInput {
  preId: string;
  dataHoraInicio: string;
  dataHoraFim?: string | null;
  descricao?: string | null;
  sala?: string | null;
  situacao?: Audiencia["situacao"];
  observacoes?: string | null;
  changedByUserId: number;
}

export interface UpdateAudienciaInput {
  preId: string;
  audienciaId: string;
  dataHoraInicio?: string;
  dataHoraFim?: string | null;
  descricao?: string | null;
  sala?: string | null;
  situacao?: Audiencia["situacao"];
  observacoes?: string | null;
  changedByUserId: number;
}

export interface RemoveAudienciaInput {
  preId: string;
  audienciaId: string;
  changedByUserId: number;
}

export interface PreDemandaAudienciaRepository {
  listAudiencias(preId: string): Promise<Audiencia[]>;
  createAudiencia(input: CreateAudienciaInput): Promise<Audiencia>;
  updateAudiencia(input: UpdateAudienciaInput): Promise<Audiencia>;
  removeAudiencia(input: RemoveAudienciaInput): Promise<{ removedId: string }>;
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
  dueState?: "overdue" | "due_today" | "due_soon" | "none";
  prazoCampo?: "prazoInicial" | "prazoIntermediario" | "prazoFinal";
  deadlineCampo?: "prazoProcesso" | "proximoPrazoTarefa";
  prazoRecorte?: "overdue" | "today" | "soon";
  taskRecurrence?: TarefaRecorrenciaTipo | "sem_recorrencia";
  paymentInvolved?: boolean;
  hasInteressados?: boolean;
  closedWithinDays?: number;
  reopenedWithinDays?: number;
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
  cargo?: string | null;
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

export interface CreateNormaInput {
  numero: string;
  dataNorma: string;
  origem: string;
}

export interface UpdateNormaInput extends CreateNormaInput {
  id: string;
}

export interface CreateAssuntoProcedimentoInput {
  ordem?: number;
  descricao: string;
  horarioInicio?: string | null;
  horarioFim?: string | null;
  setorDestinoId?: string | null;
}

export interface CreateAssuntoInput {
  nome: string;
  descricao?: string | null;
  normaIds?: string[];
  procedimentos?: CreateAssuntoProcedimentoInput[];
}

export interface UpdateAssuntoInput extends CreateAssuntoInput {
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

export interface NormaRepository {
  list(): Promise<Norma[]>;
  getById(id: string): Promise<Norma | null>;
  create(input: CreateNormaInput): Promise<Norma>;
  update(input: UpdateNormaInput): Promise<Norma>;
}

export interface AssuntoRepository {
  list(): Promise<Assunto[]>;
  getById(id: string): Promise<Assunto | null>;
  create(input: CreateAssuntoInput): Promise<Assunto>;
  update(input: UpdateAssuntoInput): Promise<Assunto>;
}

export interface PreDemandaAndamentoRepository {
  listAndamentos(preId: string): Promise<Andamento[]>;
  addAndamento(input: AddAndamentoInput): Promise<Andamento>;
  updateAndamento(input: UpdateAndamentoInput): Promise<Andamento>;
  removeAndamento(input: RemoveAndamentoInput): Promise<{ removedId: string }>;
}

export interface PreDemandaTarefaRepository {
  listTarefas(preId: string): Promise<TarefaPendente[]>;
  listSchedulingSuggestions(params: { preId: string; prazoConclusao?: string | null; limit?: number }): Promise<TaskScheduleSuggestion[]>;
  createTarefa(input: CreateTarefaInput): Promise<TarefaPendente>;
  updateTarefa(input: UpdateTarefaInput): Promise<TarefaPendente>;
  reorderTarefas(input: ReorderTarefasInput): Promise<TarefaPendente[]>;
  removeTarefa(input: RemoveTarefaInput): Promise<{ removedId: string }>;
  concluirTarefa(input: ConcluirTarefaInput): Promise<TarefaPendente>;
}

export interface PreDemandaRepository {
  create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult>;
  list(params: ListPreDemandasParams): Promise<ListPreDemandasResult>;
  getStatusCounts(): Promise<Array<{ status: PreDemandaStatus; total: number }>>;
  getByPreId(preId: string): Promise<PreDemandaDetail | null>;
  updateCaseData(input: UpdatePreDemandaCaseDataInput): Promise<PreDemandaMutationAck>;
  updateAnotacoes(input: UpdatePreDemandaAnotacoesInput): Promise<PreDemandaMutationAck>;
  listAssuntos(preId: string): Promise<DemandaAssunto[]>;
  addAssunto(input: AddDemandaAssuntoInput): Promise<PreDemandaDetail>;
  removeAssunto(input: RemoveDemandaAssuntoInput): Promise<PreDemandaDetail>;
  addInteressado(input: AddDemandaInteressadoInput): Promise<DemandaInteressado[]>;
  removeInteressado(input: RemoveDemandaInteressadoInput): Promise<DemandaInteressado[]>;
  listInteressados(preId: string): Promise<DemandaInteressado[]>;
  addVinculo(input: AddDemandaVinculoInput): Promise<DemandaVinculo[]>;
  removeVinculo(input: RemoveDemandaVinculoInput): Promise<DemandaVinculo[]>;
  listVinculos(preId: string): Promise<DemandaVinculo[]>;
  addNumeroJudicial(input: AddNumeroJudicialInput): Promise<DemandaNumeroJudicial[]>;
  removeNumeroJudicial(input: RemoveNumeroJudicialInput): Promise<DemandaNumeroJudicial[]>;
  tramitar(input: TramitarPreDemandaInput): Promise<PreDemandaMutationAck>;
  concluirTramitacaoSetor(input: ConcluirTramitacaoSetorInput): Promise<PreDemandaMutationAck>;
  listComentarios(preId: string): Promise<DemandaComentario[]>;
  createComentario(input: CreateComentarioInput): Promise<DemandaComentario>;
  updateComentario(input: UpdateComentarioInput): Promise<DemandaComentario>;
  listDocumentos(preId: string): Promise<DemandaDocumento[]>;
  createDocumento(input: CreateDocumentoInput): Promise<DemandaDocumento>;
  removeDocumento(input: RemoveDocumentoInput): Promise<DemandaDocumento[]>;
  downloadDocumento(preId: string, documentoId: string): Promise<DocumentoDownloadResult>;
  listSetoresAtivos(preId: string): Promise<DemandaSetorFluxo[]>;
  listSeiAssociations(preId: string): Promise<SeiAssociation[]>;
  associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult>;
  updateStatus(input: UpdatePreDemandaStatusInput): Promise<UpdatePreDemandaStatusResult>;
  listAudit(preId: string): Promise<PreDemandaAuditRecord[]>;
  listStatusAudit(preId: string): Promise<PreDemandaStatusAuditRecord[]>;
  listTimeline(preId: string): Promise<TimelineEvent[]>;
  listRecentTimeline(limit?: number): Promise<TimelineEvent[]>;
  getDashboardSummary(): Promise<PreDemandaDashboardSummary>;
  listDashboardTasks(params: {
    status: DashboardTaskStatusFilter;
    sort: DashboardTaskSortMode;
    date?: string;
    recurrence?: TarefaRecorrenciaTipo | "sem_recorrencia";
    openWithoutTasksQ?: string;
    page: number;
    pageSize: number;
  }): Promise<DashboardTaskListResult>;
}
