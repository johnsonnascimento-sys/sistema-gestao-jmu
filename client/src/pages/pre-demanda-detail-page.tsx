import {
  Building2,
  CalendarClock,
  CheckCircle,
  Edit,
  FilePlus2,
  Files,
  GitBranch,
  LayoutDashboard,
  Link as LinkIcon,
  ListTodo,
  MessageSquareText,
  Plus,
  RotateCcw,
  Send,
  StickyNote,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth-context";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FormField } from "../components/form-field";
import { DeadlineStatusPill } from "../components/deadline-status-pill";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Timeline } from "../components/timeline";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DetailSectionCard,
  SummaryItem,
  ToolbarActionButton,
} from "./pre-demanda-detail-ui";
import {
  AndamentoCreateDialog,
  AndamentoDeleteDialog,
  AndamentoEditDialog,
  TarefaDeleteDialog,
  TarefaPrazoChangeDialog,
  TarefasDialog,
} from "./pre-demanda-detail-dialogs";
import {
  FIXED_TASKS,
  formatBytes,
  formatRecorrenciaLabel,
  getTaskSignal,
  readFileAsBase64,
  selectClassName,
  StatusAction,
  TaskPrazoChangeState,
  toDateTimeLocalValue,
  toIsoFromDateTimeLocal,
  ToolbarDialog,
  WEEKDAY_OPTIONS,
} from "./pre-demanda-detail-types";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  addPreDemandaAndamento,
  addPreDemandaAssunto,
  addPreDemandaInteressado,
  addPreDemandaVinculo,
  associateSei,
  concluirTramitacaoSetor,
  concluirPreDemandaTarefa,
  createPessoa,
  createPreDemandaAudiencia,
  createPreDemandaComentario,
  createPreDemandaDocumento,
  createPreDemanda,
  createPreDemandaTarefa,
  downloadPreDemandaDocumento,
  formatAppError,
  getPreDemanda,
  getTimeline,
  listPreDemandaAssuntos,
  listPreDemandaAssuntosCatalogo,
  listPreDemandaAudiencias,
  listPreDemandaInteressados,
  listPreDemandaSeiAssociations,
  listPreDemandaSetoresAtivos,
  listPreDemandaTaskScheduleSuggestions,
  listPreDemandaTarefas,
  listPreDemandaVinculos,
  listPreDemandaComentarios,
  listPreDemandaDocumentos,
  listPessoas,
  listPreDemandas,
  listSetores,
  removePreDemandaDocumento,
  removePreDemandaAudiencia,
  removePreDemandaAndamento,
  removePreDemandaAssunto,
  removePreDemandaInteressado,
  removePreDemandaTarefa,
  removePreDemandaVinculo,
  reorderPreDemandaTarefas,
  tramitarPreDemandaMultiplos,
  updatePreDemandaAnotacoes,
  updatePreDemandaAudiencia,
  updatePreDemandaAndamento,
  updatePreDemandaCase,
  updatePreDemandaTarefa,
  updatePreDemandaStatus,
  type AutoReopenInfo,
} from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { formatDateOnlyPtBr } from "../lib/date";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";
import {
  deadlineSignalLabel,
  deadlineSignalTone,
  getDeadlineSignal,
} from "../lib/deadline-signal";
import {
  formatNumeroJudicialInput,
  normalizeNumeroJudicialValue,
} from "../lib/numero-judicial";
import {
  formatAllowedStatuses,
  getPreferredReopenStatus,
  getPreDemandaStatusLabel,
} from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import { formatSeiInput, isValidSei, normalizeSeiValue } from "../lib/sei";
import type {
  Andamento,
  Assunto,
  Audiencia,
  AudienciaSituacao,
  Interessado,
  PreDemanda,
  PreDemandaStatus,
  Setor,
  TaskScheduleSuggestion,
  TarefaPendente,
  TarefaRecorrenciaTipo,
  TimelineEvent,
} from "../types";

type AudienciaForm = {
  inicio: string;
  fim: string;
  sala: string;
  descricao: string;
  situacao: AudienciaSituacao;
  observacoes: string;
};

const AUDIENCIA_FORM_DEFAULT: AudienciaForm = {
  inicio: "",
  fim: "",
  sala: "",
  descricao: "",
  situacao: "designada",
  observacoes: "",
};

function formatTaskTimeLabel(
  task: Pick<TarefaPendente, "horarioInicio" | "horarioFim">,
) {
  if (task.horarioInicio && task.horarioFim) {
    return `${task.horarioInicio} - ${task.horarioFim}`;
  }
  if (task.horarioInicio) {
    return `Inicio ${task.horarioInicio}`;
  }
  if (task.horarioFim) {
    return `Termino ${task.horarioFim}`;
  }
  return null;
}

function formatDateTimePtBrSafe(value: unknown, fallback = "-") {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR");
}

function composeAutoReopenSuccessMessage(
  baseMessage: string,
  autoReopen: AutoReopenInfo | null,
) {
  if (!autoReopen) {
    return baseMessage;
  }

  return `${baseMessage} O processo foi reaberto automaticamente.`;
}

export function PreDemandaDetailPage() {
  const { preId = "" } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [record, setRecord] = useState<PreDemanda | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [assuntosLinked, setAssuntosLinked] = useState<PreDemanda["assuntos"]>(
    [],
  );
  const [tarefas, setTarefas] = useState<PreDemanda["tarefasPendentes"]>([]);
  const [audiencias, setAudiencias] = useState<PreDemanda["audiencias"]>([]);
  const [documentos, setDocumentos] = useState<PreDemanda["documentos"]>([]);
  const [comentarios, setComentarios] = useState<PreDemanda["comentarios"]>([]);
  const [interessados, setInteressados] = useState<PreDemanda["interessados"]>(
    [],
  );
  const [seiAssociations, setSeiAssociations] = useState<
    PreDemanda["seiAssociations"]
  >([]);
  const [vinculos, setVinculos] = useState<PreDemanda["vinculos"]>([]);
  const [setoresAtivos, setSetoresAtivos] = useState<
    PreDemanda["setoresAtivos"]
  >([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [assuntosCatalogo, setAssuntosCatalogo] = useState<Assunto[]>([]);
  const [interessadoResults, setInteressadoResults] = useState<Interessado[]>(
    [],
  );
  const [linkedProcessResults, setLinkedProcessResults] = useState<
    PreDemanda[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toolbarDialog, setToolbarDialog] = useState<ToolbarDialog>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [editingAndamento, setEditingAndamento] = useState<Andamento | null>(
    null,
  );
  const [deleteAndamento, setDeleteAndamento] = useState<Andamento | null>(
    null,
  );
  const [editingTask, setEditingTask] = useState<TarefaPendente | null>(null);
  const [deleteTask, setDeleteTask] = useState<TarefaPendente | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reopenAlert, setReopenAlert] = useState<string | null>(null);
  const [associationForm, setAssociationForm] = useState({
    sei_numero: "",
    motivo: "",
    observacoes: "",
  });
  const [editForm, setEditForm] = useState({
    assunto: "",
    descricao: "",
    fonte: "",
    observacoes: "",
    numero_judicial: "",
    prazo_processo: "",
    pagamento_envolvido: false,
    urgente: false,
  });
  const [audienciaForm, setAudienciaForm] = useState<AudienciaForm>(
    AUDIENCIA_FORM_DEFAULT,
  );
  const [editingAudienciaId, setEditingAudienciaId] = useState<string | null>(
    null,
  );
  const [notesForm, setNotesForm] = useState("");
  const [deadlineForm, setDeadlineForm] = useState({
    prazo_processo: "",
  });
  const [tramitarSetorIds, setTramitarSetorIds] = useState<string[]>([]);
  const [andamentoForm, setAndamentoForm] = useState({
    descricao: "",
    data_hora: "",
  });
  const [editAndamentoForm, setEditAndamentoForm] = useState({
    descricao: "",
    data_hora: "",
  });
  const [deleteAndamentoConfirm, setDeleteAndamentoConfirm] = useState("");
  const [taskForm, setTaskForm] = useState({
    descricao: "",
    tipo: "livre" as "fixa" | "livre",
    urgente: false,
    prazo_conclusao: "",
    horario_inicio: "",
    horario_fim: "",
    recorrencia_tipo: "" as "" | TarefaRecorrenciaTipo,
    recorrencia_dias_semana: [] as string[],
    recorrencia_dia_mes: "",
    setor_destino_id: "",
    assinatura_interessado_id: "",
  });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    descricao: "",
    tipo: "livre" as "fixa" | "livre",
    urgente: false,
    prazo_conclusao: "",
    horario_inicio: "",
    horario_fim: "",
    recorrencia_tipo: "" as "" | TarefaRecorrenciaTipo,
    recorrencia_dias_semana: [] as string[],
    recorrencia_dia_mes: "",
  });
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState("");
  const [taskPrazoChange, setTaskPrazoChange] =
    useState<TaskPrazoChangeState | null>(null);
  const [taskSuggestions, setTaskSuggestions] = useState<
    TaskScheduleSuggestion[]
  >([]);
  const [taskSuggestionsLoading, setTaskSuggestionsLoading] = useState(false);
  const [commentForm, setCommentForm] = useState("");
  const [documentForm, setDocumentForm] = useState<{
    file: File | null;
    descricao: string;
  }>({ file: null, descricao: "" });
  const [interessadoSearch, setInteressadoSearch] = useState("");
  const [signatureSearch, setSignatureSearch] = useState("");
  const [signatureSearchResults, setSignatureSearchResults] = useState<
    Interessado[]
  >([]);
  const [signatureExpanded, setSignatureExpanded] = useState(false);
  const [signatureSelectedName, setSignatureSelectedName] = useState("");
  const [newInteressadoForm, setNewInteressadoForm] = useState({
    nome: "",
    cargo: "",
    matricula: "",
    cpf: "",
  });
  const [processSearch, setProcessSearch] = useState("");
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [assuntosLoaded, setAssuntosLoaded] = useState(false);
  const [assuntosCatalogoLoaded, setAssuntosCatalogoLoaded] = useState(false);
  const [tarefasLoaded, setTarefasLoaded] = useState(false);
  const [audienciasLoaded, setAudienciasLoaded] = useState(false);
  const [interessadosLoaded, setInteressadosLoaded] = useState(false);
  const [seiLoaded, setSeiLoaded] = useState(false);
  const [relatedLoaded, setRelatedLoaded] = useState(false);
  const [activeSetoresLoaded, setActiveSetoresLoaded] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [assuntosLoading, setAssuntosLoading] = useState(false);
  const [assuntosCatalogoLoading, setAssuntosCatalogoLoading] = useState(false);
  const [tarefasLoading, setTarefasLoading] = useState(false);
  const [audienciasLoading, setAudienciasLoading] = useState(false);
  const [interessadosLoading, setInteressadosLoading] = useState(false);
  const [seiLoading, setSeiLoading] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [activeSetoresLoading, setActiveSetoresLoading] = useState(false);
  const assuntosRequestIdRef = useRef(0);
  const assuntosCatalogoRequestIdRef = useRef(0);
  const isSeiValid = isValidSei(associationForm.sei_numero);

  function openTaskEditor(task: TarefaPendente) {
    setToolbarDialog("tasks");
    setEditingTask(task);
  }

  function syncRecordDependentState(nextRecord: PreDemanda) {
    setAssociationForm((current) => ({
      ...current,
      sei_numero:
        nextRecord.currentAssociation?.seiNumero ??
        normalizeSeiValue(current.sei_numero),
    }));
    setEditForm({
      assunto: nextRecord.assunto,
      descricao: nextRecord.descricao ?? "",
      fonte: nextRecord.fonte ?? "",
      observacoes: nextRecord.observacoes ?? "",
      numero_judicial:
        normalizeNumeroJudicialValue(nextRecord.numeroJudicial) ?? "",
      prazo_processo: nextRecord.prazoProcesso ?? "",
      pagamento_envolvido: nextRecord.metadata.pagamentoEnvolvido ?? false,
      urgente: nextRecord.metadata.urgente ?? false,
    });
    setNotesForm(nextRecord.anotacoes ?? "");
    setDeadlineForm({
      prazo_processo: nextRecord.prazoProcesso ?? "",
    });
  }

  function syncAssuntosState(nextAssuntos: PreDemanda["assuntos"]) {
    setAssuntosLinked(nextAssuntos);
    setAssuntosLoaded(true);
    setRecord((current) =>
      current ? { ...current, assuntos: nextAssuntos } : current,
    );
  }

  async function loadRecordData(showLoading = false) {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const nextRecord = await getPreDemanda(preId);
      setRecord(nextRecord);
      syncRecordDependentState(nextRecord);
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar processo."));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function loadTimelineData() {
    try {
      const nextTimeline = await getTimeline(preId);
      setTimeline(nextTimeline);
    } catch {
      // Timeline is loaded in the background to keep the detail page responsive.
    }
  }

  async function loadCatalogData() {
    try {
      const nextSetores = await listSetores();
      setSetores(nextSetores);
    } catch {
      setSetores([]);
    }
  }

  async function loadDocumentosData(force = false) {
    if (!force && (documentsLoaded || documentsLoading)) {
      return;
    }

    setDocumentsLoading(true);
    try {
      const nextDocumentos = await listPreDemandaDocumentos(preId);
      setDocumentos(nextDocumentos);
      setDocumentsLoaded(true);
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function loadAssuntosData(force = false) {
    if (!force && (assuntosLoaded || assuntosLoading)) {
      return;
    }

    const requestId = ++assuntosRequestIdRef.current;
    setAssuntosLoading(true);
    try {
      const nextAssuntos = await listPreDemandaAssuntos(preId);
      if (requestId !== assuntosRequestIdRef.current) {
        return;
      }
      syncAssuntosState(nextAssuntos);
    } finally {
      if (requestId === assuntosRequestIdRef.current) {
        setAssuntosLoading(false);
      }
    }
  }

  async function loadAssuntosCatalogoData(force = false) {
    if (!force && (assuntosCatalogoLoaded || assuntosCatalogoLoading)) {
      return;
    }

    const requestId = ++assuntosCatalogoRequestIdRef.current;
    setAssuntosCatalogoLoading(true);
    try {
      const nextAssuntosCatalogo = await listPreDemandaAssuntosCatalogo(preId);
      if (requestId !== assuntosCatalogoRequestIdRef.current) {
        return;
      }
      setAssuntosCatalogo(nextAssuntosCatalogo);
      setAssuntosCatalogoLoaded(true);
    } catch {
      if (requestId === assuntosCatalogoRequestIdRef.current) {
        setAssuntosCatalogo([]);
        setAssuntosCatalogoLoaded(false);
      }
    } finally {
      if (requestId === assuntosCatalogoRequestIdRef.current) {
        setAssuntosCatalogoLoading(false);
      }
    }
  }

  async function refreshAssuntosViewData() {
    const assuntosRequestId = ++assuntosRequestIdRef.current;
    const catalogoRequestId = ++assuntosCatalogoRequestIdRef.current;
    const [nextAssuntos, nextAssuntosCatalogo] = await Promise.all([
      listPreDemandaAssuntos(preId),
      listPreDemandaAssuntosCatalogo(preId),
    ]);

    if (assuntosRequestId === assuntosRequestIdRef.current) {
      syncAssuntosState(nextAssuntos);
      setAssuntosLoading(false);
    }
    if (catalogoRequestId === assuntosCatalogoRequestIdRef.current) {
      setAssuntosCatalogo(nextAssuntosCatalogo);
      setAssuntosCatalogoLoaded(true);
      setAssuntosCatalogoLoading(false);
    }
  }

  async function loadTarefasData(force = false) {
    if (!force && (tarefasLoaded || tarefasLoading)) {
      return;
    }

    setTarefasLoading(true);
    try {
      const nextTarefas = await listPreDemandaTarefas(preId);
      setTarefas(nextTarefas);
      setTarefasLoaded(true);
    } finally {
      setTarefasLoading(false);
    }
  }

  async function loadAudienciasData(force = false) {
    if (!force && (audienciasLoaded || audienciasLoading)) {
      return;
    }

    setAudienciasLoading(true);
    try {
      const nextAudiencias = await listPreDemandaAudiencias(preId);
      setAudiencias(nextAudiencias);
      setAudienciasLoaded(true);
    } finally {
      setAudienciasLoading(false);
    }
  }

  async function loadComentariosData(force = false) {
    if (!force && (commentsLoaded || commentsLoading)) {
      return;
    }

    setCommentsLoading(true);
    try {
      const nextComentarios = await listPreDemandaComentarios(preId);
      setComentarios(nextComentarios);
      setCommentsLoaded(true);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function loadInteressadosData(force = false) {
    if (!force && (interessadosLoaded || interessadosLoading)) {
      return;
    }

    setInteressadosLoading(true);
    try {
      const nextInteressados = await listPreDemandaInteressados(preId);
      setInteressados(nextInteressados);
      setInteressadosLoaded(true);
    } finally {
      setInteressadosLoading(false);
    }
  }

  async function loadSeiData(force = false) {
    if (!force && (seiLoaded || seiLoading)) {
      return;
    }

    setSeiLoading(true);
    try {
      const nextAssociations = await listPreDemandaSeiAssociations(preId);
      setSeiAssociations(nextAssociations);
      setSeiLoaded(true);
    } finally {
      setSeiLoading(false);
    }
  }

  async function loadVinculosData(force = false) {
    if (!force && (relatedLoaded || relatedLoading)) {
      return;
    }

    setRelatedLoading(true);
    try {
      const nextVinculos = await listPreDemandaVinculos(preId);
      setVinculos(nextVinculos);
      setRelatedLoaded(true);
    } finally {
      setRelatedLoading(false);
    }
  }

  async function loadSetoresAtivosData(force = false) {
    if (!force && (activeSetoresLoaded || activeSetoresLoading)) {
      return;
    }

    setActiveSetoresLoading(true);
    try {
      const nextSetoresAtivos = await listPreDemandaSetoresAtivos(preId);
      setSetoresAtivos(nextSetoresAtivos);
      setActiveSetoresLoaded(true);
    } finally {
      setActiveSetoresLoading(false);
    }
  }

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail as { preId?: string } | undefined;
      // Se mudou ESTE processo, recarrega
      if (data?.preId === preId) {
        void loadRecordData();
      }
    };

    window.addEventListener("pre-demanda-updated", handleUpdate);
    return () => {
      window.removeEventListener("pre-demanda-updated", handleUpdate);
    };
  }, [preId]);

  useEffect(() => {
    void loadRecordData(true);
  }, [preId]);

  useEffect(() => {
    void loadTimelineData();
  }, [preId]);

  useEffect(() => {
    void loadCatalogData();
  }, []);

  useEffect(() => {
    setTarefas([]);
    setAudiencias([]);
    setAssuntosLinked([]);
    setDocumentos([]);
    setComentarios([]);
    setInteressados([]);
    setSeiAssociations([]);
    setVinculos([]);
    setSetoresAtivos([]);
    setTarefasLoaded(false);
    setAudienciasLoaded(false);
    setAssuntosLoaded(false);
    setAssuntosCatalogoLoaded(false);
    setDocumentsLoaded(false);
    setCommentsLoaded(false);
    setInteressadosLoaded(false);
    setSeiLoaded(false);
    setRelatedLoaded(false);
    setActiveSetoresLoaded(false);
    setTarefasLoading(false);
    setAudienciasLoading(false);
    setAssuntosLoading(false);
    setAssuntosCatalogoLoading(false);
    setDocumentsLoading(false);
    setCommentsLoading(false);
    setInteressadosLoading(false);
    setSeiLoading(false);
    setRelatedLoading(false);
    setActiveSetoresLoading(false);
    setTaskSuggestions([]);
    setTaskSuggestionsLoading(false);
  }, [preId]);

  useEffect(() => {
    if (toolbarDialog === "summary" || toolbarDialog === "subjects") {
      void loadAssuntosData();
      void loadAssuntosCatalogoData();
    }
    if (toolbarDialog === "tasks") {
      void loadTarefasData();
    }
    if (toolbarDialog === "audiencias") {
      void loadAudienciasData();
    }
    if (toolbarDialog === "documents") {
      void loadDocumentosData();
    }
    if (toolbarDialog === "comments") {
      void loadComentariosData();
    }
    if (toolbarDialog === "people" || toolbarDialog === "tasks") {
      void loadInteressadosData();
    }
    if (toolbarDialog === "summary" || toolbarDialog === "seiAssociation") {
      void loadSeiData();
    }
    if (toolbarDialog === "relatedList") {
      void loadVinculosData();
    }
    if (toolbarDialog === "sectors") {
      void loadSetoresAtivosData();
    }
  }, [toolbarDialog]);

  useEffect(() => {
    if (!record) {
      return;
    }
    void loadTarefasData();
    if (record.numeroJudicial || record.metadata.audienciaHorarioInicio) {
      void loadAudienciasData();
    }
  }, [record?.id]);

  useEffect(() => {
    if (toolbarDialog !== "relatedList" || processSearch.trim().length < 2) {
      setLinkedProcessResults([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await listPreDemandas({
          q: processSearch,
          page: 1,
          pageSize: 8,
        });
        if (active) {
          setLinkedProcessResults(
            result.items.filter((item) => item.preId !== preId),
          );
        }
      } catch {
        if (active) {
          setLinkedProcessResults([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [preId, processSearch, toolbarDialog]);

  useEffect(() => {
    if (toolbarDialog !== "tasks" || !record) {
      setTaskSuggestions([]);
      setTaskSuggestionsLoading(false);
      return;
    }

    let active = true;
    setTaskSuggestionsLoading(true);
    void listPreDemandaTaskScheduleSuggestions(preId, {
      prazo_conclusao: taskForm.prazo_conclusao || null,
      limit: taskForm.prazo_conclusao ? 3 : 4,
    })
      .then((nextSuggestions) => {
        if (active) {
          setTaskSuggestions(nextSuggestions);
        }
      })
      .catch(() => {
        if (active) {
          setTaskSuggestions([]);
        }
      })
      .finally(() => {
        if (active) {
          setTaskSuggestionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [preId, record?.id, taskForm.prazo_conclusao, toolbarDialog]);

  useEffect(() => {
    if (interessadoSearch.trim().length < 2) {
      setInteressadoResults([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await listPessoas({
          q: interessadoSearch,
          page: 1,
          pageSize: 8,
        });
        if (active) {
          setInteressadoResults(result.items);
        }
      } catch {
        if (active) {
          setInteressadoResults([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [interessadoSearch]);

  useEffect(() => {
    if (!signatureExpanded || signatureSearch.trim().length < 2) {
      setSignatureSearchResults([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await listPessoas({
          q: signatureSearch,
          page: 1,
          pageSize: 8,
        });
        if (active) setSignatureSearchResults(result.items);
      } catch {
        if (active) setSignatureSearchResults([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [signatureSearch, signatureExpanded]);

  useEffect(() => {
    if (!editingAndamento) {
      setEditAndamentoForm({ descricao: "", data_hora: "" });
      return;
    }

    setEditAndamentoForm({
      descricao: editingAndamento.descricao,
      data_hora: toDateTimeLocalValue(editingAndamento.dataHora),
    });
  }, [editingAndamento]);

  useEffect(() => {
    if (!deleteAndamento) {
      setDeleteAndamentoConfirm("");
    }
  }, [deleteAndamento]);

  useEffect(() => {
    if (!editingTask) {
      setEditTaskForm({
        descricao: "",
        tipo: "livre",
        urgente: false,
        prazo_conclusao: "",
        horario_inicio: "",
        horario_fim: "",
        recorrencia_tipo: "",
        recorrencia_dias_semana: [],
        recorrencia_dia_mes: "",
      });
      return;
    }

    setEditTaskForm({
      descricao: editingTask.descricao,
      tipo: editingTask.tipo,
      urgente: editingTask.urgente ?? false,
      prazo_conclusao: editingTask.prazoConclusao ?? "",
      horario_inicio: editingTask.horarioInicio ?? "",
      horario_fim: editingTask.horarioFim ?? "",
      recorrencia_tipo: editingTask.recorrenciaTipo ?? "",
      recorrencia_dias_semana: editingTask.recorrenciaDiasSemana ?? [],
      recorrencia_dia_mes: editingTask.recorrenciaDiaMes
        ? String(editingTask.recorrenciaDiaMes)
        : "",
    });
  }, [editingTask]);

  useEffect(() => {
    if (!deleteTask) {
      setDeleteTaskConfirm("");
    }
  }, [deleteTask]);

  useEffect(() => {
    setEditingAudienciaId(null);
    setAudienciaForm(AUDIENCIA_FORM_DEFAULT);
  }, [preId]);

  const queueHealth = useMemo(
    () => (record ? getQueueHealth(record) : null),
    [record],
  );
  const pendingTasks = useMemo(
    () => tarefas.filter((item) => !item.concluida),
    [tarefas],
  );
  const completedTasks = useMemo(
    () => tarefas.filter((item) => item.concluida),
    [tarefas],
  );
  const isJudicialProcess = useMemo(
    () => Boolean(record?.numeroJudicial),
    [record?.numeroJudicial],
  );
  const orderedAudiencias = useMemo(
    () =>
      [...audiencias].sort(
        (a, b) =>
          new Date(a.dataHoraInicio).getTime() -
          new Date(b.dataHoraInicio).getTime(),
      ),
    [audiencias],
  );
  const nextAudiencia = orderedAudiencias[0] ?? null;
  const hasDesignadaAudiencia = useMemo(
    () =>
      orderedAudiencias.some(
        (audiencia) => audiencia.situacao === "designada",
      ) || record?.metadata.audienciaStatus === "designada",
    [orderedAudiencias, record?.metadata.audienciaStatus],
  );
  const editableAndamentoIds = useMemo(
    () =>
      new Set(
        (record?.recentAndamentos ?? [])
          .filter((item) => item.tipo === "manual")
          .map((item) => item.id),
      ),
    [record],
  );
  const editableAndamentos = useMemo(
    () =>
      new Map(
        (record?.recentAndamentos ?? [])
          .filter((item) => item.tipo === "manual")
          .map((item) => [item.id, item] as const),
      ),
    [record],
  );
  const lastEvent = useMemo(() => timeline[0] ?? null, [timeline]);
  const nextAction = useMemo(() => {
    if (!record) return { title: "", description: "" };
    switch (record.status) {
      case "em_andamento":
        return {
          title: "Conduzir a execucao administrativa",
          description:
            "Vincule pessoas, complemente os dados do processo e conclua tarefas pendentes ate o encerramento.",
        };
      case "aguardando_sei":
        return {
          title: "Monitorar a geracao do processo",
          description:
            "Mantenha tarefas de acompanhamento activas e associe o numero SEI assim que ele existir.",
        };
      case "encerrada":
        return {
          title: "Preservar historico e reabrir apenas com motivo",
          description:
            "O processo esta encerrado. Reabra so se houver fato novo, correcao processual ou necessidade operacional real.",
        };
    }
  }, [record]);
  const taskShortcutOptions = useMemo(() => {
    const items = [...FIXED_TASKS];
    const interessadoShortcuts = interessados
      .slice(0, 6)
      .map((item) => `Assinatura de ${item.interessado.nome}`);

    return Array.from(new Set([...items, ...interessadoShortcuts]));
  }, [interessados]);
  const requiresTaskSetorDestino =
    taskForm.descricao.trim() === "Envio para" ||
    taskForm.descricao.trim() === "Retorno do setor";
  const requiresTaskSignaturePerson =
    taskForm.descricao.trim() === "Assinatura de pessoa";
  const selectedSignaturePerson = useMemo(() => {
    const fromInteressados =
      interessados.find(
        (item) => item.interessado.id === taskForm.assinatura_interessado_id,
      )?.interessado ?? null;
    if (fromInteressados) return fromInteressados;
    const fromSearch =
      signatureSearchResults.find(
        (item) => item.id === taskForm.assinatura_interessado_id,
      ) ?? null;
    if (fromSearch) return fromSearch;
    if (taskForm.assinatura_interessado_id && signatureSelectedName)
      return { nome: signatureSelectedName } as { nome: string };
    return null;
  }, [
    interessados,
    signatureSearchResults,
    taskForm.assinatura_interessado_id,
    signatureSelectedName,
  ]);

  function getTaskPrazoChangeState(
    error: unknown,
    payload: TaskPrazoChangeState["payload"],
    mode: "create" | "edit",
  ): TaskPrazoChangeState | null {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      !("details" in error)
    ) {
      return null;
    }

    const apiError = error as Error & { code?: string; details?: unknown };
    if (
      apiError.code !== "TAREFA_PRAZO_CHANGE_CONFIRMATION" ||
      !apiError.details ||
      typeof apiError.details !== "object"
    ) {
      return null;
    }

    const details = apiError.details as TaskPrazoChangeState["details"];
    return { mode, payload, details };
  }

  async function handleReorderPendingTasksMotion(
    newPendingTasks: typeof pendingTasks,
  ) {
    setTarefas((current) => {
      const completed = current.filter((t) => t.concluida);
      return [...newPendingTasks, ...completed];
    });

    await runMutation(async () => {
      const ids = newPendingTasks.map((t) => t.id);
      const tarefas = await reorderPreDemandaTarefas(preId, ids);
      setTarefas(tarefas);
      setTarefasLoaded(true);
    }, "Checklist reorganizada.");
  }
  const availableAssuntos = useMemo(
    () =>
      assuntosCatalogo.filter(
        (item) =>
          !assuntosLinked.some((linked) => linked.assunto.id === item.id),
      ),
    [assuntosCatalogo, assuntosLinked],
  );
  const sectionSummaries = useMemo(
    () =>
      record
        ? {
            resumo: `${getPreDemandaStatusLabel(record.status)} â€¢ ${record.setorAtual?.sigla ?? "Sem setor"}${record.status !== "encerrada" && record.prazoProcesso ? ` â€¢ prazo do processo ${formatDateOnlyPtBr(record.prazoProcesso)}` : ""}`,
            audiencias:
              orderedAudiencias.length > 0
                ? `PrÃ³xima audiÃªncia ${formatDateTimePtBrSafe(orderedAudiencias[0]?.dataHoraInicio)}`
                : record.metadata.audienciaHorarioInicio
                  ? `PrÃ³xima audiÃªncia ${formatDateTimePtBrSafe(record.metadata.audienciaHorarioInicio)}${record.metadata.audienciaStatus ? ` â€¢ ${record.metadata.audienciaStatus}` : ""}`
                  : "Sem audiÃªncia cadastrada",
            pessoas: interessados.length
              ? `${interessados.length} pessoa(s) vinculada(s)`
              : interessadosLoaded
                ? "Nenhuma pessoa vinculada"
                : (record.pessoaPrincipal?.nome ?? "Abrir pessoas"),
            setores: setoresAtivos.length
              ? `${setoresAtivos.length} setor(es) ativo(s)`
              : activeSetoresLoaded
                ? "Sem setores ativos"
                : "Abrir setores",
            checklist: tarefasLoaded
              ? `${pendingTasks.length} pendente(s) â€¢ ${completedTasks.length} concluida(s)`
              : "Carregando tarefas",
            visao: `${nextAction.title} â€¢ fila ${queueHealth?.summary ?? "-"}`,
            relacionados: vinculos.length
              ? `${vinculos.length} vinculo(s) ativo(s)`
              : relatedLoaded
                ? "Sem processos relacionados"
                : "Abrir relacionamentos",
            associacaoSei:
              seiAssociations.find((item) => item.principal)?.seiNumero ??
              record.currentAssociation?.seiNumero ??
              "Sem numero SEI associado",
            documentos: documentos.length
              ? `${documentos.length} documento(s) anexado(s)`
              : documentsLoaded
                ? "Sem documentos anexados"
                : "Abrir documentos",
            comentarios: comentarios.length
              ? `${comentarios.length} comentario(s) registrado(s)`
              : commentsLoaded
                ? "Sem comentarios"
                : "Abrir discussao",
            historico: timeline.length
              ? `${timeline.length} evento(s) registrado(s)`
              : "Sem eventos registrados",
          }
        : null,
    [
      activeSetoresLoaded,
      comentarios.length,
      commentsLoaded,
      completedTasks.length,
      documentos.length,
      documentsLoaded,
      interessados.length,
      interessadosLoaded,
      nextAction.title,
      orderedAudiencias,
      pendingTasks.length,
      queueHealth?.summary,
      record,
      relatedLoaded,
      seiAssociations,
      setoresAtivos.length,
      tarefasLoaded,
      timeline.length,
      vinculos.length,
    ],
  );

  async function runMutation(
    action: () => Promise<string | void>,
    successMessage: string,
  ) {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const nextMessage = await action();
      await loadRecordData();
      void loadTimelineData();
      setMessage(nextMessage || successMessage);
    } catch (nextError) {
      setError(
        formatPreDemandaMutationError(
          nextError,
          "Falha ao executar a operacao.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateTask(confirmarAlteracaoPrazo = false) {
    const resolvedDescricao = requiresTaskSignaturePerson
      ? selectedSignaturePerson
        ? `Assinatura de ${selectedSignaturePerson.nome}`
        : taskForm.descricao.trim()
      : taskForm.descricao.trim() === "Envio para" ||
          taskForm.descricao.trim() === "Retorno do setor"
        ? `${taskForm.descricao.trim()} ${setores.find((item) => item.id === taskForm.setor_destino_id)?.sigla ?? ""}`.trim()
        : taskForm.descricao.trim();

    const payload = {
      descricao: resolvedDescricao,
      tipo: taskForm.tipo,
      urgente: taskForm.urgente,
      prazo_conclusao: taskForm.prazo_conclusao,
      horario_inicio: taskForm.horario_inicio || null,
      horario_fim: taskForm.horario_fim || null,
      recorrencia_tipo: taskForm.recorrencia_tipo || null,
      recorrencia_dias_semana:
        taskForm.recorrencia_tipo === "semanal"
          ? taskForm.recorrencia_dias_semana
          : null,
      recorrencia_dia_mes:
        [
          "mensal",
          "trimestral",
          "quadrimestral",
          "semestral",
          "anual",
        ].includes(taskForm.recorrencia_tipo) && taskForm.recorrencia_dia_mes
          ? Number(taskForm.recorrencia_dia_mes)
          : null,
      setor_destino_id: taskForm.setor_destino_id || null,
    };

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = await createPreDemandaTarefa(preId, {
        ...payload,
        confirmar_alteracao_prazo: confirmarAlteracaoPrazo,
      });
      if (tarefaResult?.data?.reopen?.wasReopened) {
        setReopenAlert(`Motivo: ${tarefaResult.data.reopen.reason}`);
        await loadRecordData();
      }
      await loadTarefasData(true);
      if (!tarefaResult?.data?.reopen?.wasReopened) await loadRecordData();
      void loadTimelineData();
      setTaskPrazoChange(null);
      setTaskForm({
        descricao: "",
        tipo: "livre",
        urgente: false,
        prazo_conclusao: record?.prazoProcesso ?? "",
        horario_inicio: "",
        horario_fim: "",
        recorrencia_tipo: "",
        recorrencia_dias_semana: [],
        recorrencia_dia_mes: "",
        setor_destino_id: "",
        assinatura_interessado_id: "",
      });
      setMessage(composeAutoReopenSuccessMessage("Tarefa criada.", result.autoReopen));
    } catch (nextError) {
      const prazoChange = getTaskPrazoChangeState(nextError, payload, "create");
      if (prazoChange) {
        setTaskPrazoChange(prazoChange);
        return;
      }
      setError(
        formatPreDemandaMutationError(nextError, "Falha ao criar a tarefa."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateTask(confirmarAlteracaoPrazo = false) {
    if (!editingTask) {
      return;
    }

    const payload = {
      descricao: editTaskForm.descricao.trim(),
      tipo: editTaskForm.tipo,
      urgente: editTaskForm.urgente,
      prazo_conclusao: editTaskForm.prazo_conclusao,
      horario_inicio: editTaskForm.horario_inicio || null,
      horario_fim: editTaskForm.horario_fim || null,
      recorrencia_tipo: editTaskForm.recorrencia_tipo || null,
      recorrencia_dias_semana:
        editTaskForm.recorrencia_tipo === "semanal"
          ? editTaskForm.recorrencia_dias_semana
          : null,
      recorrencia_dia_mes:
        [
          "mensal",
          "trimestral",
          "quadrimestral",
          "semestral",
          "anual",
        ].includes(editTaskForm.recorrencia_tipo) &&
        editTaskForm.recorrencia_dia_mes
          ? Number(editTaskForm.recorrencia_dia_mes)
          : null,
    };

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      await updatePreDemandaTarefa(preId, editingTask.id, {
        ...payload,
        confirmar_alteracao_prazo: confirmarAlteracaoPrazo,
      });
      await loadTarefasData(true);
      await loadRecordData();
      void loadTimelineData();
      setTaskPrazoChange(null);
      setEditingTask(null);
      setMessage("Tarefa atualizada.");
    } catch (nextError) {
      const prazoChange = getTaskPrazoChangeState(nextError, payload, "edit");
      if (prazoChange) {
        setTaskPrazoChange(prazoChange);
        return;
      }
      setError(
        formatPreDemandaMutationError(
          nextError,
          "Falha ao atualizar a tarefa.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSeiValid) {
      setError("Informe um numero SEI no formato 000181/26-02.227.");
      return;
    }
    await runMutation(async () => {
      const result = await associateSei(preId, {
        ...associationForm,
        sei_numero: normalizeSeiValue(associationForm.sei_numero),
      });
      if (!result.association) {
        setSeiLoaded(false);
        return;
      }
      setSeiAssociations((current) => [
        result.association,
        ...current
          .filter((item) => item.seiNumero !== result.association.seiNumero)
          .map((item) => ({ ...item, principal: false })),
      ]);
      setSeiLoaded(true);
    }, "Associacao SEI atualizada.");
  }

  async function handleDocumentoUpload() {
    if (!documentForm.file) {
      setError("Selecione um ficheiro para anexar.");
      return;
    }

    const conteudoBase64 = await readFileAsBase64(documentForm.file);
    await runMutation(async () => {
      await createPreDemandaDocumento(preId, {
        nome_arquivo: documentForm.file!.name,
        mime_type: documentForm.file!.type || "application/octet-stream",
        descricao: documentForm.descricao || null,
        conteudo_base64: conteudoBase64,
      });
      setDocumentForm({ file: null, descricao: "" });
      await loadDocumentosData(true);
    }, "Documento anexado.");
  }

  function resetAudienciaForm() {
    setEditingAudienciaId(null);
    setAudienciaForm({ ...AUDIENCIA_FORM_DEFAULT });
  }

  async function handleAudienciaSubmit() {
    if (!audienciaForm.inicio) {
      setError("Informe a data e hora de inicio da audiencia.");
      return;
    }

    const inicioIso = toIsoFromDateTimeLocal(audienciaForm.inicio);
    const fimIso = toIsoFromDateTimeLocal(audienciaForm.fim);
    if (!inicioIso) {
      setError("Informe uma data e hora de inicio valida.");
      return;
    }

    await runMutation(
      async () => {
        const payload = {
          data_hora_inicio: inicioIso,
          data_hora_fim: fimIso,
          descricao: audienciaForm.descricao.trim() || null,
          sala: audienciaForm.sala.trim() || null,
          situacao: audienciaForm.situacao,
          observacoes: audienciaForm.observacoes.trim() || null,
        };

        if (editingAudienciaId) {
          await updatePreDemandaAudiencia(preId, editingAudienciaId, payload);
          return;
        } else {
          const result = await createPreDemandaAudiencia(preId, payload);
          await loadAudienciasData(true);
          resetAudienciaForm();
          return composeAutoReopenSuccessMessage("Audiencia cadastrada.", result.autoReopen);
        }
        await loadAudienciasData(true);
        resetAudienciaForm();
      },
      editingAudienciaId ? "Audiencia atualizada." : "Audiencia cadastrada.",
    );
  }

  function handleAudienciaEdit(item: Audiencia) {
    setEditingAudienciaId(item.id);
    setAudienciaForm({
      inicio: toDateTimeLocalValue(item.dataHoraInicio),
      fim: toDateTimeLocalValue(item.dataHoraFim),
      sala: item.sala ?? "",
      descricao: item.descricao ?? "",
      situacao: item.situacao,
      observacoes: item.observacoes ?? "",
    });
    setToolbarDialog("audiencias");
  }

  async function handleAudienciaDelete(id: string) {
    await runMutation(async () => {
      await removePreDemandaAudiencia(preId, id);
      await loadAudienciasData(true);
      if (editingAudienciaId === id) {
        resetAudienciaForm();
      }
    }, "Audiencia excluida.");
  }

  if (loading) {
    return (
      <LoadingState
        description="Estamos preparando a visao do processo com metadados, envolvidos e historico."
        title="Carregando processo"
      />
    );
  }

  if (error && !record) {
    return <ErrorState description={error} />;
  }

  if (!record || !queueHealth) {
    return <ErrorState description="Processo nao encontrado." />;
  }

  const reopenStatus = getPreferredReopenStatus(record);

  return (
    <section className="grid gap-6">
      <PageHeader
        description={`Painel operacional inspirado no SEI para controle de envolvidos, tarefas, tramitacoes e historico. Referencia interna: ${record.preId}.`}
        eyebrow={record.principalNumero}
        title={record.assunto}
      />
      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}
      {reopenAlert ? (
        <div className="flex items-start gap-3 rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <span className="mt-0.5 text-lg leading-none">âš ï¸</span>
          <div>
            <p className="font-semibold">Processo reaberto automaticamente</p>
            <p className="mt-0.5 font-normal text-amber-700">{reopenAlert}</p>
          </div>
          <button
            aria-label="Fechar alerta"
            className="ml-auto shrink-0 text-amber-500 hover:text-amber-700"
            onClick={() => setReopenAlert(null)}
            type="button"
          >
            âœ•
          </button>
        </div>
      ) : null}
      {message ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}
      <div className="grid gap-4 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(240,246,249,0.86))] p-4 shadow-[0_12px_24px_rgba(20,33,61,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              Paineis do processo
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Acoes e blocos operacionais foram centralizados em modais para
              manter a pagina mais limpa.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-9">
          <ToolbarActionButton
            icon={Edit}
            label="Editar"
            onClick={() => setToolbarDialog("edit")}
            title="Consultar ou alterar processo"
          />
          <ToolbarActionButton
            icon={Send}
            label="Tramitar"
            onClick={() => setToolbarDialog("send")}
            title="Enviar processo para outro setor"
          />
          <ToolbarActionButton
            icon={StickyNote}
            label="Nota interna"
            onClick={() => setToolbarDialog("notes")}
            title="Anotacoes do processo"
          />
          <ToolbarActionButton
            icon={CalendarClock}
            label="Prazo"
            onClick={() => setToolbarDialog("deadline")}
            title="Controle de prazos"
          />
          {isJudicialProcess ? (
            <ToolbarActionButton
              icon={CalendarClock}
              label="Audiencias"
              onClick={() => setToolbarDialog("audiencias")}
              title={
                sectionSummaries?.audiencias ?? "Gerir audiencias judiciais"
              }
            />
          ) : null}
          <ToolbarActionButton
            icon={ListTodo}
            label="Tarefas"
            onClick={() => setToolbarDialog("tasks")}
            title="Gerenciar tarefas do processo"
          />
          <ToolbarActionButton
            icon={Plus}
            label="Andamento"
            onClick={() => setToolbarDialog("andamento")}
            title="Registrar andamento manual"
          />
          {record.allowedNextStatuses.includes("encerrada") ? (
            <ToolbarActionButton
              disabled={hasDesignadaAudiencia}
              icon={CheckCircle}
              label="Concluir"
              onClick={() =>
                setStatusAction({
                  nextStatus: "encerrada",
                  title: "Concluir processo",
                  requireReason: true,
                })
              }
              title={
                hasDesignadaAudiencia
                  ? "Nao e permitido concluir o processo com audiencia designada."
                  : "Concluir processo"
              }
            />
          ) : null}
          {record.status === "encerrada" && reopenStatus ? (
            <ToolbarActionButton
              icon={RotateCcw}
              label="Reabrir"
              onClick={() =>
                setStatusAction({
                  nextStatus: reopenStatus,
                  title: "Reabrir processo",
                  requireReason: true,
                })
              }
              title="Reabrir processo"
            />
          ) : null}
          <ToolbarActionButton
            icon={LayoutDashboard}
            label="Resumo"
            onClick={() => setToolbarDialog("summary")}
            title={sectionSummaries?.resumo ?? "Abrir resumo executivo"}
          />
          <ToolbarActionButton
            icon={FilePlus2}
            label="Assuntos"
            onClick={() => setToolbarDialog("subjects")}
            title="Gerenciar assuntos vinculados e checklist automatico"
          />
          <ToolbarActionButton
            icon={Users}
            label="Pessoas"
            onClick={() => setToolbarDialog("people")}
            title={sectionSummaries?.pessoas ?? "Abrir pessoas vinculadas"}
          />
          <ToolbarActionButton
            icon={Building2}
            label="Setores"
            onClick={() => setToolbarDialog("sectors")}
            title={sectionSummaries?.setores ?? "Abrir setores ativos"}
          />
          <ToolbarActionButton
            icon={GitBranch}
            label="Relacionamentos"
            onClick={() => setToolbarDialog("relatedList")}
            title={
              sectionSummaries?.relacionados ?? "Abrir processos relacionados"
            }
          />
          <ToolbarActionButton
            icon={LinkIcon}
            label="PRE x SEI"
            onClick={() => setToolbarDialog("seiAssociation")}
            title={
              sectionSummaries?.associacaoSei ?? "Abrir associacao PRE para SEI"
            }
          />
          <ToolbarActionButton
            icon={Files}
            label="Documentos"
            onClick={() => setToolbarDialog("documents")}
            title={sectionSummaries?.documentos ?? "Abrir documentos"}
          />
          <ToolbarActionButton
            icon={MessageSquareText}
            label="Discussao"
            onClick={() => setToolbarDialog("comments")}
            title={sectionSummaries?.comentarios ?? "Abrir comentarios"}
          />
        </div>
      </div>

      {isJudicialProcess ? (
        <Card className="overflow-hidden border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,244,214,0.78),rgba(255,255,255,0.92))]">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">
                Audiencia judicial
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {nextAudiencia
                  ? `${formatDateTimePtBrSafe(nextAudiencia.dataHoraInicio)}${nextAudiencia.sala ? ` â€¢ ${nextAudiencia.sala}` : ""}`
                  : record.metadata.audienciaHorarioInicio
                    ? `${formatDateTimePtBrSafe(record.metadata.audienciaHorarioInicio)}${record.metadata.audienciaStatus ? ` â€¢ ${record.metadata.audienciaStatus}` : ""}`
                    : "Nenhuma audiÃªncia estruturada cadastrada."}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {nextAudiencia
                  ? `${nextAudiencia.descricao || "AudiÃªncia registrada."}${nextAudiencia.observacoes ? ` â€¢ ${nextAudiencia.observacoes}` : ""}`
                  : "Use o botÃ£o AudiÃªncias para registar data, hora, sala, descriÃ§Ã£o e situaÃ§Ã£o do ato judicial."}
              </p>
            </div>
            <Button
              onClick={() => setToolbarDialog("audiencias")}
              type="button"
              variant="secondary"
            >
              Abrir audiÃªncias
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid content-start gap-6">
          <DetailSectionCard
            defaultOpen
            summary={sectionSummaries?.checklist}
            title="Checklist / Proximas tarefas"
          >
            <CardHeader>
              <CardTitle>Checklist / Proximas tarefas</CardTitle>
              <CardDescription>
                As opcoes de CRUD e organizacao ficam dentro do modal aberto
                pelo botao Tarefas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {false ? (
                <>
                  <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          Assuntos vinculados
                        </p>
                        <p className="text-xs text-slate-500">
                          Assuntos com procedimentos criam tarefas automÃ¡ticas e
                          seguem o prazo do processo.
                        </p>
                      </div>
                    </div>
                    {record.assuntos.some(
                      (item) => item.assunto.procedimentos.length > 0,
                    ) ? (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                        <p className="font-semibold">
                          Checklist automÃ¡tico ativo
                        </p>
                        <p className="mt-1 text-sky-800">
                          {
                            record.assuntos.filter(
                              (item) => item.assunto.procedimentos.length > 0,
                            ).length
                          }{" "}
                          assunto
                          {record.assuntos.filter(
                            (item) => item.assunto.procedimentos.length > 0,
                          ).length === 1
                            ? ""
                            : "s"}{" "}
                          vinculado
                          {record.assuntos.filter(
                            (item) => item.assunto.procedimentos.length > 0,
                          ).length === 1
                            ? ""
                            : "s"}{" "}
                          com procedimentos automÃ¡ticos.
                        </p>
                      </div>
                    ) : null}
                    <div className="grid gap-3">
                      {record.assuntos.length ? (
                        record.assuntos.map((item) => (
                          <div
                            className="rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                            key={item.assunto.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">
                                  {item.assunto.nome}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {item.assunto.procedimentos.length} passos â€¢{" "}
                                  {item.assunto.normas.length} normas
                                </p>
                                {item.assunto.normas.length ? (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Normas:{" "}
                                    {item.assunto.normas
                                      .map((norma) => norma.numero)
                                      .join(", ")}
                                  </p>
                                ) : null}
                              </div>
                              <Button
                                onClick={() =>
                                  void runMutation(async () => {
                                    const next = await removePreDemandaAssunto(
                                      preId,
                                      item.assunto.id,
                                    );
                                    setRecord(next);
                                    syncRecordDependentState(next);
                                    await refreshAssuntosViewData();
                                  }, "Assunto removido e tarefas automÃ¡ticas pendentes foram revistas.")
                                }
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                Remover
                              </Button>
                            </div>
                            {item.assunto.procedimentos.length ? (
                              <ol className="mt-3 grid gap-2 text-sm text-slate-600">
                                {item.assunto.procedimentos.map(
                                  (procedimento) => (
                                    <li
                                      className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                                      key={procedimento.id}
                                    >
                                      <span className="font-semibold">
                                        {procedimento.ordem}.{" "}
                                      </span>
                                      {procedimento.descricao}
                                      {procedimento.setorDestino ? (
                                        <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                                          â†’ {procedimento.setorDestino.sigla}
                                        </span>
                                      ) : null}
                                    </li>
                                  ),
                                )}
                              </ol>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                          Nenhum assunto vinculado.
                        </p>
                      )}
                    </div>
                    {assuntosCatalogoLoading && !assuntosCatalogoLoaded ? (
                      <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        Carregando catalogo de assuntos...
                      </p>
                    ) : availableAssuntos.length ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {availableAssuntos.map((assunto) => (
                          <button
                            className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-sm hover:border-slate-400"
                            key={assunto.id}
                            onClick={() =>
                              void runMutation(async () => {
                                const result = await addPreDemandaAssunto(
                                  preId,
                                  assunto.id,
                                );
                                const next = result.item;
                                setRecord(next);
                                syncRecordDependentState(next);
                                await refreshAssuntosViewData();
                                return composeAutoReopenSuccessMessage(
                                  `Assunto ${assunto.nome} vinculado e checklist gerado.`,
                                  result.autoReopen,
                                );
                              }, `Assunto ${assunto.nome} vinculado e checklist gerado.`)
                            }
                            type="button"
                          >
                            <span className="block font-semibold text-slate-950">
                              {assunto.nome}
                            </span>
                            <span className="block text-slate-500">
                              {assunto.procedimentos.length} passos â€¢{" "}
                              {assunto.normas.length} normas
                            </span>
                            {assunto.procedimentos.length ? (
                              <span className="mt-1 block text-xs font-medium uppercase tracking-[0.14em] text-sky-700">
                                Vai criar checklist automÃ¡tico
                              </span>
                            ) : (
                              <span className="mt-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                Sem checklist automÃ¡tico
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    <Input
                      className="w-full"
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          descricao: event.target.value,
                        }))
                      }
                      placeholder="Descreva a proxima tarefa"
                      value={taskForm.descricao}
                    />
                    <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                      <FormField label="Tipo">
                        <select
                          className={selectClassName}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              tipo: event.target.value as "fixa" | "livre",
                            }))
                          }
                          value={taskForm.tipo}
                        >
                          <option value="livre">Livre</option>
                          <option value="fixa">Fixa</option>
                        </select>
                      </FormField>
                      <FormField
                        hint="Sem recorrÃªncia, esta Ã© a data final da tarefa. Com recorrÃªncia, ela vira a base para as prÃ³ximas ocorrÃªncias."
                        label="Prazo da tarefa"
                      >
                        <Input
                          max={record?.prazoProcesso ?? undefined}
                          min={undefined}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              prazo_conclusao: event.target.value,
                            }))
                          }
                          type="date"
                          value={taskForm.prazo_conclusao}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <FormField
                      hint="Escolha apenas se a tarefa precisar voltar a ser criada depois da conclusÃ£o."
                      label="RecorrÃªncia"
                    >
                      <select
                        className={selectClassName}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            recorrencia_tipo: event.target.value as
                              | ""
                              | TarefaRecorrenciaTipo,
                            recorrencia_dias_semana:
                              event.target.value === "semanal"
                                ? current.recorrencia_dias_semana
                                : [],
                            recorrencia_dia_mes: [
                              "mensal",
                              "trimestral",
                              "quadrimestral",
                              "semestral",
                              "anual",
                            ].includes(event.target.value)
                              ? current.recorrencia_dia_mes
                              : "",
                          }))
                        }
                        value={taskForm.recorrencia_tipo}
                      >
                        <option value="">Sem repetiÃ§Ã£o</option>
                        <option value="diaria">DiÃ¡ria</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="quadrimestral">Quadrimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                      </select>
                    </FormField>

                    {taskForm.recorrencia_tipo ? (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                        Essa recorrÃªncia continua atÃ©{" "}
                        {formatDateOnlyPtBr(
                          record?.prazoProcesso,
                          "o prazo do processo",
                        )}
                        . Depois dessa data, o sistema nao cria novas tarefas.
                      </div>
                    ) : null}

                    {taskForm.recorrencia_tipo === "semanal" ? (
                      <div className="grid gap-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                            Dias da semana
                          </p>
                          <p className="text-xs text-slate-500">
                            Escolha em quais dias a prÃ³xima tarefa deve
                            reaparecer.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAY_OPTIONS.map((item) => (
                            <Button
                              key={item}
                              onClick={() =>
                                setTaskForm((current) => ({
                                  ...current,
                                  recorrencia_dias_semana:
                                    current.recorrencia_dias_semana.includes(
                                      item,
                                    )
                                      ? current.recorrencia_dias_semana.filter(
                                          (value) => value !== item,
                                        )
                                      : [
                                          ...current.recorrencia_dias_semana,
                                          item,
                                        ],
                                }))
                              }
                              size="sm"
                              type="button"
                              variant={
                                taskForm.recorrencia_dias_semana.includes(item)
                                  ? "primary"
                                  : "outline"
                              }
                            >
                              {item}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {[
                      "mensal",
                      "trimestral",
                      "quadrimestral",
                      "semestral",
                      "anual",
                    ].includes(taskForm.recorrencia_tipo) ? (
                      <FormField
                        hint="A tarefa serÃ¡ repetida nesse mesmo dia conforme a periodicidade escolhida."
                        label="Dia do mÃªs"
                      >
                        <Input
                          max="31"
                          min="1"
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              recorrencia_dia_mes: event.target.value,
                            }))
                          }
                          type="number"
                          value={taskForm.recorrencia_dia_mes}
                        />
                      </FormField>
                    ) : taskForm.recorrencia_tipo === "diaria" ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                        A recorrÃªncia diÃ¡ria nÃ£o precisa de dia da semana nem
                        dia do mÃªs.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                        Sem repetiÃ§Ã£o. A tarefa termina no prazo escolhido.
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500">
                    Toda tarefa precisa de prazo de conclusao e nao pode passar
                    de{" "}
                    {formatDateOnlyPtBr(
                      record?.prazoProcesso,
                      "o prazo do processo",
                    )}
                    .
                  </p>

                  {requiresTaskSetorDestino ? (
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <select
                        className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm"
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            setor_destino_id: event.target.value,
                          }))
                        }
                        value={taskForm.setor_destino_id}
                      >
                        <option value="">Escolha o setor destino</option>
                        {setores.map((setor) => (
                          <option key={setor.id} value={setor.id}>
                            {setor.sigla} - {setor.nomeCompleto}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 md:self-center">
                        Ao concluir, o processo serÃ¡ tramitado automaticamente
                        para o setor escolhido.
                      </p>
                    </div>
                  ) : null}

                  {requiresTaskSignaturePerson ? (
                    <div className="grid gap-3">
                      <div className="grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          Pessoas vinculadas ao processo
                        </p>
                        {interessadosLoading && !interessadosLoaded ? (
                          <p className="text-xs text-slate-400">
                            Carregando pessoas vinculadas...
                          </p>
                        ) : interessados.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            Nenhuma pessoa vinculada a este processo.
                          </p>
                        ) : (
                          <div className="grid gap-2">
                            {interessados.map((item) => (
                              <button
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                                  taskForm.assinatura_interessado_id ===
                                  item.interessado.id
                                    ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                                    : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                                }`}
                                key={item.interessado.id}
                                onClick={() => {
                                  setTaskForm((current) => ({
                                    ...current,
                                    assinatura_interessado_id:
                                      item.interessado.id,
                                  }));
                                  setSignatureSelectedName("");
                                }}
                                type="button"
                              >
                                <span className="font-medium">
                                  {item.interessado.nome}
                                  {item.interessado.cargo ? (
                                    <span className="ml-1 text-xs font-normal text-slate-500">
                                      - {item.interessado.cargo}
                                    </span>
                                  ) : null}
                                </span>
                                {taskForm.assinatura_interessado_id ===
                                item.interessado.id ? (
                                  <span className="text-xs font-semibold text-indigo-600">
                                    âœ“ Selecionado
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          className="mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                          onClick={() => {
                            setSignatureExpanded(!signatureExpanded);
                            setSignatureSearch("");
                            setSignatureSearchResults([]);
                          }}
                          type="button"
                        >
                          {signatureExpanded
                            ? "â–² Recolher busca"
                            : "â–¼ Buscar outra pessoa cadastrada"}
                        </button>

                        {signatureExpanded ? (
                          <div className="grid gap-2">
                            <input
                              className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm"
                              onChange={(e) =>
                                setSignatureSearch(e.target.value)
                              }
                              placeholder="Buscar por nome..."
                              value={signatureSearch}
                            />
                            {signatureSearch.trim().length >= 2 &&
                            signatureSearchResults.length === 0 ? (
                              <p className="text-xs text-slate-400">
                                Nenhuma pessoa encontrada.
                              </p>
                            ) : null}
                            {signatureSearchResults.map((item) => (
                              <button
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                                  taskForm.assinatura_interessado_id === item.id
                                    ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                                    : "border-slate-200 bg-white hover:border-indigo-200"
                                }`}
                                key={item.id}
                                onClick={() => {
                                  setTaskForm((current) => ({
                                    ...current,
                                    assinatura_interessado_id: item.id,
                                  }));
                                  setSignatureSelectedName(item.nome);
                                }}
                                type="button"
                              >
                                <span className="font-medium">
                                  {item.nome}
                                  {item.cargo ? (
                                    <span className="ml-1 text-xs font-normal text-slate-500">
                                      - {item.cargo}
                                    </span>
                                  ) : null}
                                </span>
                                {taskForm.assinatura_interessado_id ===
                                item.id ? (
                                  <span className="text-xs font-semibold text-indigo-600">
                                    âœ“ Selecionado
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500">
                        A tarefa serÃ¡ nomeada automaticamente com o nome da
                        pessoa selecionada.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <select
                      className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm"
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          descricao: event.target.value,
                          tipo: "fixa" as "fixa" | "livre",
                          setor_destino_id:
                            event.target.value === "Envio para" ||
                            event.target.value === "Retorno do setor"
                              ? current.setor_destino_id
                              : "",
                          assinatura_interessado_id: "",
                        }))
                      }
                      value=""
                    >
                      <option value="">Atalhos de tarefas</option>
                      {taskShortcutOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 md:self-center">
                      Os atalhos consideram envolvidos. Arraste as tarefas
                      pendentes para reorganizar.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {taskShortcutOptions.slice(0, 6).map((item) => (
                      <Button
                        key={item}
                        onClick={() =>
                          setTaskForm((current) => ({
                            ...current,
                            descricao: item,
                            tipo: "fixa" as "fixa" | "livre",
                            setor_destino_id:
                              item === "Envio para" ||
                              item === "Retorno do setor"
                                ? current.setor_destino_id
                                : "",
                            assinatura_interessado_id: "",
                          }))
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {item}
                      </Button>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      disabled={
                        taskForm.descricao.trim().length < 3 ||
                        !taskForm.prazo_conclusao ||
                        (requiresTaskSetorDestino &&
                          !taskForm.setor_destino_id) ||
                        (requiresTaskSignaturePerson &&
                          !taskForm.assinatura_interessado_id)
                      }
                      onClick={() => void handleCreateTask()}
                      type="button"
                    >
                      Criar tarefa
                    </Button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-3">
                      <p className="text-sm font-semibold text-slate-950">
                        Pendentes
                      </p>
                      {!tarefasLoaded && tarefasLoading ? (
                        <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                          Carregando tarefas...
                        </p>
                      ) : pendingTasks.length === 0 ? (
                        <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                          Nenhuma tarefa pendente.
                        </p>
                      ) : (
                        <Reorder.Group
                          axis="y"
                          className="grid gap-3"
                          onReorder={handleReorderPendingTasksMotion}
                          values={pendingTasks}
                        >
                          {pendingTasks.map((task) => (
                            <Reorder.Item key={task.id} value={task}>
                              <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 cursor-grab active:cursor-grabbing backdrop-blur-xl hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3">
                                  <input
                                    className="mt-1 h-4 w-4 accent-slate-950"
                                    onChange={() =>
                                      void runMutation(
                                        async () => {
                                          await concluirPreDemandaTarefa(
                                            preId,
                                            task.id,
                                          );
                                          await loadTarefasData(true);
                                        },
                                        formatRecorrenciaLabel(task)
                                          ? "Tarefa concluida. Nova ocorrencia gerada."
                                          : "Tarefa concluida.",
                                      )
                                    }
                                    type="checkbox"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span className="block font-semibold text-slate-950">
                                      {task.descricao}
                                    </span>
                                    {task.urgente ? (
                                      <span className="mt-1 inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                                        Tarefa urgente
                                      </span>
                                    ) : null}
                                    <span className="text-sm text-slate-500">
                                      {task.tipo}
                                    </span>
                                    {task.prazoConclusao ? (
                                      <span className="block text-xs text-slate-500">
                                        Prazo de conclusao:{" "}
                                        {formatDateOnlyPtBr(
                                          task.prazoConclusao,
                                        )}
                                      </span>
                                    ) : null}
                                    {(() => {
                                      const signal = getTaskSignal(
                                        task.prazoConclusao,
                                      );
                                      return signal ? (
                                        <span
                                          aria-label={`Prazo da tarefa ${deadlineSignalLabel(signal).toLowerCase()}. ${
                                            signal === "atrasado"
                                              ? "Prazo vencido."
                                              : "Prazo no prazo."
                                          }`}
                                          className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineSignalTone(signal)}`}
                                          title={`Prazo da tarefa: ${formatDateOnlyPtBr(task.prazoConclusao)}. ${
                                            signal === "atrasado"
                                              ? "Prazo vencido."
                                              : "Prazo no prazo."
                                          }`}
                                        >
                                          Prazo da tarefa:{" "}
                                          {deadlineSignalLabel(signal)}
                                        </span>
                                      ) : null;
                                    })()}
                                    {formatRecorrenciaLabel(task) ? (
                                      <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-800 ring-1 ring-sky-200">
                                        {formatRecorrenciaLabel(task)}
                                      </span>
                                    ) : null}
                                    {formatRecorrenciaLabel(task) ? (
                                      <span className="mt-1 block text-xs text-sky-700">
                                        RecorrÃªncia ativa atÃ©{" "}
                                        {formatDateOnlyPtBr(
                                          record?.prazoProcesso,
                                          "o prazo do processo",
                                        )}
                                        .
                                      </span>
                                    ) : null}
                                    {task.setorDestino ? (
                                      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                                        Ao concluir, tramita para{" "}
                                        {task.setorDestino.sigla}
                                      </span>
                                    ) : null}
                                    {task.geradaAutomaticamente ? (
                                      <span className="mt-1 block text-xs text-slate-500">
                                        Gerada automaticamente pelo fluxo do
                                        assunto.
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <Button
                                      onClick={() => openTaskEditor(task)}
                                      size="sm"
                                      type="button"
                                      variant="secondary"
                                    >
                                      Editar
                                    </Button>
                                    <Button
                                      onClick={() => setDeleteTask(task)}
                                      size="sm"
                                      type="button"
                                      variant="ghost"
                                    >
                                      Excluir
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      )}
                    </div>
                    <div className="grid gap-3">
                      <p className="text-sm font-semibold text-slate-950">
                        Concluidas
                      </p>
                      {completedTasks.length === 0 ? (
                        <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                          Nada concluido ainda.
                        </p>
                      ) : (
                        completedTasks.map((task) => (
                          <div
                            className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3"
                            key={task.id}
                          >
                            <p className="font-semibold text-emerald-950">
                              {task.descricao}
                            </p>
                            {task.urgente ? (
                              <p className="mt-1 inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                                Tarefa urgente
                              </p>
                            ) : null}
                            <p className="text-sm text-emerald-800">
                              Concluida em{" "}
                              {task.concluidaEm
                                ? new Date(task.concluidaEm).toLocaleString(
                                    "pt-BR",
                                  )
                                : "-"}
                            </p>
                            <p className="mt-1 text-xs text-emerald-900/80">
                              {task.tipo}
                              {task.concluidaPor
                                ? ` â€¢ ${task.concluidaPor.name}`
                                : ""}
                            </p>
                            {formatRecorrenciaLabel(task) ? (
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">
                                {formatRecorrenciaLabel(task)}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">
                        Tabela analÃ­tica das prÃ³ximas tarefas
                      </p>
                      <span className="text-xs text-slate-500">
                        {pendingTasks.length} pendente(s)
                      </span>
                    </div>
                    {pendingTasks.length === 0 ? (
                      <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        Nenhuma prÃ³xima tarefa pendente.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                <th className="px-4 py-3 font-semibold">
                                  Ordem
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                  Tarefa
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                  Tipo
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                  Prazo
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                  Setor destino
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                  Origem
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingTasks.map((task) => (
                                <tr
                                  className="border-t border-slate-200"
                                  key={`table-${task.id}`}
                                >
                                  <td className="px-4 py-3 font-semibold text-slate-950">
                                    {task.ordem}
                                  </td>
                                  <td className="px-4 py-3 text-slate-950">
                                    {task.descricao}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {task.tipo}
                                    {formatRecorrenciaLabel(task)
                                      ? ` â€¢ ${formatRecorrenciaLabel(task)}`
                                      : ""}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    <div className="grid gap-1">
                                      <span>
                                        {formatDateOnlyPtBr(
                                          task.prazoConclusao,
                                        )}
                                      </span>
                                      {formatTaskTimeLabel(task) ? (
                                        <span>
                                          Horario: {formatTaskTimeLabel(task)}
                                        </span>
                                      ) : null}
                                      {(() => {
                                        const signal = getTaskSignal(
                                          task.prazoConclusao,
                                        );
                                        return signal ? (
                                          <span
                                            aria-label={`Prazo da tarefa ${deadlineSignalLabel(signal).toLowerCase()}. ${
                                              signal === "atrasado"
                                                ? "Prazo vencido."
                                                : "Prazo no prazo."
                                            }`}
                                            className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineSignalTone(signal)}`}
                                            title={`Prazo da tarefa: ${formatDateOnlyPtBr(task.prazoConclusao)}. ${
                                              signal === "atrasado"
                                                ? "Prazo vencido."
                                                : "Prazo no prazo."
                                            }`}
                                          >
                                            {deadlineSignalLabel(signal)}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {task.setorDestino
                                      ? `${task.setorDestino.sigla} - ${task.setorDestino.nomeCompleto}`
                                      : "-"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {task.geradaAutomaticamente
                                      ? "Fluxo do assunto"
                                      : "LanÃ§amento manual"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-950">
                      Gestao de tarefas centralizada
                    </p>
                    <p className="mt-1">
                      Use o botao <span className="font-semibold">Tarefas</span>{" "}
                      na barra superior para criar, editar, concluir, excluir e
                      reorganizar tarefas deste processo.
                    </p>
                  </div>

                  {!tarefasLoaded && tarefasLoading ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      Carregando tarefas...
                    </p>
                  ) : pendingTasks.length === 0 ? (
                    <EmptyState
                      description="Nenhuma tarefa pendente no momento. Use o modal de tarefas para criar ou revisar o checklist."
                      title="Sem tarefas pendentes"
                    />
                  ) : (
                    <div className="grid gap-3">
                      {pendingTasks.map((task) => (
                        <div
                          className="rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                          key={task.id}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              className="mt-1 h-4 w-4 shrink-0 accent-slate-950"
                              onChange={() =>
                                void runMutation(
                                  async () => {
                                    await concluirPreDemandaTarefa(
                                      preId,
                                      task.id,
                                    );
                                    await loadTarefasData(true);
                                  },
                                  formatRecorrenciaLabel(task)
                                    ? "Tarefa concluida. Nova ocorrencia gerada."
                                    : "Tarefa concluida.",
                                )
                              }
                              type="checkbox"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-950">
                                {task.descricao}
                              </p>
                              {formatTaskTimeLabel(task) ? (
                                <p className="mt-1 text-sm font-medium text-sky-700">
                                  Horario: {formatTaskTimeLabel(task)}
                                </p>
                              ) : null}
                              <p className="text-sm text-slate-500">
                                {task.tipo}
                                {formatRecorrenciaLabel(task)
                                  ? ` - ${formatRecorrenciaLabel(task)}`
                                  : ""}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>
                                  Prazo:{" "}
                                  {formatDateOnlyPtBr(task.prazoConclusao)}
                                </span>
                                {task.setorDestino ? (
                                  <span>
                                    Setor destino: {task.setorDestino.sigla}
                                  </span>
                                ) : null}
                                <span>
                                  {task.geradaAutomaticamente
                                    ? "Fluxo do assunto"
                                    : "Lancamento manual"}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-start gap-2">
                              <Button
                                onClick={() => openTaskEditor(task)}
                                size="sm"
                                type="button"
                                variant="secondary"
                              >
                                Editar
                              </Button>
                              <Button
                                onClick={() => setDeleteTask(task)}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                Excluir
                              </Button>
                              {(() => {
                                const signal = getTaskSignal(
                                  task.prazoConclusao,
                                );
                                return signal ? (
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineSignalTone(signal)}`}
                                  >
                                    {deadlineSignalLabel(signal)}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </DetailSectionCard>
        </div>

        <div className="grid content-start gap-6">
          <DetailSectionCard
            defaultOpen
            summary={sectionSummaries?.historico}
            title="HistÃ³rico (Andamentos)"
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>HistÃ³rico (Andamentos)</CardTitle>
                  <CardDescription>
                    Timeline unificada com criacao, status, SEI, tramitacoes,
                    tarefas e lancamentos manuais.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setToolbarDialog("andamento")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Novo andamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              {timeline.length === 0 ? (
                <EmptyState
                  description="Assim que houver qualquer movimentacao operacional, os eventos aparecem aqui."
                  title="Sem eventos registrados"
                />
              ) : (
                <Timeline
                  events={timeline}
                  renderActions={(event) => {
                    if (event.type !== "andamento") {
                      return null;
                    }

                    const andamentoId = event.id.startsWith("andamento-")
                      ? event.id.slice("andamento-".length)
                      : event.id;
                    if (!editableAndamentoIds.has(andamentoId)) {
                      return null;
                    }

                    const andamento = editableAndamentos.get(andamentoId);
                    if (!andamento) {
                      return null;
                    }

                    return (
                      <>
                        <Button
                          onClick={() => setEditingAndamento(andamento)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Editar
                        </Button>
                        <Button
                          onClick={() => setDeleteAndamento(andamento)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Excluir
                        </Button>
                      </>
                    );
                  }}
                />
              )}
            </CardContent>
          </DetailSectionCard>
        </div>
      </div>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "summary"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo executivo</DialogTitle>
            <DialogDescription>{nextAction.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill status={record.status} />
              {record.metadata.urgente ? (
                <span className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  Urgente
                </span>
              ) : null}
              <QueueHealthPill item={record} />
            </div>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">
                {nextAction.title}
              </p>
              <p className="mt-2 text-sm text-amber-800">
                {nextAction.description}
              </p>
            </div>
            <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
              <SummaryItem
                label="Primeira pessoa vinculada"
                value={record.pessoaPrincipal?.nome ?? "-"}
              />
              <SummaryItem
                label="Setor atual"
                value={
                  record.setorAtual
                    ? `${record.setorAtual.sigla} - ${record.setorAtual.nomeCompleto}`
                    : "Nao tramitado"
                }
              />
              <SummaryItem
                label="Prazo do processo"
                value={
                  record.status === "encerrada" ? (
                    "-"
                  ) : (
                    <div className="grid gap-1">
                      <span>{formatDateOnlyPtBr(record.prazoProcesso)}</span>
                      <DeadlineStatusPill signal={record.prazoStatus ?? null} />
                    </div>
                  )
                }
              />
              <SummaryItem
                label="Prazo da tarefa"
                value={
                  record.status === "encerrada" ? (
                    "-"
                  ) : record.proximoPrazoTarefa ? (
                    <div className="grid gap-1">
                      <span>
                        {formatDateOnlyPtBr(
                          record.proximoPrazoTarefa,
                          "Sem tarefas pendentes",
                        )}
                      </span>
                      <DeadlineStatusPill
                        signal={getDeadlineSignal(record.proximoPrazoTarefa)}
                      />
                    </div>
                  ) : (
                    "Sem tarefas pendentes"
                  )
                }
              />
              <SummaryItem
                label="Numero principal"
                value={record.principalNumero}
              />
              <SummaryItem
                label="Urgencia"
                value={record.metadata.urgente ? "Urgente" : "Fluxo normal"}
              />
              <SummaryItem
                label="Pagamento envolvido"
                value={
                  record.metadata.pagamentoEnvolvido ? "Sim" : "Nao informado"
                }
              />
              <SummaryItem
                label="Recorrencia no processo"
                value="Configurada por tarefa"
              />
              <SummaryItem
                label="Data da audiencia"
                value={
                  record.metadata.audienciaHorarioInicio
                    ? formatDateTimePtBrSafe(
                        record.metadata.audienciaHorarioInicio,
                      )
                    : formatDateOnlyPtBr(record.metadata.audienciaData)
                }
              />
              <SummaryItem
                label="Status da audiencia"
                value={record.metadata.audienciaStatus ?? "-"}
              />
              <SummaryItem
                label="Sala da audiencia"
                value={record.metadata.audienciaSala ?? "-"}
              />
              <SummaryItem
                label="SEIs relacionados"
                value={
                  seiLoading && !seiLoaded
                    ? "Carregando..."
                    : seiAssociations.length
                      ? seiAssociations.map((item) => item.seiNumero).join(", ")
                      : (record.currentAssociation?.seiNumero ??
                        "Ainda nao associado")
                }
              />
              <SummaryItem
                label="Ultima movimentacao"
                value={
                  lastEvent
                    ? `${new Date(lastEvent.occurredAt).toLocaleString("pt-BR")} - ${lastEvent.descricao ?? "Evento registrado"}`
                    : "Nenhum evento registrado"
                }
              />
              <SummaryItem label="Saude da fila" value={queueHealth.summary} />
              <SummaryItem label="Detalhe da fila" value={queueHealth.detail} />
              <SummaryItem
                label="Proximos estados permitidos"
                value={
                  record.allowedNextStatuses.length
                    ? formatAllowedStatuses(record.allowedNextStatuses)
                    : "Nenhuma transicao manual disponivel"
                }
              />
              <SummaryItem
                label="Data de conclusao"
                value={formatDateOnlyPtBr(record.dataConclusao)}
              />
              <SummaryItem
                className="md:col-span-2"
                label="Anotacoes"
                value={record.anotacoes ?? "-"}
              />
            </div>
            <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Assuntos vinculados
                  </p>
                  <p className="text-xs text-slate-500">
                    Assuntos com procedimentos criam tarefas automÃ¡ticas e usam
                    o prazo do processo.
                  </p>
                </div>
                {assuntosLinked.some(
                  (item) => item.assunto.procedimentos.length > 0,
                ) ? (
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-200">
                    Checklist automÃ¡tico ativo
                  </span>
                ) : assuntosCatalogoLoaded ? (
                  <p className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    Nenhum assunto disponivel para vincular.
                  </p>
                ) : null}
              </div>

              {assuntosLoading && !assuntosLoaded ? (
                <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  Carregando assuntos vinculados...
                </p>
              ) : assuntosLinked.length === 0 ? (
                <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  Nenhum assunto vinculado.
                </p>
              ) : (
                <div className="grid gap-3">
                  {assuntosLinked.map((item) => (
                    <div
                      className="rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                      key={item.assunto.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {item.assunto.nome}
                          </p>
                          <p className="text-sm text-slate-500">
                            {item.assunto.procedimentos.length} passos â€¢{" "}
                            {item.assunto.normas.length} normas
                          </p>
                          {item.assunto.normas.length ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Normas:{" "}
                              {item.assunto.normas
                                .map((norma) => norma.numero)
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          onClick={() =>
                            void runMutation(async () => {
                              const next = await removePreDemandaAssunto(
                                preId,
                                item.assunto.id,
                              );
                              setRecord(next);
                              syncRecordDependentState(next);
                              await refreshAssuntosViewData();
                            }, "Assunto removido e tarefas automÃ¡ticas pendentes foram revistas.")
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Remover
                        </Button>
                      </div>
                      {item.assunto.procedimentos.length ? (
                        <ol className="mt-3 grid gap-2 text-sm text-slate-600">
                          {item.assunto.procedimentos.map((procedimento) => (
                            <li
                              className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                              key={procedimento.id}
                            >
                              <span className="font-semibold">
                                {procedimento.ordem}.{" "}
                              </span>
                              {procedimento.descricao}
                              {procedimento.setorDestino ? (
                                <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                                  â†’ {procedimento.setorDestino.sigla}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {availableAssuntos.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {availableAssuntos.map((assunto) => (
                    <button
                      className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-sm hover:border-slate-400"
                      key={assunto.id}
                      onClick={() =>
                        void runMutation(async () => {
                          const result = await addPreDemandaAssunto(
                            preId,
                            assunto.id,
                          );
                          const next = result.item;
                          setRecord(next);
                          syncRecordDependentState(next);
                          await refreshAssuntosViewData();
                          return composeAutoReopenSuccessMessage(
                            `Assunto ${assunto.nome} vinculado e checklist gerado.`,
                            result.autoReopen,
                          );
                        }, `Assunto ${assunto.nome} vinculado e checklist gerado.`)
                      }
                      type="button"
                    >
                      <span className="block font-semibold text-slate-950">
                        {assunto.nome}
                      </span>
                      <span className="block text-slate-500">
                        {assunto.procedimentos.length} passos â€¢{" "}
                        {assunto.normas.length} normas
                      </span>
                      {assunto.procedimentos.length ? (
                        <span className="mt-1 block text-xs font-medium uppercase tracking-[0.14em] text-sky-700">
                          Vai criar checklist automÃ¡tico
                        </span>
                      ) : (
                        <span className="mt-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                          Sem checklist automÃ¡tico
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "subjects"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assuntos do processo</DialogTitle>
            <DialogDescription>
              Adicione ou remova assuntos. Assuntos com procedimentos podem
              gerar checklist automatico.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Assuntos vinculados
                </p>
                <p className="text-xs text-slate-500">
                  Assuntos com procedimentos criam tarefas automaticas e usam o
                  prazo do processo.
                </p>
              </div>
              {assuntosLinked.some(
                (item) => item.assunto.procedimentos.length > 0,
              ) ? (
                <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-200">
                  Checklist automatico ativo
                </span>
              ) : null}
            </div>

            {assuntosLoading && !assuntosLoaded ? (
              <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                Carregando assuntos vinculados...
              </p>
            ) : assuntosLinked.length === 0 ? (
              <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                Nenhum assunto vinculado.
              </p>
            ) : (
              <div className="grid gap-3">
                {assuntosLinked.map((item) => (
                  <div
                    className="rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                    key={item.assunto.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {item.assunto.nome}
                        </p>
                        <p className="text-sm text-slate-500">
                          {item.assunto.procedimentos.length} passos â€¢{" "}
                          {item.assunto.normas.length} normas
                        </p>
                        {item.assunto.normas.length ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Normas:{" "}
                            {item.assunto.normas
                              .map((norma) => norma.numero)
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        onClick={() =>
                          void runMutation(async () => {
                            const next = await removePreDemandaAssunto(
                              preId,
                              item.assunto.id,
                            );
                            setRecord(next);
                            syncRecordDependentState(next);
                            syncAssuntosState(next.assuntos);
                            await Promise.all([
                              refreshAssuntosViewData(),
                              loadTarefasData(true),
                            ]);
                          }, "Assunto removido e tarefas automaticas pendentes foram revistas.")
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remover
                      </Button>
                    </div>
                    {item.assunto.procedimentos.length ? (
                      <ol className="mt-3 grid gap-2 text-sm text-slate-600">
                        {item.assunto.procedimentos.map((procedimento) => (
                          <li
                            className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                            key={procedimento.id}
                          >
                            <span className="font-semibold">
                              {procedimento.ordem}.{" "}
                            </span>
                            {procedimento.descricao}
                            {procedimento.setorDestino ? (
                              <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                                â†’ {procedimento.setorDestino.sigla}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {assuntosCatalogoLoading && !assuntosCatalogoLoaded ? (
              <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                Carregando catalogo de assuntos...
              </p>
            ) : availableAssuntos.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {availableAssuntos.map((assunto) => (
                  <button
                    className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-sm hover:border-slate-400"
                    key={assunto.id}
                    onClick={() =>
                      void runMutation(async () => {
                        const result = await addPreDemandaAssunto(
                          preId,
                          assunto.id,
                        );
                        const next = result.item;
                        setRecord(next);
                        syncRecordDependentState(next);
                        syncAssuntosState(next.assuntos);
                        await Promise.all([
                          refreshAssuntosViewData(),
                          loadTarefasData(true),
                        ]);
                        return composeAutoReopenSuccessMessage(
                          `Assunto ${assunto.nome} vinculado e checklist gerado.`,
                          result.autoReopen,
                        );
                      }, `Assunto ${assunto.nome} vinculado e checklist gerado.`)
                    }
                    type="button"
                  >
                    <span className="block font-semibold text-slate-950">
                      {assunto.nome}
                    </span>
                    <span className="block text-slate-500">
                      {assunto.procedimentos.length} passos â€¢{" "}
                      {assunto.normas.length} normas
                    </span>
                    {assunto.procedimentos.length ? (
                      <span className="mt-1 block text-xs font-medium uppercase tracking-[0.14em] text-sky-700">
                        Vai criar checklist automatico
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                        Sem checklist automatico
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : assuntosCatalogoLoaded ? (
              <p className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                Nenhum assunto disponivel para vincular.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "people"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pessoas vinculadas</DialogTitle>
            <DialogDescription>
              Cadastro relacional das pessoas ligadas ao processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                onChange={(event) => setInteressadoSearch(event.target.value)}
                placeholder="Buscar pessoa..."
                value={interessadoSearch}
              />
              <Button
                onClick={() =>
                  interessadoResults[0]
                    ? void runMutation(async () => {
                        const nextInteressados = await addPreDemandaInteressado(
                          preId,
                          {
                            interessado_id: interessadoResults[0]!.id,
                            papel: "interessado",
                          },
                        );
                        setInteressados(nextInteressados);
                        setInteressadosLoaded(true);
                      }, "Pessoa vinculada.")
                    : undefined
                }
                type="button"
                variant="secondary"
              >
                <UserPlus className="h-4 w-4" />
                Vincular primeiro
              </Button>
            </div>

            {interessadoResults.length > 0 ? (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Resultados
                </p>
                <div className="grid gap-2">
                  {interessadoResults.map((item) => (
                    <button
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-slate-300"
                      key={item.id}
                      onClick={() =>
                        void runMutation(async () => {
                          const nextInteressados =
                            await addPreDemandaInteressado(preId, {
                              interessado_id: item.id,
                              papel: "interessado",
                            });
                          setInteressados(nextInteressados);
                          setInteressadosLoaded(true);
                        }, "Pessoa vinculada.")
                      }
                      type="button"
                    >
                      <span>
                        <span className="block font-semibold text-slate-950">
                          {item.nome}
                        </span>
                        <span className="block text-slate-500">
                          {item.cargo ??
                            item.cpf ??
                            item.matricula ??
                            "Sem identificador adicional"}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-[24px] border border-dashed border-slate-300 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Adicionar nova pessoa
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  onChange={(event) =>
                    setNewInteressadoForm((current) => ({
                      ...current,
                      nome: event.target.value,
                    }))
                  }
                  placeholder="Nome"
                  value={newInteressadoForm.nome}
                />
                <Input
                  onChange={(event) =>
                    setNewInteressadoForm((current) => ({
                      ...current,
                      cargo: event.target.value,
                    }))
                  }
                  placeholder="Cargo"
                  value={newInteressadoForm.cargo}
                />
                <Input
                  onChange={(event) =>
                    setNewInteressadoForm((current) => ({
                      ...current,
                      matricula: event.target.value,
                    }))
                  }
                  placeholder="Matricula"
                  value={newInteressadoForm.matricula}
                />
                <Input
                  onChange={(event) =>
                    setNewInteressadoForm((current) => ({
                      ...current,
                      cpf: event.target.value,
                    }))
                  }
                  placeholder="CPF"
                  value={newInteressadoForm.cpf}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  disabled={newInteressadoForm.nome.trim().length < 3}
                  onClick={() =>
                    void runMutation(async () => {
                      const created = await createPessoa({
                        nome: newInteressadoForm.nome,
                        cargo: newInteressadoForm.cargo || null,
                        matricula: newInteressadoForm.matricula || null,
                        cpf: newInteressadoForm.cpf || null,
                      });
                      const nextInteressados = await addPreDemandaInteressado(
                        preId,
                        { interessado_id: created.id, papel: "interessado" },
                      );
                      setInteressados(nextInteressados);
                      setInteressadosLoaded(true);
                      setNewInteressadoForm({
                        nome: "",
                        cargo: "",
                        matricula: "",
                        cpf: "",
                      });
                      setInteressadoSearch(created.nome);
                      setInteressadoResults([created]);
                    }, "Pessoa criada e vinculada.")
                  }
                  type="button"
                >
                  Criar e vincular
                </Button>
              </div>
            </div>

            {interessadosLoading && !interessadosLoaded ? (
              <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Carregando pessoas vinculadas...
              </p>
            ) : interessados.length === 0 ? (
              <EmptyState
                description="Vincule pessoas ao processo para destravar tarefas, tramitacoes e relacoes processuais."
                title="Sem pessoas vinculadas"
              />
            ) : (
              <div className="grid gap-3">
                {interessados.map((item) => (
                  <div
                    className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                    key={item.interessado.id}
                  >
                    <div>
                      <p className="font-semibold text-slate-950">
                        {item.interessado.nome}
                      </p>
                      <p className="text-sm text-slate-500">
                        Interessado -{" "}
                        {item.interessado.cargo ??
                          item.interessado.cpf ??
                          item.interessado.matricula ??
                          "Sem CPF/matricula"}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        void runMutation(async () => {
                          const nextInteressados =
                            await removePreDemandaInteressado(
                              preId,
                              item.interessado.id,
                            );
                          setInteressados(nextInteressados);
                          setInteressadosLoaded(true);
                        }, "Pessoa removida.")
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "sectors"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setores ativos</DialogTitle>
            <DialogDescription>
              O mesmo processo pode correr em paralelo por mais de um setor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {activeSetoresLoading && !activeSetoresLoaded ? (
              <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                Carregando setores ativos...
              </p>
            ) : setoresAtivos.length === 0 ? (
              <EmptyState
                description="Abra a acao Tramitar para distribuir o processo entre um ou mais setores."
                title="Sem setores ativos"
              />
            ) : (
              setoresAtivos.map((item) => (
                <div
                  className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                  key={item.id}
                >
                  <div>
                    <p className="font-semibold text-slate-950">
                      {item.setor.sigla} - {item.setor.nomeCompleto}
                    </p>
                    <p className="text-sm text-slate-500">
                      Activo desde{" "}
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                      {item.origemSetor
                        ? ` | origem ${item.origemSetor.sigla}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    disabled={isSubmitting}
                    onClick={() =>
                      void runMutation(async () => {
                        await concluirTramitacaoSetor(preId, item.setor.id);
                        await loadSetoresAtivosData(true);
                      }, `Tramitacao concluida em ${item.setor.sigla}.`)
                    }
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Concluir
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "relatedList"}
      >
        <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relacionamentos de processo</DialogTitle>
            <DialogDescription>
              Vincule, consulte e remova relacionamentos deste processo em um
              unico lugar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Vincular processo existente
                </p>
                <p className="text-xs text-slate-500">
                  Pesquise por PRE, numero SEI ou assunto para adicionar um
                  vinculo existente.
                </p>
              </div>
              <Input
                onChange={(event) => setProcessSearch(event.target.value)}
                placeholder="Buscar por PRE, numero SEI ou assunto"
                value={processSearch}
              />
              <div className="grid gap-2">
                {linkedProcessResults.map((item) => (
                  <button
                    className="flex min-w-0 items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-300"
                    key={item.preId}
                    onClick={() =>
                      void runMutation(async () => {
                        await addPreDemandaVinculo(preId, item.preId);
                        await loadVinculosData(true);
                        await loadTimelineData();
                        setToolbarDialog("relatedList");
                      }, "Vinculo criado.")
                    }
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block break-words font-semibold text-slate-950">
                        {item.principalNumero}
                      </span>
                      <span className="block break-words text-xs text-slate-400">
                        {item.preId}
                      </span>
                      <span className="block break-words text-sm text-slate-500">
                        {item.assunto}
                      </span>
                    </span>
                    <Plus className="h-4 w-4 text-slate-500" />
                  </button>
                ))}
                {processSearch.trim().length >= 2 &&
                linkedProcessResults.length === 0 ? (
                  <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    Nenhum processo encontrado para este termo.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Relacionamentos ativos
                </p>
                <p className="text-xs text-slate-500">
                  Consulte os vinculos atuais, abra o processo relacionado ou
                  remova a associacao.
                </p>
              </div>
              {relatedLoading && !relatedLoaded ? (
                <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  Carregando relacionamentos...
                </p>
              ) : vinculos.length === 0 ? (
                <EmptyState
                  description="Nenhum relacionamento criado ate agora."
                  title="Sem vinculos"
                />
              ) : (
                vinculos.map((item) => (
                  <div
                    className="flex min-w-0 items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                    key={item.processo.preId}
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-950">
                        {item.processo.principalNumero}
                      </p>
                      <p className="break-words text-xs text-slate-400">
                        {item.processo.preId}
                      </p>
                      <p className="break-words text-sm text-slate-500">
                        {item.processo.assunto}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        onClick={() =>
                          navigate(buildPreDemandaPath(item.processo.preId))
                        }
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Abrir
                      </Button>
                      <Button
                        onClick={() =>
                          void runMutation(async () => {
                            await removePreDemandaVinculo(
                              preId,
                              item.processo.preId,
                            );
                            await loadVinculosData(true);
                            await loadTimelineData();
                          }, "Vinculo removido.")
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "seiAssociation"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Associacao PRE para SEI</DialogTitle>
            <DialogDescription>
              Validacao e mascara seguem o backend para manter o vinculo
              confiavel.
            </DialogDescription>
          </DialogHeader>
          {seiLoading && !seiLoaded ? (
            <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Carregando associacoes SEI...
            </p>
          ) : seiAssociations.length ? (
            <div className="mb-4 grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Associacoes registradas
              </p>
              {seiAssociations.map((item) => (
                <div
                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                  key={`${item.seiNumero}-${item.updatedAt}`}
                >
                  <p className="font-semibold text-slate-950">
                    {item.seiNumero}
                  </p>
                  <p>
                    {item.principal ? "Principal" : "Historico"} - atualizado em{" "}
                    {new Date(item.updatedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <form className="grid gap-4" onSubmit={handleAssociation}>
            <FormField hint={<code>000181/26-02.227</code>} label="Numero SEI">
              <Input
                onChange={(event) =>
                  setAssociationForm((current) => ({
                    ...current,
                    sei_numero: formatSeiInput(event.target.value),
                  }))
                }
                placeholder="000181/26-02.227"
                value={associationForm.sei_numero}
              />
            </FormField>
            <FormField label="Motivo">
              <Textarea
                onChange={(event) =>
                  setAssociationForm((current) => ({
                    ...current,
                    motivo: event.target.value,
                  }))
                }
                rows={3}
                value={associationForm.motivo}
              />
            </FormField>
            <FormField label="Observacoes">
              <Textarea
                onChange={(event) =>
                  setAssociationForm((current) => ({
                    ...current,
                    observacoes: event.target.value,
                  }))
                }
                rows={3}
                value={associationForm.observacoes}
              />
            </FormField>
            <div className="flex justify-end">
              <Button disabled={!isSeiValid || isSubmitting} type="submit">
                Salvar associacao
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "documents"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documentos</DialogTitle>
            <DialogDescription>
              Anexos operacionais do processo, com download directo no detalhe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-[24px] border border-dashed border-slate-300 p-4">
              <Input
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    file: event.target.files?.[0] ?? null,
                  }))
                }
                type="file"
              />
              <Textarea
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    descricao: event.target.value,
                  }))
                }
                placeholder="Descricao do documento"
                rows={3}
                value={documentForm.descricao}
              />
              <div className="flex justify-end">
                <Button
                  disabled={!documentForm.file || isSubmitting}
                  onClick={() => void handleDocumentoUpload()}
                  type="button"
                >
                  Anexar documento
                </Button>
              </div>
            </div>
            {documentsLoading && !documentsLoaded ? (
              <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Carregando documentos...
              </p>
            ) : documentos.length === 0 ? (
              <EmptyState
                description="Nenhum documento foi anexado a este processo."
                title="Sem documentos"
              />
            ) : (
              documentos.map((item) => (
                <div
                  className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                  key={item.id}
                >
                  <div>
                    <p className="font-semibold text-slate-950">
                      {item.nomeArquivo}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatBytes(item.tamanhoBytes)} |{" "}
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </p>
                    {item.descricao ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {item.descricao}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        void downloadPreDemandaDocumento(
                          preId,
                          item.id,
                          item.nomeArquivo,
                        )
                      }
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Baixar
                    </Button>
                    <Button
                      onClick={() =>
                        void runMutation(async () => {
                          await removePreDemandaDocumento(preId, item.id);
                          await loadDocumentosData(true);
                        }, "Documento removido.")
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "comments"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comentarios ricos</DialogTitle>
            <DialogDescription>
              Registos de colaboracao em markdown simples, preservados junto ao
              processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Textarea
              onChange={(event) => setCommentForm(event.target.value)}
              placeholder="Escreva um comentario operacional, contexto de decisao ou combinacao entre setores..."
              rows={5}
              value={commentForm}
            />
            <div className="flex justify-end">
              <Button
                disabled={commentForm.trim().length < 1 || isSubmitting}
                onClick={() =>
                  void runMutation(async () => {
                    await createPreDemandaComentario(preId, {
                      conteudo: commentForm,
                      formato: "markdown",
                    });
                    setCommentForm("");
                    await loadComentariosData(true);
                  }, "Comentario registrado.")
                }
                type="button"
              >
                Publicar comentario
              </Button>
            </div>
            {commentsLoading && !commentsLoaded ? (
              <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Carregando comentarios...
              </p>
            ) : comentarios.length === 0 ? (
              <EmptyState
                description="Ainda nao ha conversa registrada neste processo."
                title="Sem comentarios"
              />
            ) : (
              comentarios.map((item) => (
                <div
                  className="rounded-[22px] border border-slate-200 bg-white px-4 py-3"
                  key={item.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">
                      {item.createdBy?.name ?? "Sistema"}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    {item.conteudo}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "edit"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consultar / Alterar processo</DialogTitle>
            <DialogDescription>
              Atualize os dados principais e o metadata operacional do processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Assunto">
              <Input
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    assunto: event.target.value,
                  }))
                }
                value={editForm.assunto}
              />
            </FormField>
            <FormField label="Descricao">
              <Textarea
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    descricao: event.target.value,
                  }))
                }
                rows={4}
                value={editForm.descricao}
              />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Fonte">
                <Input
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      fonte: event.target.value,
                    }))
                  }
                  value={editForm.fonte}
                />
              </FormField>
              <FormField label="Numero judicial">
                <Input
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      numero_judicial:
                        formatNumeroJudicialInput(event.target.value) ?? "",
                    }))
                  }
                  placeholder="0000000-00.0000.0.00.0000"
                  value={editForm.numero_judicial}
                />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Prazo do processo">
                <Input
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      prazo_processo: event.target.value,
                    }))
                  }
                  type="date"
                  value={editForm.prazo_processo}
                />
              </FormField>
              <FormField label="Recorrencia">
                <Input
                  disabled
                  value="A recorrencia agora e definida por tarefa"
                />
              </FormField>
            </div>
            <label className="flex items-center justify-between rounded-[24px] border border-sky-100/90 bg-white/90 px-4 py-3 text-sm shadow-[0_10px_22px_rgba(20,33,61,0.04)]">
              <span>
                <span className="block font-semibold text-slate-950">
                  Pagamento envolvido
                </span>
                <span className="text-slate-500">
                  Indicador rapido do prazo do processo.
                </span>
              </span>
              <input
                checked={editForm.pagamento_envolvido}
                className="h-5 w-5 accent-slate-950"
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    pagamento_envolvido: event.target.checked,
                  }))
                }
                type="checkbox"
              />
            </label>
            <label className="flex items-center justify-between rounded-[24px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm shadow-[0_10px_22px_rgba(190,24,93,0.08)]">
              <span>
                <span className="block font-semibold text-slate-950">
                  Marcar como urgente
                </span>
                <span className="text-slate-500">
                  Destaque operativo para tratamento prioritÃ¡rio.
                </span>
              </span>
              <input
                checked={editForm.urgente}
                className="h-5 w-5 accent-rose-600"
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    urgente: event.target.checked,
                  }))
                }
                type="checkbox"
              />
            </label>
            <FormField label="Observacoes principais">
              <Textarea
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    observacoes: event.target.value,
                  }))
                }
                rows={4}
                value={editForm.observacoes}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setToolbarDialog(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() =>
                void runMutation(
                  async () => {
                    const res = await updatePreDemandaCase(preId, {
                      assunto: editForm.assunto,
                      descricao: editForm.descricao || null,
                      fonte: editForm.fonte || null,
                      observacoes: editForm.observacoes || null,
                      prazo_processo: editForm.prazo_processo || null,
                      numero_judicial: editForm.numero_judicial || null,
                      metadata: {
                        pagamento_envolvido: editForm.pagamento_envolvido,
                        urgente: editForm.urgente,
                      },
                    });
                    setToolbarDialog(null);
                    return res;
                  },
                  "Processo atualizado.",
                  (res) => {
                    if ((res as { data?: { reopen?: { wasReopened?: boolean; reason?: string } } })?.data?.reopen?.wasReopened) {
                      setReopenAlert(`Motivo: ${(res as { data?: { reopen?: { reason?: string } } }).data?.reopen?.reason ?? ""}`);
                    }
                  },
                )
              }
              type="button"
            >
              Salvar alteracoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "send"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar processo</DialogTitle>
            <DialogDescription>
              Selecione o setor destino para registrar a tramitacao
              automaticamente no historico.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Setor destino">
            <div className="grid gap-2">
              {setores.map((item) => {
                const checked = tramitarSetorIds.includes(item.id);
                return (
                  <label
                    className="flex items-center justify-between rounded-[24px] border border-sky-100/90 bg-white/90 px-4 py-3 text-sm shadow-[0_10px_22px_rgba(20,33,61,0.04)]"
                    key={item.id}
                  >
                    <span>
                      {item.sigla} - {item.nomeCompleto}
                    </span>
                    <input
                      checked={checked}
                      className="h-4 w-4 accent-slate-950"
                      onChange={(event) =>
                        setTramitarSetorIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter(
                                (candidate) => candidate !== item.id,
                              ),
                        )
                      }
                      type="checkbox"
                    />
                  </label>
                );
              })}
            </div>
          </FormField>
          {!setores.length && hasPermission("cadastro.setor.write") ? (
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Nenhum setor cadastrado. Abra o cadastro de setores para habilitar
              a tramitacao.
            </div>
          ) : null}
          <DialogFooter>
            {hasPermission("cadastro.setor.write") ? (
              <Button
                onClick={() => navigate("/setores")}
                type="button"
                variant="secondary"
              >
                Abrir setores
              </Button>
            ) : null}
            <Button
              onClick={() => setToolbarDialog(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={!tramitarSetorIds.length || isSubmitting}
              onClick={() =>
                void runMutation(
                  () =>
                    tramitarPreDemandaMultiplos(preId, tramitarSetorIds).then(
                      () => {
                        setToolbarDialog(null);
                        setTramitarSetorIds([]);
                      },
                    ),
                  "Processo tramitado.",
                )
              }
              type="button"
            >
              Remeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "notes"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anotacoes</DialogTitle>
            <DialogDescription>
              Espelho do post-it operacional do SEI para observacoes de trabalho
              rapido.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            onChange={(event) => setNotesForm(event.target.value)}
            rows={8}
            value={notesForm}
          />
          <DialogFooter>
            <Button
              onClick={() => setToolbarDialog(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() =>
                void runMutation(
                  () =>
                    updatePreDemandaAnotacoes(preId, notesForm || null).then(
                      () => setToolbarDialog(null),
                    ),
                  "Anotacoes atualizadas.",
                )
              }
              type="button"
            >
              Salvar anotacoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "deadline"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prazo do processo</DialogTitle>
            <DialogDescription>
              Defina a data-limite geral. Nenhuma tarefa pode ultrapassar este
              prazo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Prazo do processo">
              <Input
                onChange={(event) =>
                  setDeadlineForm((current) => ({
                    ...current,
                    prazo_processo: event.target.value,
                  }))
                }
                type="date"
                value={deadlineForm.prazo_processo}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setToolbarDialog(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() =>
                void runMutation(
                  async () => {
                    const res = await updatePreDemandaCase(preId, {
                      prazo_processo: deadlineForm.prazo_processo || null,
                    });
                    setToolbarDialog(null);
                    return res;
                  },
                  "Prazos atualizados.",
                  (res) => {
                    if ((res as { data?: { reopen?: { wasReopened?: boolean; reason?: string } } })?.data?.reopen?.wasReopened) {
                      setReopenAlert(`Motivo: ${(res as { data?: { reopen?: { reason?: string } } }).data?.reopen?.reason ?? ""}`);
                    }
                  },
                )
              }
              type="button"
            >
              Salvar prazos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setToolbarDialog(null);
            resetAudienciaForm();
          }
        }}
        open={toolbarDialog === "audiencias"}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audiencias judiciais</DialogTitle>
            <DialogDescription>
              Cadastro estruturado da audiÃªncia com data, hora, sala, descricao
              e situacao.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">
                PrÃ³xima audiÃªncia
              </p>
              <p className="mt-2 text-sm text-amber-800">
                {nextAudiencia
                  ? `${formatDateTimePtBrSafe(nextAudiencia.dataHoraInicio)}${nextAudiencia.sala ? ` â€¢ ${nextAudiencia.sala}` : ""}`
                  : record.metadata.audienciaHorarioInicio
                    ? `${formatDateTimePtBrSafe(record.metadata.audienciaHorarioInicio)}${record.metadata.audienciaStatus ? ` â€¢ ${record.metadata.audienciaStatus}` : ""}`
                    : "Nenhuma audiÃªncia estruturada cadastrada."}
              </p>
              <p className="mt-2 text-xs text-amber-700">
                O resumo do processo passa a refletir automaticamente a prÃ³xima
                audiÃªncia relevante.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Inicio">
                <Input
                  onChange={(event) =>
                    setAudienciaForm((current) => ({
                      ...current,
                      inicio: event.target.value,
                    }))
                  }
                  type="datetime-local"
                  value={audienciaForm.inicio}
                />
              </FormField>
              <FormField label="Fim">
                <Input
                  onChange={(event) =>
                    setAudienciaForm((current) => ({
                      ...current,
                      fim: event.target.value,
                    }))
                  }
                  type="datetime-local"
                  value={audienciaForm.fim}
                />
              </FormField>
              <FormField label="Sala">
                <Input
                  onChange={(event) =>
                    setAudienciaForm((current) => ({
                      ...current,
                      sala: event.target.value,
                    }))
                  }
                  value={audienciaForm.sala}
                />
              </FormField>
              <FormField label="Situacao">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    setAudienciaForm((current) => ({
                      ...current,
                      situacao: event.target.value as AudienciaSituacao,
                    }))
                  }
                  value={audienciaForm.situacao}
                >
                  <option value="designada">Designada</option>
                  <option value="convertida_diligencia">
                    Convertida em DiligÃªncia
                  </option>
                  <option value="nao_realizada">NÃ£o Realizada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </FormField>
            </div>

            <FormField label="Descricao">
              <Textarea
                onChange={(event) =>
                  setAudienciaForm((current) => ({
                    ...current,
                    descricao: event.target.value,
                  }))
                }
                rows={4}
                value={audienciaForm.descricao}
              />
            </FormField>

            <FormField label="Observacoes">
              <Textarea
                onChange={(event) =>
                  setAudienciaForm((current) => ({
                    ...current,
                    observacoes: event.target.value,
                  }))
                }
                rows={3}
                value={audienciaForm.observacoes}
              />
            </FormField>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={resetAudienciaForm}
                type="button"
                variant="ghost"
              >
                Limpar
              </Button>
              <Button
                disabled={!audienciaForm.inicio}
                onClick={() => void handleAudienciaSubmit()}
                type="button"
              >
                {editingAudienciaId
                  ? "Salvar alteracao"
                  : "Cadastrar audiencia"}
              </Button>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">
                  AudiÃªncias cadastradas
                </p>
                <span className="text-xs text-slate-500">
                  {orderedAudiencias.length} cadastrada(s)
                </span>
              </div>

              {!audienciasLoaded && audienciasLoading ? (
                <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Carregando audiencias...
                </p>
              ) : orderedAudiencias.length === 0 ? (
                <EmptyState
                  description="Ainda nao ha audiencias estruturadas neste processo. Use o formulario acima para registrar a primeira."
                  title="Sem audiencias"
                />
              ) : (
                orderedAudiencias.map((item) => (
                  <div
                    className="rounded-[24px] border border-slate-200 bg-white px-4 py-4"
                    key={item.id}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                          {item.situacao}
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {formatDateTimePtBrSafe(item.dataHoraInicio)}
                          {item.dataHoraFim
                            ? ` - ${formatDateTimePtBrSafe(item.dataHoraFim)}`
                            : ""}
                        </p>
                        {item.sala ? (
                          <p className="mt-1 text-sm text-slate-600">
                            Sala: {item.sala}
                          </p>
                        ) : null}
                        {item.descricao ? (
                          <p className="mt-2 text-sm text-slate-700">
                            {item.descricao}
                          </p>
                        ) : null}
                        {item.observacoes ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {item.observacoes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          onClick={() => handleAudienciaEdit(item)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Editar
                        </Button>
                        <Button
                          onClick={() => void handleAudienciaDelete(item.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {record ? (
        <TarefasDialog
          completedTasks={completedTasks}
          isSubmitting={isSubmitting}
          onClose={() => {
            setEditingTask(null);
            setToolbarDialog(null);
          }}
          onApplyTaskSuggestion={(suggestion) =>
            setTaskForm((current) => ({
              ...current,
              prazo_conclusao: suggestion.data,
              horario_inicio: suggestion.horarioInicio,
              horario_fim: suggestion.horarioFim,
            }))
          }
          onCompleteTask={(task) =>
            void runMutation(
              async () => {
                await concluirPreDemandaTarefa(preId, task.id);
                await loadTarefasData(true);
              },
              formatRecorrenciaLabel(task)
                ? "Tarefa concluida. Nova ocorrencia gerada."
                : "Tarefa concluida.",
            )
          }
          onCreateTask={() => void handleCreateTask()}
          onCancelEdit={() => setEditingTask(null)}
          onDeleteTask={(task) => setDeleteTask(task)}
          onEditTask={(task) => setEditingTask(task)}
          onEditTaskFormChange={setEditTaskForm}
          onReorderTasks={handleReorderPendingTasksMotion}
          onSaveTask={() => void handleUpdateTask()}
          onSignatureExpandedChange={(expanded) => {
            setSignatureExpanded(expanded);
            if (!expanded) {
              setSignatureSearch("");
              setSignatureSearchResults([]);
            }
          }}
          onSignatureSearchChange={setSignatureSearch}
          onTaskFormChange={setTaskForm}
          editTaskForm={editTaskForm}
          editingTask={editingTask}
          open={toolbarDialog === "tasks"}
          pendingTasks={pendingTasks}
          interessados={interessados}
          interessadosLoading={interessadosLoading && !interessadosLoaded}
          record={record}
          requiresTaskSetorDestino={requiresTaskSetorDestino}
          requiresTaskSignaturePerson={requiresTaskSignaturePerson}
          setores={setores}
          signatureExpanded={signatureExpanded}
          signatureSearch={signatureSearch}
          signatureSearchResults={signatureSearchResults}
          signatureSelectedName={signatureSelectedName}
          taskSuggestions={taskSuggestions}
          taskSuggestionsLoading={taskSuggestionsLoading}
          taskForm={taskForm}
          taskShortcutOptions={taskShortcutOptions}
        />
      ) : null}

      <Dialog
        onOpenChange={(open) => !open && setToolbarDialog(null)}
        open={toolbarDialog === "andamento"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar andamento manual</DialogTitle>
            <DialogDescription>
              Inclua uma movimentacao livre no historico do processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Data e hora">
              <Input
                onChange={(event) =>
                  setAndamentoForm((current) => ({
                    ...current,
                    data_hora: event.target.value,
                  }))
                }
                type="datetime-local"
                value={andamentoForm.data_hora}
              />
            </FormField>
            <FormField label="Descricao">
              <Textarea
                onChange={(event) =>
                  setAndamentoForm((current) => ({
                    ...current,
                    descricao: event.target.value,
                  }))
                }
                rows={6}
                value={andamentoForm.descricao}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setToolbarDialog(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                andamentoForm.descricao.trim().length < 3 || isSubmitting
              }
              onClick={() =>
                void runMutation(async () => {
                  const result = await addPreDemandaAndamento(preId, {
                    descricao: andamentoForm.descricao,
                    data_hora: toIsoFromDateTimeLocal(andamentoForm.data_hora),
                  });
                  setAndamentoForm({ descricao: "", data_hora: "" });
                  setToolbarDialog(null);
                  return composeAutoReopenSuccessMessage(
                    "Andamento registrado.",
                    result.autoReopen,
                  );
                }, "Andamento registrado.")
              }
              type="button"
            >
              Lancar andamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setEditingAndamento(null)}
        open={Boolean(editingAndamento)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar andamento manual</DialogTitle>
            <DialogDescription>
              Ajuste o texto e a data/hora do andamento manual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Data e hora">
              <Input
                onChange={(event) =>
                  setEditAndamentoForm((current) => ({
                    ...current,
                    data_hora: event.target.value,
                  }))
                }
                type="datetime-local"
                value={editAndamentoForm.data_hora}
              />
            </FormField>
            <FormField label="Descricao">
              <Textarea
                onChange={(event) =>
                  setEditAndamentoForm((current) => ({
                    ...current,
                    descricao: event.target.value,
                  }))
                }
                rows={6}
                value={editAndamentoForm.descricao}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setEditingAndamento(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !editingAndamento ||
                editAndamentoForm.descricao.trim().length < 3 ||
                isSubmitting
              }
              onClick={() =>
                editingAndamento
                  ? void runMutation(async () => {
                      await updatePreDemandaAndamento(
                        preId,
                        editingAndamento.id,
                        {
                          descricao: editAndamentoForm.descricao,
                          data_hora: toIsoFromDateTimeLocal(
                            editAndamentoForm.data_hora,
                          ),
                        },
                      );
                      setEditingAndamento(null);
                    }, "Andamento atualizado.")
                  : undefined
              }
              type="button"
            >
              Salvar alteracoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setDeleteAndamento(null)}
        open={Boolean(deleteAndamento)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir andamento manual</DialogTitle>
            <DialogDescription>
              Esta acao remove o andamento manual e regista a remocao no
              historico. Digite EXCLUIR para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {deleteAndamento?.descricao}
            </div>
            <FormField label="Confirmacao">
              <Input
                onChange={(event) =>
                  setDeleteAndamentoConfirm(event.target.value)
                }
                placeholder="EXCLUIR"
                value={deleteAndamentoConfirm}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setDeleteAndamento(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !deleteAndamento ||
                deleteAndamentoConfirm !== "EXCLUIR" ||
                isSubmitting
              }
              onClick={() =>
                deleteAndamento
                  ? void runMutation(async () => {
                      await removePreDemandaAndamento(
                        preId,
                        deleteAndamento.id,
                      );
                      setDeleteAndamento(null);
                    }, "Andamento removido.")
                  : undefined
              }
              type="button"
              variant="primary"
            >
              Excluir andamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setEditingTask(null)}
        open={false}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
            <DialogDescription>
              Ajuste a descriÃ§ao e o tipo da prÃ³xima tarefa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="DescriÃ§ao">
              <Textarea
                onChange={(event) =>
                  setEditTaskForm((current) => ({
                    ...current,
                    descricao: event.target.value,
                  }))
                }
                rows={5}
                value={editTaskForm.descricao}
              />
            </FormField>
            <FormField label="Tipo">
              <select
                className={selectClassName}
                onChange={(event) =>
                  setEditTaskForm((current) => ({
                    ...current,
                    tipo: event.target.value as "fixa" | "livre",
                  }))
                }
                value={editTaskForm.tipo}
              >
                <option value="livre">Livre</option>
                <option value="fixa">Fixa</option>
              </select>
            </FormField>
            <label className="col-span-2 flex items-center justify-between rounded-[20px] border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-slate-700">
              <div className="pr-4">
                <span className="block font-semibold text-slate-950">
                  Marcar tarefa como urgente
                </span>
                <span className="text-xs text-slate-600">
                  Com a tarefa urgente, o processo tambem fica urgente.
                </span>
              </div>
              <input
                checked={editTaskForm.urgente}
                className="h-5 w-5 accent-rose-600"
                onChange={(event) =>
                  setEditTaskForm((current) => ({
                    ...current,
                    urgente: event.target.checked,
                  }))
                }
                type="checkbox"
              />
            </label>
            <FormField
              hint="Sem recorrÃªncia, esta Ã© a data final da tarefa. Com recorrÃªncia, ela vira a base para as prÃ³ximas ocorrÃªncias."
              label="Prazo da tarefa"
            >
              <Input
                max={record?.prazoProcesso ?? undefined}
                onChange={(event) =>
                  setEditTaskForm((current) => ({
                    ...current,
                    prazo_conclusao: event.target.value,
                  }))
                }
                type="date"
                value={editTaskForm.prazo_conclusao}
              />
            </FormField>
            <FormField
              hint="Escolha apenas se a tarefa precisar voltar a ser criada depois da conclusÃ£o."
              label="RecorrÃªncia"
            >
              <select
                className={selectClassName}
                onChange={(event) =>
                  setEditTaskForm((current) => ({
                    ...current,
                    recorrencia_tipo: event.target.value as
                      | ""
                      | TarefaRecorrenciaTipo,
                    recorrencia_dias_semana:
                      event.target.value === "semanal"
                        ? current.recorrencia_dias_semana
                        : [],
                    recorrencia_dia_mes: [
                      "mensal",
                      "trimestral",
                      "quadrimestral",
                      "semestral",
                      "anual",
                    ].includes(event.target.value)
                      ? current.recorrencia_dia_mes
                      : "",
                  }))
                }
                value={editTaskForm.recorrencia_tipo}
              >
                <option value="">Sem repetiÃ§Ã£o</option>
                <option value="diaria">DiÃ¡ria</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="quadrimestral">Quadrimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </FormField>
            {editTaskForm.recorrencia_tipo ? (
              <div className="col-span-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                Essa recorrÃªncia continua atÃ©{" "}
                {formatDateOnlyPtBr(
                  record?.prazoProcesso,
                  "o prazo do processo",
                )}
                . Depois dessa data, o sistema nao cria novas tarefas.
              </div>
            ) : null}
            {editTaskForm.recorrencia_tipo === "semanal" ? (
              <div className="col-span-2 grid gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Dias da semana
                  </p>
                  <p className="text-xs text-slate-500">
                    Escolha em quais dias a prÃ³xima tarefa deve reaparecer.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((item) => (
                    <Button
                      key={`edit-${item}`}
                      onClick={() =>
                        setEditTaskForm((current) => ({
                          ...current,
                          recorrencia_dias_semana:
                            current.recorrencia_dias_semana.includes(item)
                              ? current.recorrencia_dias_semana.filter(
                                  (value) => value !== item,
                                )
                              : [...current.recorrencia_dias_semana, item],
                        }))
                      }
                      size="sm"
                      type="button"
                      variant={
                        editTaskForm.recorrencia_dias_semana.includes(item)
                          ? "primary"
                          : "outline"
                      }
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {[
              "mensal",
              "trimestral",
              "quadrimestral",
              "semestral",
              "anual",
            ].includes(editTaskForm.recorrencia_tipo) ? (
              <FormField
                hint="A tarefa serÃ¡ repetida nesse mesmo dia conforme a periodicidade escolhida."
                label="Dia do mÃªs"
              >
                <Input
                  max="31"
                  min="1"
                  onChange={(event) =>
                    setEditTaskForm((current) => ({
                      ...current,
                      recorrencia_dia_mes: event.target.value,
                    }))
                  }
                  type="number"
                  value={editTaskForm.recorrencia_dia_mes}
                />
              </FormField>
            ) : editTaskForm.recorrencia_tipo === "diaria" ? (
              <div className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                A recorrÃªncia diÃ¡ria nÃ£o precisa de dia da semana nem dia do
                mÃªs.
              </div>
            ) : (
              <div className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Sem repetiÃ§Ã£o. A tarefa termina no prazo escolhido.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setEditingTask(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !editingTask ||
                editTaskForm.descricao.trim().length < 3 ||
                isSubmitting ||
                !editTaskForm.prazo_conclusao
              }
              onClick={() =>
                editingTask ? void handleUpdateTask() : undefined
              }
              type="button"
            >
              Salvar alteraÃ§oes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setTaskPrazoChange(null)}
        open={false}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteracao de prazo do processo</DialogTitle>
            <DialogDescription>
              {taskPrazoChange?.details.prazoLabel ?? "Este prazo"} ja possui
              uma data gravada neste processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Data anterior:{" "}
              {formatDateOnlyPtBr(taskPrazoChange?.details.prazoDataAnterior)}
            </div>
            <div className="rounded-[20px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Nova data:{" "}
              {formatDateOnlyPtBr(taskPrazoChange?.details.prazoDataNova)}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setTaskPrazoChange(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                if (!taskPrazoChange) {
                  return;
                }
                void (taskPrazoChange.mode === "create"
                  ? handleCreateTask(true)
                  : handleUpdateTask(true));
              }}
              type="button"
            >
              Confirmar alteracao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setDeleteTask(null)}
        open={false}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir tarefa</DialogTitle>
            <DialogDescription>
              Esta aÃ§Ã£o remove a tarefa pendente e registra a remoÃ§Ã£o no
              histÃ³rico. Digite EXCLUIR para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {deleteTask?.descricao}
            </div>
            <FormField label="ConfirmaÃ§Ã£o">
              <Input
                onChange={(event) => setDeleteTaskConfirm(event.target.value)}
                placeholder="EXCLUIR"
                value={deleteTaskConfirm}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setDeleteTask(null)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !deleteTask || deleteTaskConfirm !== "EXCLUIR" || isSubmitting
              }
              onClick={() =>
                deleteTask
                  ? void runMutation(async () => {
                      await removePreDemandaTarefa(preId, deleteTask.id);
                      await loadTarefasData(true);
                      setDeleteTask(null);
                    }, "Tarefa excluÃ­da.")
                  : undefined
              }
              type="button"
              variant="primary"
            >
              Excluir tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TarefaPrazoChangeDialog
        isSubmitting={isSubmitting}
        onClose={() => setTaskPrazoChange(null)}
        onConfirm={() => {
          if (!taskPrazoChange) {
            return;
          }
          void (taskPrazoChange.mode === "create"
            ? handleCreateTask(true)
            : handleUpdateTask(true));
        }}
        taskPrazoChange={taskPrazoChange}
      />

      <TarefaDeleteDialog
        confirm={deleteTaskConfirm}
        deleteTask={deleteTask}
        isSubmitting={isSubmitting}
        onClose={() => setDeleteTask(null)}
        onConfirmChange={setDeleteTaskConfirm}
        onSubmit={() =>
          deleteTask
            ? void runMutation(async () => {
                await removePreDemandaTarefa(preId, deleteTask.id);
                await loadTarefasData(true);
                setDeleteTask(null);
              }, "Tarefa excluida.")
            : undefined
        }
      />

      <ConfirmDialog
        confirmLabel={statusAction?.title ?? "Confirmar alteracao"}
        description="Registre o motivo para manter a trilha de auditoria completa."
        extraOption={
          statusAction?.nextStatus === "encerrada"
            ? {
                label: "Excluir todas as tarefas pendentes ao concluir",
                description:
                  "As tarefas pendentes serao removidas, com registro no historico do processo.",
              }
            : undefined
        }
        reopenScheduleOption={statusAction?.nextStatus === "encerrada"}
        onConfirm={async ({
          motivo,
          observacoes,
          extraOptionChecked,
          reopenSchedule,
        }) => {
          if (!statusAction) return;
          try {
            setError("");
            setMessage("");
            await updatePreDemandaStatus(preId, {
              status: statusAction.nextStatus,
              motivo,
              observacoes,
              delete_pending_tasks:
                statusAction.nextStatus === "encerrada"
                  ? extraOptionChecked
                  : undefined,
              reopen_schedule:
                statusAction.nextStatus === "encerrada"
                  ? reopenSchedule
                  : undefined,
            });
            await loadRecordData();
            void loadTimelineData();
            await loadTarefasData(true);
            setMessage(
              `Processo atualizado para ${getPreDemandaStatusLabel(statusAction.nextStatus)}.`,
            );
          } catch (nextError) {
            throw new Error(
              formatPreDemandaMutationError(
                nextError,
                "Falha ao atualizar o processo.",
              ),
            );
          }
        }}
        onOpenChange={(open) => {
          if (!open) setStatusAction(null);
        }}
        open={Boolean(statusAction)}
        requireReason={statusAction?.requireReason}
        title={statusAction?.title ?? "Alterar status"}
      />
    </section>
  );
}
