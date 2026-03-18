import {
  CalendarClock,
  ChevronDown,
  CheckCircle,
  Edit,
  FilePlus2,
  Link as LinkIcon,
  Plus,
  Send,
  StickyNote,
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth-context";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Timeline } from "../components/timeline";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { DetailSectionCard, SummaryItem, ToolbarActionButton } from "./pre-demanda-detail-ui";
import {
  AndamentoCreateDialog,
  AndamentoDeleteDialog,
  AndamentoEditDialog,
  TarefaDeleteDialog,
  TarefaEditDialog,
  TarefaPrazoChangeDialog,
} from "./pre-demanda-detail-dialogs";
import {
  FIXED_TASKS,
  formatBytes,
  formatRecorrenciaLabel,
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
  createPreDemandaComentario,
  createPreDemandaDocumento,
  createPreDemanda,
  createPreDemandaTarefa,
  downloadPreDemandaDocumento,
  formatAppError,
  getPreDemanda,
  getTimeline,
  listAssuntos,
  listPessoas,
  listPreDemandas,
  listSetores,
  removePreDemandaDocumento,
  removePreDemandaAndamento,
  removePreDemandaAssunto,
  removePreDemandaInteressado,
  removePreDemandaTarefa,
  removePreDemandaVinculo,
  reorderPreDemandaTarefas,
  tramitarPreDemandaMultiplos,
  updatePreDemandaAnotacoes,
  updatePreDemandaAndamento,
  updatePreDemandaCase,
  updatePreDemandaTarefa,
  updatePreDemandaStatus,
} from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { formatNumeroJudicialInput, normalizeNumeroJudicialValue } from "../lib/numero-judicial";
import { formatAllowedStatuses, getPreferredReopenStatus, getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import { formatSeiInput, isValidSei, normalizeSeiValue } from "../lib/sei";
import type { Andamento, Assunto, Interessado, PreDemanda, PreDemandaStatus, Setor, TarefaPendente, TarefaRecorrenciaTipo, TimelineEvent } from "../types";

export function PreDemandaDetailPage() {
  const { preId = "" } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [record, setRecord] = useState<PreDemanda | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [assuntosCatalogo, setAssuntosCatalogo] = useState<Assunto[]>([]);
  const [interessadoResults, setInteressadoResults] = useState<Interessado[]>([]);
  const [linkedProcessResults, setLinkedProcessResults] = useState<PreDemanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toolbarDialog, setToolbarDialog] = useState<ToolbarDialog>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [editingAndamento, setEditingAndamento] = useState<Andamento | null>(null);
  const [deleteAndamento, setDeleteAndamento] = useState<Andamento | null>(null);
  const [editingTask, setEditingTask] = useState<TarefaPendente | null>(null);
  const [deleteTask, setDeleteTask] = useState<TarefaPendente | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associationForm, setAssociationForm] = useState({ sei_numero: "", motivo: "", observacoes: "" });
  const [editForm, setEditForm] = useState({
    assunto: "",
    descricao: "",
    fonte: "",
    observacoes: "",
    numero_judicial: "",
    prazo_processo: "",
    pagamento_envolvido: false,
    urgente: false,
    audiencia_data: "",
    audiencia_status: "",
  });
  const [relatedForm, setRelatedForm] = useState({
    assunto: "",
    data_referencia: new Date().toISOString().slice(0, 10),
    descricao: "",
    prazo_processo: "",
  });
  const [notesForm, setNotesForm] = useState("");
  const [deadlineForm, setDeadlineForm] = useState({
    prazo_processo: "",
  });
  const [tramitarSetorIds, setTramitarSetorIds] = useState<string[]>([]);
  const [andamentoForm, setAndamentoForm] = useState({ descricao: "", data_hora: "" });
  const [editAndamentoForm, setEditAndamentoForm] = useState({ descricao: "", data_hora: "" });
  const [deleteAndamentoConfirm, setDeleteAndamentoConfirm] = useState("");
  const [taskForm, setTaskForm] = useState({ descricao: "", tipo: "livre" as "fixa" | "livre", prazo_conclusao: "", recorrencia_tipo: "" as "" | TarefaRecorrenciaTipo, recorrencia_dias_semana: [] as string[], recorrencia_dia_mes: "", setor_destino_id: "", assinatura_interessado_id: "" });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ descricao: "", tipo: "livre" as "fixa" | "livre", prazo_conclusao: "", recorrencia_tipo: "" as "" | TarefaRecorrenciaTipo, recorrencia_dias_semana: [] as string[], recorrencia_dia_mes: "" });
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState("");
  const [taskPrazoChange, setTaskPrazoChange] = useState<TaskPrazoChangeState | null>(null);
  const [commentForm, setCommentForm] = useState("");
  const [documentForm, setDocumentForm] = useState<{ file: File | null; descricao: string }>({ file: null, descricao: "" });
  const [interessadoSearch, setInteressadoSearch] = useState("");
  const [signatureSearch, setSignatureSearch] = useState("");
  const [signatureSearchResults, setSignatureSearchResults] = useState<Interessado[]>([]);
  const [signatureExpanded, setSignatureExpanded] = useState(false);
  const [signatureSelectedName, setSignatureSelectedName] = useState("");
  const [newInteressadoForm, setNewInteressadoForm] = useState({ nome: "", cargo: "", matricula: "", cpf: "" });
  const [processSearch, setProcessSearch] = useState("");
  const isSeiValid = isValidSei(associationForm.sei_numero);

  async function load() {
    setLoading(true);
    try {
      const [nextRecord, nextTimeline, nextSetores, nextAssuntos] = await Promise.all([getPreDemanda(preId), getTimeline(preId), listSetores(), listAssuntos()]);
      setRecord(nextRecord);
      setTimeline(nextTimeline);
      setSetores(nextSetores);
      setAssuntosCatalogo(nextAssuntos);
      setAssociationForm((current) => ({
        ...current,
        sei_numero: nextRecord.currentAssociation?.seiNumero ?? normalizeSeiValue(current.sei_numero),
      }));
      setEditForm({
        assunto: nextRecord.assunto,
        descricao: nextRecord.descricao ?? "",
        fonte: nextRecord.fonte ?? "",
        observacoes: nextRecord.observacoes ?? "",
        numero_judicial: normalizeNumeroJudicialValue(nextRecord.numeroJudicial) ?? "",
        prazo_processo: nextRecord.prazoProcesso ?? "",
        pagamento_envolvido: nextRecord.metadata.pagamentoEnvolvido ?? false,
        urgente: nextRecord.metadata.urgente ?? false,
        audiencia_data: nextRecord.metadata.audienciaData ?? "",
        audiencia_status: nextRecord.metadata.audienciaStatus ?? "",
      });
      setNotesForm(nextRecord.anotacoes ?? "");
      setDeadlineForm({
        prazo_processo: nextRecord.prazoProcesso ?? "",
      });
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar processo."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail as { preId?: string } | undefined;
      // Se mudou ESTE processo, recarrega
      if (data?.preId === preId) {
        void load();
      }
    };

    window.addEventListener("pre-demanda-updated", handleUpdate);
    return () => {
      window.removeEventListener("pre-demanda-updated", handleUpdate);
    };
  }, [preId]);

  useEffect(() => {
    void load();
  }, [preId]);

  useEffect(() => {
    if (toolbarDialog !== "link" || processSearch.trim().length < 2) {
      setLinkedProcessResults([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await listPreDemandas({ q: processSearch, page: 1, pageSize: 8 });
        if (active) {
          setLinkedProcessResults(result.items.filter((item) => item.preId !== preId));
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
    if (interessadoSearch.trim().length < 2) {
      setInteressadoResults([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await listPessoas({ q: interessadoSearch, page: 1, pageSize: 8 });
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
        const result = await listPessoas({ q: signatureSearch, page: 1, pageSize: 8 });
        if (active) setSignatureSearchResults(result.items);
      } catch {
        if (active) setSignatureSearchResults([]);
      }
    })();
    return () => { active = false; };
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
      setEditTaskForm({ descricao: "", tipo: "livre", prazo_conclusao: "", recorrencia_tipo: "", recorrencia_dias_semana: [], recorrencia_dia_mes: "" });
      return;
    }

    setEditTaskForm({
      descricao: editingTask.descricao,
      tipo: editingTask.tipo,
      prazo_conclusao: editingTask.prazoConclusao ?? "",
      recorrencia_tipo: editingTask.recorrenciaTipo ?? "",
      recorrencia_dias_semana: editingTask.recorrenciaDiasSemana ?? [],
      recorrencia_dia_mes: editingTask.recorrenciaDiaMes ? String(editingTask.recorrenciaDiaMes) : "",
    });
  }, [editingTask]);

  useEffect(() => {
    if (!deleteTask) {
      setDeleteTaskConfirm("");
    }
  }, [deleteTask]);

  const queueHealth = useMemo(() => (record ? getQueueHealth(record) : null), [record]);
  const pendingTasks = useMemo(() => record?.tarefasPendentes.filter((item) => !item.concluida) ?? [], [record]);
  const completedTasks = useMemo(() => record?.tarefasPendentes.filter((item) => item.concluida) ?? [], [record]);
  const editableAndamentoIds = useMemo(
    () => new Set((record?.recentAndamentos ?? []).filter((item) => item.tipo === "manual").map((item) => item.id)),
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
        return { title: "Conduzir a execucao administrativa", description: "Vincule pessoas, complemente os dados do processo e conclua tarefas pendentes ate o encerramento." };
      case "aguardando_sei":
        return { title: "Monitorar a geracao do processo", description: "Mantenha tarefas de acompanhamento activas e associe o numero SEI assim que ele existir." };
      case "encerrada":
        return { title: "Preservar historico e reabrir apenas com motivo", description: "O processo esta encerrado. Reabra so se houver fato novo, correcao processual ou necessidade operacional real." };
    }
  }, [record]);
  const taskShortcutOptions = useMemo(() => {
    const items = [...FIXED_TASKS];
    const interessadoShortcuts = (record?.interessados ?? []).slice(0, 6).map((item) => `Assinatura de ${item.interessado.nome}`);

    return Array.from(new Set([...items, ...interessadoShortcuts]));
  }, [record]);
  const requiresTaskSetorDestino = taskForm.descricao.trim() === "Envio para" || taskForm.descricao.trim() === "Retorno do setor";
  const requiresTaskSignaturePerson = taskForm.descricao.trim() === "Assinatura de pessoa";
  const selectedSignaturePerson = useMemo(() => {
    const fromInteressados = record?.interessados.find((item) => item.interessado.id === taskForm.assinatura_interessado_id)?.interessado ?? null;
    if (fromInteressados) return fromInteressados;
    if (taskForm.assinatura_interessado_id && signatureSelectedName) return { nome: signatureSelectedName } as { nome: string };
    return null;
  }, [record, taskForm.assinatura_interessado_id, signatureSelectedName]);

  function getTaskPrazoChangeState(error: unknown, payload: TaskPrazoChangeState["payload"], mode: "create" | "edit"): TaskPrazoChangeState | null {
    if (!(error instanceof Error) || !("code" in error) || !("details" in error)) {
      return null;
    }

    const apiError = error as Error & { code?: string; details?: unknown };
    if (apiError.code !== "TAREFA_PRAZO_CHANGE_CONFIRMATION" || !apiError.details || typeof apiError.details !== "object") {
      return null;
    }

    const details = apiError.details as TaskPrazoChangeState["details"];
    return { mode, payload, details };
  }

  async function handleReorderPendingTasksMotion(newPendingTasks: typeof pendingTasks) {
    setRecord((current) => {
      if (!current) return current;
      const completed = current.tarefasPendentes.filter((t) => t.concluida);
      return {
        ...current,
        tarefasPendentes: [...newPendingTasks, ...completed],
      };
    });

    await runMutation(
      async () => {
        const ids = newPendingTasks.map((t) => t.id);
        const tarefas = await reorderPreDemandaTarefas(preId, ids);
        setRecord((current) => (current ? { ...current, tarefasPendentes: tarefas } : current));
      },
      "Checklist reorganizada.",
    );
  }
  const availableAssuntos = useMemo(
    () => assuntosCatalogo.filter((item) => !record?.assuntos.some((linked) => linked.assunto.id === item.id)),
    [assuntosCatalogo, record],
  );
  const sectionSummaries = useMemo(
    () =>
      record
        ? {
            resumo: `${getPreDemandaStatusLabel(record.status)} • ${record.setorAtual?.sigla ?? "Sem setor"}${record.status !== "encerrada" && record.prazoProcesso ? ` • prazo do processo ${new Date(record.prazoProcesso).toLocaleDateString("pt-BR")}` : ""}`,
            pessoas: record.interessados.length ? `${record.interessados.length} pessoa(s) vinculada(s)` : "Nenhuma pessoa vinculada",
            setores: record.setoresAtivos.length ? `${record.setoresAtivos.length} setor(es) ativo(s)` : "Sem setores ativos",
            checklist: `${pendingTasks.length} pendente(s) • ${completedTasks.length} concluida(s)`,
            visao: `${nextAction.title} • fila ${queueHealth?.summary ?? "-"}`,
            relacionados: record.vinculos.length ? `${record.vinculos.length} vinculo(s) ativo(s)` : "Sem processos relacionados",
            associacaoSei: record.currentAssociation?.seiNumero ?? "Sem numero SEI associado",
            documentos: record.documentos.length ? `${record.documentos.length} documento(s) anexado(s)` : "Sem documentos anexados",
            comentarios: record.comentarios.length ? `${record.comentarios.length} comentario(s) registrado(s)` : "Sem comentarios",
            historico: timeline.length ? `${timeline.length} evento(s) registrado(s)` : "Sem eventos registrados",
          }
        : null,
    [completedTasks.length, nextAction.title, pendingTasks.length, queueHealth?.summary, record, timeline.length],
  );

  async function runMutation(action: () => Promise<void>, successMessage: string) {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (nextError) {
      setError(formatPreDemandaMutationError(nextError, "Falha ao executar a operacao."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateTask(confirmarAlteracaoPrazo = false) {
    const resolvedDescricao = requiresTaskSignaturePerson
      ? selectedSignaturePerson
        ? `Assinatura de ${selectedSignaturePerson.nome}`
        : taskForm.descricao.trim()
      : taskForm.descricao.trim() === "Envio para" || taskForm.descricao.trim() === "Retorno do setor"
        ? `${taskForm.descricao.trim()} ${setores.find((item) => item.id === taskForm.setor_destino_id)?.sigla ?? ""}`.trim()
        : taskForm.descricao.trim();

    const payload = {
      descricao: resolvedDescricao,
      tipo: taskForm.tipo,
      prazo_conclusao: taskForm.prazo_conclusao,
      recorrencia_tipo: taskForm.recorrencia_tipo || null,
      recorrencia_dias_semana: taskForm.recorrencia_tipo === "semanal" ? taskForm.recorrencia_dias_semana : null,
      recorrencia_dia_mes: taskForm.recorrencia_tipo === "mensal" && taskForm.recorrencia_dia_mes ? Number(taskForm.recorrencia_dia_mes) : null,
      setor_destino_id: taskForm.setor_destino_id || null,
    };

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      await createPreDemandaTarefa(preId, {
        ...payload,
        confirmar_alteracao_prazo: confirmarAlteracaoPrazo,
      });
      await load();
      setTaskPrazoChange(null);
      setTaskForm({ descricao: "", tipo: "livre", prazo_conclusao: record?.prazoProcesso ?? "", recorrencia_tipo: "", recorrencia_dias_semana: [], recorrencia_dia_mes: "", setor_destino_id: "", assinatura_interessado_id: "" });
      setMessage("Tarefa criada.");
    } catch (nextError) {
      const prazoChange = getTaskPrazoChangeState(nextError, payload, "create");
      if (prazoChange) {
        setTaskPrazoChange(prazoChange);
        return;
      }
      setError(formatPreDemandaMutationError(nextError, "Falha ao criar a tarefa."));
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
      prazo_conclusao: editTaskForm.prazo_conclusao,
      recorrencia_tipo: editTaskForm.recorrencia_tipo || null,
      recorrencia_dias_semana: editTaskForm.recorrencia_tipo === "semanal" ? editTaskForm.recorrencia_dias_semana : null,
      recorrencia_dia_mes: editTaskForm.recorrencia_tipo === "mensal" && editTaskForm.recorrencia_dia_mes ? Number(editTaskForm.recorrencia_dia_mes) : null,
    };

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      await updatePreDemandaTarefa(preId, editingTask.id, {
        ...payload,
        confirmar_alteracao_prazo: confirmarAlteracaoPrazo,
      });
      await load();
      setTaskPrazoChange(null);
      setEditingTask(null);
      setMessage("Tarefa atualizada.");
    } catch (nextError) {
      const prazoChange = getTaskPrazoChangeState(nextError, payload, "edit");
      if (prazoChange) {
        setTaskPrazoChange(prazoChange);
        return;
      }
      setError(formatPreDemandaMutationError(nextError, "Falha ao atualizar a tarefa."));
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
    await runMutation(
      () =>
        associateSei(preId, {
          ...associationForm,
          sei_numero: normalizeSeiValue(associationForm.sei_numero),
        }).then(() => undefined),
      "Associacao SEI atualizada.",
    );
  }

  async function handleDocumentoUpload() {
    if (!documentForm.file) {
      setError("Selecione um ficheiro para anexar.");
      return;
    }

    const conteudoBase64 = await readFileAsBase64(documentForm.file);
    await runMutation(
      async () => {
        await createPreDemandaDocumento(preId, {
          nome_arquivo: documentForm.file!.name,
          mime_type: documentForm.file!.type || "application/octet-stream",
          descricao: documentForm.descricao || null,
          conteudo_base64: conteudoBase64,
        });
        setDocumentForm({ file: null, descricao: "" });
      },
      "Documento anexado.",
    );
  }

  if (loading) {
    return <LoadingState description="Estamos preparando a visao do processo com metadados, envolvidos e historico." title="Carregando processo" />;
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
      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}
      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-4">
          <div className="flex flex-wrap gap-3">
            <ToolbarActionButton icon={FilePlus2} label="Relacionar" onClick={() => setToolbarDialog("related")} title="Iniciar processo relacionado" />
            <ToolbarActionButton icon={Edit} label="Alterar" onClick={() => setToolbarDialog("edit")} title="Consultar ou alterar processo" />
            <ToolbarActionButton icon={Send} label="Tramitar" onClick={() => setToolbarDialog("send")} title="Enviar processo para outro setor" />
            <ToolbarActionButton icon={LinkIcon} label="Vincular" onClick={() => setToolbarDialog("link")} title="Relacionamento de processo" />
            <ToolbarActionButton icon={StickyNote} label="Anotacoes" onClick={() => setToolbarDialog("notes")} title="Anotacoes do processo" />
            <ToolbarActionButton icon={CalendarClock} label="Prazos" onClick={() => setToolbarDialog("deadline")} title="Controle de prazos" />
            <ToolbarActionButton icon={Plus} label="Andamento" onClick={() => setToolbarDialog("andamento")} title="Registrar andamento manual" variant="ghost" />
            {record.allowedNextStatuses.includes("encerrada") ? (
              <ToolbarActionButton icon={CheckCircle} label="Concluir" onClick={() => setStatusAction({ nextStatus: "encerrada", title: "Concluir processo", requireReason: true })} title="Concluir processo" variant="ghost" />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(240,246,249,0.86))] px-4 py-3 shadow-[0_12px_24px_rgba(20,33,61,0.05)]">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Atalhos de status</span>
            {record.allowedNextStatuses.includes("aguardando_sei") ? (
              <Button onClick={() => setStatusAction({ nextStatus: "aguardando_sei", title: "Marcar como aguardando SEI", requireReason: false })} title="Marcar processo como aguardando SEI" type="button" variant="ghost">
                Aguardar SEI
              </Button>
            ) : null}
            {record.status === "encerrada" && reopenStatus ? (
              <Button onClick={() => setStatusAction({ nextStatus: reopenStatus, title: "Reabrir processo", requireReason: true })} title="Reabrir processo" type="button" variant="ghost">
                Reabrir
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid content-start gap-6">
          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.resumo} title="Resumo executivo">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Resumo executivo</CardTitle>
                  <CardDescription>{nextAction.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={record.status} />
                  {record.metadata.urgente ? <span className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">Urgente</span> : null}
                  <QueueHealthPill item={record} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
              <SummaryItem label="Primeira pessoa vinculada" value={record.pessoaPrincipal?.nome ?? "-"} />
              <SummaryItem label="Setor atual" value={record.setorAtual ? `${record.setorAtual.sigla} - ${record.setorAtual.nomeCompleto}` : "Nao tramitado"} />
              <SummaryItem label="Prazo do processo" value={record.status === "encerrada" ? "-" : record.prazoProcesso ? new Date(record.prazoProcesso).toLocaleDateString("pt-BR") : "-"} />
              <SummaryItem label="Proxima tarefa" value={record.status === "encerrada" ? "-" : record.proximoPrazoTarefa ? new Date(record.proximoPrazoTarefa).toLocaleDateString("pt-BR") : "Sem tarefas pendentes"} />
              <SummaryItem label="Sinal de prazo" value={record.status === "encerrada" ? "-" : record.sinalPrazoProcesso ?? "normal"} />
              <SummaryItem label="Numero principal" value={record.principalNumero} />
              <SummaryItem label="Urgencia" value={record.metadata.urgente ? "Urgente" : "Fluxo normal"} />
              <SummaryItem label="Pagamento envolvido" value={record.metadata.pagamentoEnvolvido ? "Sim" : "Nao informado"} />
              <SummaryItem label="Recorrencia no processo" value="Configurada por tarefa" />
              <SummaryItem label="Data da audiencia" value={record.metadata.audienciaData ? new Date(record.metadata.audienciaData).toLocaleDateString("pt-BR") : "-"} />
              <SummaryItem label="Status da audiencia" value={record.metadata.audienciaStatus ?? "-"} />
              <SummaryItem className="md:col-span-2" label="Anotacoes" value={record.anotacoes ?? "-"} />
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.pessoas} title="Pessoas vinculadas">
            <CardHeader>
              <CardTitle>Pessoas vinculadas</CardTitle>
              <CardDescription>Cadastro relacional das pessoas ligadas ao processo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input onChange={(event) => setInteressadoSearch(event.target.value)} placeholder="Buscar pessoa..." value={interessadoSearch} />
                <Button
                  onClick={() =>
                    interessadoResults[0]
                      ? void runMutation(() => addPreDemandaInteressado(preId, { interessado_id: interessadoResults[0]!.id, papel: "interessado" }).then(() => undefined), "Pessoa vinculada.")
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
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Resultados</p>
                  <div className="grid gap-2">
                    {interessadoResults.map((item) => (
                      <button
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-slate-300"
                        key={item.id}
                        onClick={() => void runMutation(() => addPreDemandaInteressado(preId, { interessado_id: item.id, papel: "interessado" }).then(() => undefined), "Pessoa vinculada.")}
                        type="button"
                      >
                        <span>
                          <span className="block font-semibold text-slate-950">{item.nome}</span>
                          <span className="block text-slate-500">{item.cargo ?? item.cpf ?? item.matricula ?? "Sem identificador adicional"}</span>
                        </span>
                        <Plus className="h-4 w-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 rounded-[24px] border border-dashed border-slate-300 p-4">
                <p className="text-sm font-semibold text-slate-950">Adicionar nova pessoa</p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Input onChange={(event) => setNewInteressadoForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome" value={newInteressadoForm.nome} />
                  <Input onChange={(event) => setNewInteressadoForm((current) => ({ ...current, cargo: event.target.value }))} placeholder="Cargo" value={newInteressadoForm.cargo} />
                  <Input onChange={(event) => setNewInteressadoForm((current) => ({ ...current, matricula: event.target.value }))} placeholder="Matricula" value={newInteressadoForm.matricula} />
                  <Input onChange={(event) => setNewInteressadoForm((current) => ({ ...current, cpf: event.target.value }))} placeholder="CPF" value={newInteressadoForm.cpf} />
                </div>
                <div className="flex justify-end">
                  <Button
                    disabled={newInteressadoForm.nome.trim().length < 3}
                    onClick={() =>
                      void runMutation(
                        async () => {
                          const created = await createPessoa({
                            nome: newInteressadoForm.nome,
                            cargo: newInteressadoForm.cargo || null,
                            matricula: newInteressadoForm.matricula || null,
                            cpf: newInteressadoForm.cpf || null,
                          });
                          await addPreDemandaInteressado(preId, { interessado_id: created.id, papel: "interessado" });
                          setNewInteressadoForm({ nome: "", cargo: "", matricula: "", cpf: "" });
                          setInteressadoSearch(created.nome);
                          setInteressadoResults([created]);
                        },
                        "Pessoa criada e vinculada.",
                      )
                    }
                    type="button"
                  >
                    Criar e vincular
                  </Button>
                </div>
              </div>

              {record.interessados.length === 0 ? (
                <EmptyState description="Vincule pessoas ao processo para destravar tarefas, tramitacoes e relacoes processuais." title="Sem pessoas vinculadas" />
              ) : (
                <div className="grid gap-3">
                  {record.interessados.map((item) => (
                    <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.interessado.id}>
                      <div>
                        <p className="font-semibold text-slate-950">{item.interessado.nome}</p>
                        <p className="text-sm text-slate-500">Interessado - {item.interessado.cargo ?? item.interessado.cpf ?? item.interessado.matricula ?? "Sem CPF/matricula"}</p>
                      </div>
                      <Button onClick={() => void runMutation(() => removePreDemandaInteressado(preId, item.interessado.id).then(() => undefined), "Pessoa removida.")} size="sm" type="button" variant="ghost">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.setores} title="Setores ativos">
            <CardHeader>
              <CardTitle>Setores ativos</CardTitle>
              <CardDescription>O mesmo processo pode correr em paralelo por mais de um setor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {record.setoresAtivos.length === 0 ? (
                <EmptyState description="Abra a acao Tramitar para distribuir o processo entre um ou mais setores." title="Sem setores ativos" />
              ) : (
                record.setoresAtivos.map((item) => (
                  <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.id}>
                    <div>
                      <p className="font-semibold text-slate-950">{item.setor.sigla} - {item.setor.nomeCompleto}</p>
                      <p className="text-sm text-slate-500">
                        Activo desde {new Date(item.createdAt).toLocaleString("pt-BR")}
                        {item.origemSetor ? ` | origem ${item.origemSetor.sigla}` : ""}
                      </p>
                    </div>
                    <Button
                      disabled={isSubmitting}
                      onClick={() => void runMutation(() => concluirTramitacaoSetor(preId, item.setor.id).then(() => undefined), `Tramitacao concluida em ${item.setor.sigla}.`)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Concluir
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen summary={sectionSummaries?.checklist} title="Checklist / Proximas tarefas">
            <CardHeader>
              <CardTitle>Checklist / Proximas tarefas</CardTitle>
              <CardDescription>Concluir uma tarefa baixa automaticamente para o historico processual.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Assuntos vinculados</p>
                    <p className="text-xs text-slate-500">Cada assunto transforma o fluxo cadastrado em checklist automático.</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {record.assuntos.length ? (
                    record.assuntos.map((item) => (
                      <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.assunto.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">{item.assunto.nome}</p>
                            <p className="text-sm text-slate-500">{item.assunto.procedimentos.length} passos • {item.assunto.normas.length} normas</p>
                            {item.assunto.normas.length ? (
                              <p className="mt-1 text-xs text-slate-500">Normas: {item.assunto.normas.map((norma) => norma.numero).join(", ")}</p>
                            ) : null}
                          </div>
                          <Button
                            onClick={() =>
                              void runMutation(
                                () => removePreDemandaAssunto(preId, item.assunto.id).then((next) => setRecord(next)),
                                "Assunto removido e tarefas automáticas pendentes foram revistas.",
                              )
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
                              <li className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2" key={procedimento.id}>
                                <span className="font-semibold">{procedimento.ordem}. </span>
                                {procedimento.descricao}
                                {procedimento.setorDestino ? <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">→ {procedimento.setorDestino.sigla}</span> : null}
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">Nenhum assunto vinculado.</p>
                  )}
                </div>
                {availableAssuntos.length ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {availableAssuntos.map((assunto) => (
                      <button
                        className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-sm hover:border-slate-400"
                        key={assunto.id}
                        onClick={() =>
                          void runMutation(
                            () => addPreDemandaAssunto(preId, assunto.id).then((next) => setRecord(next)),
                            `Assunto ${assunto.nome} vinculado e checklist gerado.`,
                          )
                        }
                        type="button"
                      >
                        <span className="block font-semibold text-slate-950">{assunto.nome}</span>
                        <span className="block text-slate-500">{assunto.procedimentos.length} passos • {assunto.normas.length} normas</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3">
                <Input className="w-full" onChange={(event) => setTaskForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Descreva a proxima tarefa" value={taskForm.descricao} />
                <div className="grid gap-3 md:grid-cols-[160px_170px_1fr]">
                  <select className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm" onChange={(event) => setTaskForm((current) => ({ ...current, tipo: event.target.value as "fixa" | "livre" }))} value={taskForm.tipo}>
                    <option value="livre">Livre</option>
                    <option value="fixa">Fixa</option>
                  </select>
                  <Input max={record?.prazoProcesso ?? undefined} min={undefined} onChange={(event) => setTaskForm((current) => ({ ...current, prazo_conclusao: event.target.value }))} type="date" value={taskForm.prazo_conclusao} />
                  <select className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm" onChange={(event) => setTaskForm((current) => ({ ...current, recorrencia_tipo: event.target.value as "" | TarefaRecorrenciaTipo, recorrencia_dias_semana: event.target.value === "semanal" ? current.recorrencia_dias_semana : [], recorrencia_dia_mes: event.target.value === "mensal" ? current.recorrencia_dia_mes : "" }))} value={taskForm.recorrencia_tipo}>
                    <option value="">Sem recorrencia</option>
                    <option value="diaria">Diaria</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-500">Toda tarefa precisa de prazo de conclusao e nao pode passar de {record?.prazoProcesso ? new Date(record.prazoProcesso).toLocaleDateString("pt-BR") : "o prazo do processo"}.</p>

              {taskForm.recorrencia_tipo === "semanal" ? (
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((item) => (
                    <Button key={item} onClick={() => setTaskForm((current) => ({ ...current, recorrencia_dias_semana: current.recorrencia_dias_semana.includes(item) ? current.recorrencia_dias_semana.filter((value) => value !== item) : [...current.recorrencia_dias_semana, item] }))} size="sm" type="button" variant={taskForm.recorrencia_dias_semana.includes(item) ? "primary" : "outline"}>
                      {item}
                    </Button>
                  ))}
                </div>
              ) : null}

              {taskForm.recorrencia_tipo === "mensal" ? (
                <FormField label="Dia do mes">
                  <Input max="31" min="1" onChange={(event) => setTaskForm((current) => ({ ...current, recorrencia_dia_mes: event.target.value }))} type="number" value={taskForm.recorrencia_dia_mes} />
                </FormField>
              ) : null}

              {requiresTaskSetorDestino ? (
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <select
                    className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm"
                    onChange={(event) => setTaskForm((current) => ({ ...current, setor_destino_id: event.target.value }))}
                    value={taskForm.setor_destino_id}
                  >
                    <option value="">Escolha o setor destino</option>
                    {setores.map((setor) => (
                      <option key={setor.id} value={setor.id}>
                        {setor.sigla} - {setor.nomeCompleto}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 md:self-center">Ao concluir, o processo será tramitado automaticamente para o setor escolhido.</p>
                </div>
              ) : null}

              {requiresTaskSignaturePerson ? (
                <div className="grid gap-3">
                  <div className="grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Pessoas vinculadas ao processo</p>
                    {record.interessados.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhuma pessoa vinculada a este processo.</p>
                    ) : (
                      <div className="grid gap-2">
                        {record.interessados.map((item) => (
                          <button
                            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                              taskForm.assinatura_interessado_id === item.interessado.id
                                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                                : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                            }`}
                            key={item.interessado.id}
                            onClick={() => { setTaskForm((current) => ({ ...current, assinatura_interessado_id: item.interessado.id })); setSignatureSelectedName(""); }}
                            type="button"
                          >
                            <span className="font-medium">{item.interessado.nome}{item.interessado.cargo ? <span className="ml-1 text-xs font-normal text-slate-500">- {item.interessado.cargo}</span> : null}</span>
                            {taskForm.assinatura_interessado_id === item.interessado.id ? <span className="text-xs font-semibold text-indigo-600">✓ Selecionado</span> : null}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      className="mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                      onClick={() => { setSignatureExpanded(!signatureExpanded); setSignatureSearch(""); setSignatureSearchResults([]); }}
                      type="button"
                    >
                      {signatureExpanded ? "▲ Recolher busca" : "▼ Buscar outra pessoa cadastrada"}
                    </button>

                    {signatureExpanded ? (
                      <div className="grid gap-2">
                        <input
                          className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm"
                          onChange={(e) => setSignatureSearch(e.target.value)}
                          placeholder="Buscar por nome..."
                          value={signatureSearch}
                        />
                        {signatureSearch.trim().length >= 2 && signatureSearchResults.length === 0 ? (
                          <p className="text-xs text-slate-400">Nenhuma pessoa encontrada.</p>
                        ) : null}
                        {signatureSearchResults.map((item) => (
                          <button
                            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                              taskForm.assinatura_interessado_id === item.id
                                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                                : "border-slate-200 bg-white hover:border-indigo-200"
                            }`}
                            key={item.id}
                            onClick={() => { setTaskForm((current) => ({ ...current, assinatura_interessado_id: item.id })); setSignatureSelectedName(item.nome); }}
                            type="button"
                          >
                            <span className="font-medium">{item.nome}{item.cargo ? <span className="ml-1 text-xs font-normal text-slate-500">- {item.cargo}</span> : null}</span>
                            {taskForm.assinatura_interessado_id === item.id ? <span className="text-xs font-semibold text-indigo-600">✓ Selecionado</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">A tarefa será nomeada automaticamente com o nome da pessoa selecionada.</p>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm" onChange={(event) => setTaskForm((current) => ({ ...current, descricao: event.target.value, tipo: "fixa" as "fixa" | "livre", setor_destino_id: event.target.value === "Envio para" || event.target.value === "Retorno do setor" ? current.setor_destino_id : "", assinatura_interessado_id: "" }))} value="">
                  <option value="">Atalhos de tarefas</option>
                  {taskShortcutOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 md:self-center">Os atalhos consideram envolvidos. Arraste as tarefas pendentes para reorganizar.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {taskShortcutOptions.slice(0, 6).map((item) => (
                  <Button key={item} onClick={() => setTaskForm((current) => ({ ...current, descricao: item, tipo: "fixa" as "fixa" | "livre", setor_destino_id: item === "Envio para" || item === "Retorno do setor" ? current.setor_destino_id : "", assinatura_interessado_id: "" }))} size="sm" type="button" variant="outline">
                    {item}
                  </Button>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  disabled={taskForm.descricao.trim().length < 3 || !taskForm.prazo_conclusao || (requiresTaskSetorDestino && !taskForm.setor_destino_id) || (requiresTaskSignaturePerson && !taskForm.assinatura_interessado_id)}
                  onClick={() => void handleCreateTask()}
                  type="button"
                >
                  Criar tarefa
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3">
                  <p className="text-sm font-semibold text-slate-950">Pendentes</p>
                  {pendingTasks.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhuma tarefa pendente.</p>
                  ) : (
                    <Reorder.Group axis="y" className="grid gap-3" onReorder={handleReorderPendingTasksMotion} values={pendingTasks}>
                      {pendingTasks.map((task) => (
                        <Reorder.Item key={task.id} value={task}>
                          <div
                            className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 cursor-grab active:cursor-grabbing backdrop-blur-xl hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start gap-3">
                              <input
                                className="mt-1 h-4 w-4 accent-slate-950"
                                onChange={() =>
                                  void runMutation(
                                    () => concluirPreDemandaTarefa(preId, task.id).then(() => undefined),
                                    formatRecorrenciaLabel(task) ? "Tarefa concluida. Nova ocorrencia gerada." : "Tarefa concluida.",
                                  )
                                }
                                type="checkbox"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="block font-semibold text-slate-950">{task.descricao}</span>
                                <span className="text-sm text-slate-500">{task.tipo}</span>
                                {task.prazoConclusao ? <span className="block text-xs text-slate-500">Prazo de conclusao: {new Date(task.prazoConclusao).toLocaleDateString("pt-BR")}</span> : null}
                                {formatRecorrenciaLabel(task) ? (
                                  <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-800 ring-1 ring-sky-200">
                                    {formatRecorrenciaLabel(task)}
                                  </span>
                                ) : null}
                                {task.setorDestino ? <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Ao concluir, tramita para {task.setorDestino.sigla}</span> : null}
                                {task.geradaAutomaticamente ? <span className="mt-1 block text-xs text-slate-500">Gerada automaticamente pelo fluxo do assunto.</span> : null}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <Button onClick={() => setEditingTask(task)} size="sm" type="button" variant="secondary">
                                  Editar
                                </Button>
                                <Button onClick={() => setDeleteTask(task)} size="sm" type="button" variant="ghost">
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
                  <p className="text-sm font-semibold text-slate-950">Concluidas</p>
                  {completedTasks.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nada concluido ainda.</p>
                  ) : (
                    completedTasks.map((task) => (
                      <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3" key={task.id}>
                        <p className="font-semibold text-emerald-950">{task.descricao}</p>
                        <p className="text-sm text-emerald-800">Concluida em {task.concluidaEm ? new Date(task.concluidaEm).toLocaleString("pt-BR") : "-"}</p>
                        <p className="mt-1 text-xs text-emerald-900/80">{task.tipo}{task.concluidaPor ? ` • ${task.concluidaPor.name}` : ""}</p>
                        {formatRecorrenciaLabel(task) ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">{formatRecorrenciaLabel(task)}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">Tabela analítica das próximas tarefas</p>
                  <span className="text-xs text-slate-500">{pendingTasks.length} pendente(s)</span>
                </div>
                {pendingTasks.length === 0 ? (
                  <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhuma próxima tarefa pendente.</p>
                ) : (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Ordem</th>
                            <th className="px-4 py-3 font-semibold">Tarefa</th>
                            <th className="px-4 py-3 font-semibold">Tipo</th>
                            <th className="px-4 py-3 font-semibold">Prazo</th>
                            <th className="px-4 py-3 font-semibold">Setor destino</th>
                            <th className="px-4 py-3 font-semibold">Origem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingTasks.map((task) => (
                            <tr className="border-t border-slate-200" key={`table-${task.id}`}>
                              <td className="px-4 py-3 font-semibold text-slate-950">{task.ordem}</td>
                              <td className="px-4 py-3 text-slate-950">{task.descricao}</td>
                              <td className="px-4 py-3 text-slate-600">{task.tipo}{formatRecorrenciaLabel(task) ? ` • ${formatRecorrenciaLabel(task)}` : ""}</td>
                              <td className="px-4 py-3 text-slate-600">{task.prazoConclusao ? new Date(task.prazoConclusao).toLocaleDateString("pt-BR") : "-"}</td>
                              <td className="px-4 py-3 text-slate-600">{task.setorDestino ? `${task.setorDestino.sigla} - ${task.setorDestino.nomeCompleto}` : "-"}</td>
                              <td className="px-4 py-3 text-slate-600">{task.geradaAutomaticamente ? "Fluxo do assunto" : "Lançamento manual"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </DetailSectionCard>
        </div>

        <div className="grid content-start gap-6">
          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.visao} title="Visao operacional">
            <CardHeader>
              <CardTitle>Visao operacional</CardTitle>
              <CardDescription>{nextAction.title}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-slate-600">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-900">{nextAction.title}</p>
                <p className="mt-2 text-sm text-amber-800">{nextAction.description}</p>
              </div>
              <SummaryItem label="SEIs relacionados" value={record.seiAssociations.length ? record.seiAssociations.map((item) => item.seiNumero).join(", ") : "Ainda nao associado"} />
              <SummaryItem label="Ultima movimentacao" value={lastEvent ? `${new Date(lastEvent.occurredAt).toLocaleString("pt-BR")} - ${lastEvent.descricao ?? "Evento registrado"}` : "Nenhum evento registrado"} />
              <SummaryItem label="Saude da fila" value={queueHealth.summary} />
              <SummaryItem label="Detalhe da fila" value={queueHealth.detail} />
              <SummaryItem label="Proximos estados permitidos" value={record.allowedNextStatuses.length ? formatAllowedStatuses(record.allowedNextStatuses) : "Nenhuma transicao manual disponivel"} />
              <SummaryItem label="Data de conclusao" value={record.dataConclusao ? new Date(record.dataConclusao).toLocaleDateString("pt-BR") : "-"} />
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.relacionados} title="Processos relacionados">
            <CardHeader>
              <CardTitle>Processos relacionados</CardTitle>
              <CardDescription>Relacione processos dependentes, espelho ou desdobramentos sem duplicar trabalho.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {record.vinculos.length === 0 ? (
                <EmptyState description="Use a toolbar para criar um processo relacionado ou vincular um PRE existente." title="Sem vinculos" />
              ) : (
                record.vinculos.map((item) => (
                  <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.processo.preId}>
                    <div>
                      <p className="font-semibold text-slate-950">{item.processo.principalNumero}</p>
                      <p className="text-xs text-slate-400">{item.processo.preId}</p>
                      <p className="text-sm text-slate-500">{item.processo.assunto}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => navigate(`/pre-demandas/${item.processo.preId}`)} size="sm" type="button" variant="secondary">
                        Abrir
                      </Button>
                      <Button onClick={() => void runMutation(() => removePreDemandaVinculo(preId, item.processo.preId).then(() => undefined), "Vinculo removido.")} size="sm" type="button" variant="ghost">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.associacaoSei} title="Associacao PRE para SEI">
            <CardHeader>
              <CardTitle>Associacao PRE para SEi</CardTitle>
              <CardDescription>Validacao e mascara seguem o backend para manter o vinculo confiavel.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleAssociation}>
                <FormField hint={<code>000181/26-02.227</code>} label="Numero SEI">
                  <Input onChange={(event) => setAssociationForm((current) => ({ ...current, sei_numero: formatSeiInput(event.target.value) }))} placeholder="000181/26-02.227" value={associationForm.sei_numero} />
                </FormField>
                <FormField label="Motivo">
                  <Textarea onChange={(event) => setAssociationForm((current) => ({ ...current, motivo: event.target.value }))} rows={3} value={associationForm.motivo} />
                </FormField>
                <FormField label="Observacoes">
                  <Textarea onChange={(event) => setAssociationForm((current) => ({ ...current, observacoes: event.target.value }))} rows={3} value={associationForm.observacoes} />
                </FormField>
                <div className="flex justify-end">
                  <Button disabled={!isSeiValid || isSubmitting} type="submit">
                    Salvar associacao
                  </Button>
                </div>
              </form>
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.documentos} title="Documentos">
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>Anexos operacionais do processo, com download directo no detalhe.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 rounded-[24px] border border-dashed border-slate-300 p-4">
                <Input onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} type="file" />
                <Textarea onChange={(event) => setDocumentForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Descricao do documento" rows={3} value={documentForm.descricao} />
                <div className="flex justify-end">
                  <Button disabled={!documentForm.file || isSubmitting} onClick={() => void handleDocumentoUpload()} type="button">
                    Anexar documento
                  </Button>
                </div>
              </div>
              {record.documentos.length === 0 ? (
                <EmptyState description="Nenhum documento foi anexado a este processo." title="Sem documentos" />
              ) : (
                record.documentos.map((item) => (
                  <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.id}>
                    <div>
                      <p className="font-semibold text-slate-950">{item.nomeArquivo}</p>
                      <p className="text-sm text-slate-500">
                        {formatBytes(item.tamanhoBytes)} | {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </p>
                      {item.descricao ? <p className="mt-1 text-sm text-slate-600">{item.descricao}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => void downloadPreDemandaDocumento(preId, item.id, item.nomeArquivo)} size="sm" type="button" variant="secondary">
                        Baixar
                      </Button>
                      <Button onClick={() => void runMutation(() => removePreDemandaDocumento(preId, item.id).then(() => undefined), "Documento removido.")} size="sm" type="button" variant="ghost">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.comentarios} title="Comentarios ricos">
            <CardHeader>
              <CardTitle>Comentarios ricos</CardTitle>
              <CardDescription>Registos de colaboracao em markdown simples, preservados junto ao processo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Textarea onChange={(event) => setCommentForm(event.target.value)} placeholder="Escreva um comentario operacional, contexto de decisao ou combinacao entre setores..." rows={5} value={commentForm} />
              <div className="flex justify-end">
                <Button
                  disabled={commentForm.trim().length < 1 || isSubmitting}
                  onClick={() =>
                    void runMutation(
                      async () => {
                        await createPreDemandaComentario(preId, { conteudo: commentForm, formato: "markdown" });
                        setCommentForm("");
                      },
                      "Comentario registrado.",
                    )
                  }
                  type="button"
                >
                  Publicar comentario
                </Button>
              </div>
              {record.comentarios.length === 0 ? (
                <EmptyState description="Ainda nao ha conversa registrada neste processo." title="Sem comentarios" />
              ) : (
                record.comentarios.map((item) => (
                  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">{item.createdBy?.name ?? "Sistema"}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{new Date(item.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.conteudo}</p>
                  </div>
                ))
              )}
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen summary={sectionSummaries?.historico} title="Historico (Andamentos)">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Historico (Andamentos)</CardTitle>
                  <CardDescription>Timeline unificada com criacao, status, SEI, tramitacoes, tarefas e lancamentos manuais.</CardDescription>
                </div>
                <Button onClick={() => setToolbarDialog("andamento")} size="sm" type="button" variant="secondary">
                  Novo andamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              {timeline.length === 0 ? (
                <EmptyState description="Assim que houver qualquer movimentacao operacional, os eventos aparecem aqui." title="Sem eventos registrados" />
              ) : (
                <Timeline
                  events={timeline}
                  renderActions={(event) => {
                    if (event.type !== "andamento") {
                      return null;
                    }

                    const andamentoId = event.id.startsWith("andamento-") ? event.id.slice("andamento-".length) : event.id;
                    if (!editableAndamentoIds.has(andamentoId)) {
                      return null;
                    }

                    const andamento = editableAndamentos.get(andamentoId);
                    if (!andamento) {
                      return null;
                    }

                    return (
                      <>
                        <Button onClick={() => setEditingAndamento(andamento)} size="sm" type="button" variant="secondary">
                          Editar
                        </Button>
                        <Button onClick={() => setDeleteAndamento(andamento)} size="sm" type="button" variant="ghost">
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

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "edit"}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consultar / Alterar processo</DialogTitle>
            <DialogDescription>Atualize os dados principais e o metadata operacional do processo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Assunto">
              <Input onChange={(event) => setEditForm((current) => ({ ...current, assunto: event.target.value }))} value={editForm.assunto} />
            </FormField>
            <FormField label="Descricao">
              <Textarea onChange={(event) => setEditForm((current) => ({ ...current, descricao: event.target.value }))} rows={4} value={editForm.descricao} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Fonte">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, fonte: event.target.value }))} value={editForm.fonte} />
              </FormField>
              <FormField label="Numero judicial">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, numero_judicial: formatNumeroJudicialInput(event.target.value) ?? "" }))} placeholder="0000000-00.0000.0.00.0000" value={editForm.numero_judicial} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Prazo do processo">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, prazo_processo: event.target.value }))} type="date" value={editForm.prazo_processo} />
              </FormField>
              <FormField label="Recorrencia">
                <Input disabled value="A recorrencia agora e definida por tarefa" />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Data da audiencia">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, audiencia_data: event.target.value }))} type="date" value={editForm.audiencia_data} />
              </FormField>
              <FormField label="Status da audiencia">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, audiencia_status: event.target.value }))} value={editForm.audiencia_status} />
              </FormField>
            </div>
            <label className="flex items-center justify-between rounded-[24px] border border-sky-100/90 bg-white/90 px-4 py-3 text-sm shadow-[0_10px_22px_rgba(20,33,61,0.04)]">
              <span>
                <span className="block font-semibold text-slate-950">Pagamento envolvido</span>
                <span className="text-slate-500">Sinalizador rapido para o processo.</span>
              </span>
              <input checked={editForm.pagamento_envolvido} className="h-5 w-5 accent-slate-950" onChange={(event) => setEditForm((current) => ({ ...current, pagamento_envolvido: event.target.checked }))} type="checkbox" />
            </label>
            <label className="flex items-center justify-between rounded-[24px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm shadow-[0_10px_22px_rgba(190,24,93,0.08)]">
              <span>
                <span className="block font-semibold text-slate-950">Marcar como urgente</span>
                <span className="text-slate-500">Destaque operativo para tratamento prioritário.</span>
              </span>
              <input checked={editForm.urgente} className="h-5 w-5 accent-rose-600" onChange={(event) => setEditForm((current) => ({ ...current, urgente: event.target.checked }))} type="checkbox" />
            </label>
            <FormField label="Observacoes principais">
              <Textarea onChange={(event) => setEditForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} value={editForm.observacoes} />
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() =>
                void runMutation(
                  () =>
                    updatePreDemandaCase(preId, {
                      assunto: editForm.assunto,
                      descricao: editForm.descricao || null,
                      fonte: editForm.fonte || null,
                      observacoes: editForm.observacoes || null,
                      prazo_processo: editForm.prazo_processo || null,
                      numero_judicial: editForm.numero_judicial || null,
                      metadata: {
                        pagamento_envolvido: editForm.pagamento_envolvido,
                        urgente: editForm.urgente,
                        audiencia_data: editForm.audiencia_data || null,
                        audiencia_status: editForm.audiencia_status || null,
                      },
                    }).then(() => setToolbarDialog(null)),
                  "Processo atualizado.",
                )
              }
              type="button"
            >
              Salvar alteracoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "send"}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar processo</DialogTitle>
            <DialogDescription>Selecione o setor destino para registrar a tramitacao automaticamente no historico.</DialogDescription>
          </DialogHeader>
          <FormField label="Setor destino">
            <div className="grid gap-2">
              {setores.map((item) => {
                const checked = tramitarSetorIds.includes(item.id);
                return (
                  <label className="flex items-center justify-between rounded-[24px] border border-sky-100/90 bg-white/90 px-4 py-3 text-sm shadow-[0_10px_22px_rgba(20,33,61,0.04)]" key={item.id}>
                    <span>{item.sigla} - {item.nomeCompleto}</span>
                    <input
                      checked={checked}
                      className="h-4 w-4 accent-slate-950"
                      onChange={(event) =>
                        setTramitarSetorIds((current) =>
                          event.target.checked ? [...current, item.id] : current.filter((candidate) => candidate !== item.id),
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
              Nenhum setor cadastrado. Abra o cadastro de setores para habilitar a tramitacao.
            </div>
          ) : null}
          <DialogFooter>
            {hasPermission("cadastro.setor.write") ? (
              <Button onClick={() => navigate("/setores")} type="button" variant="secondary">
                Abrir setores
              </Button>
            ) : null}
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={!tramitarSetorIds.length || isSubmitting}
              onClick={() =>
                void runMutation(
                  () => tramitarPreDemandaMultiplos(preId, tramitarSetorIds).then(() => {
                    setToolbarDialog(null);
                    setTramitarSetorIds([]);
                  }),
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

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "notes"}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anotacoes</DialogTitle>
            <DialogDescription>Espelho do post-it operacional do SEI para observacoes de trabalho rapido.</DialogDescription>
          </DialogHeader>
          <Textarea onChange={(event) => setNotesForm(event.target.value)} rows={8} value={notesForm} />
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={isSubmitting} onClick={() => void runMutation(() => updatePreDemandaAnotacoes(preId, notesForm || null).then(() => setToolbarDialog(null)), "Anotacoes atualizadas.")} type="button">
              Salvar anotacoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "deadline"}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prazo do processo</DialogTitle>
            <DialogDescription>Defina a data-limite geral. Nenhuma tarefa pode ultrapassar este prazo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Prazo do processo">
              <Input onChange={(event) => setDeadlineForm((current) => ({ ...current, prazo_processo: event.target.value }))} type="date" value={deadlineForm.prazo_processo} />
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() =>
                void runMutation(
                  () =>
                    updatePreDemandaCase(preId, {
                      prazo_processo: deadlineForm.prazo_processo || null,
                    }).then(() => setToolbarDialog(null)),
                  "Prazos atualizados.",
                )
              }
              type="button"
            >
              Salvar prazos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "link"}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relacionamento de processo</DialogTitle>
            <DialogDescription>Pesquise por PRE ou assunto e vincule o processo existente.</DialogDescription>
          </DialogHeader>
          <Input onChange={(event) => setProcessSearch(event.target.value)} placeholder="Buscar por PRE ou assunto" value={processSearch} />
          <div className="grid gap-2">
            {linkedProcessResults.map((item) => (
              <button className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-300" key={item.preId} onClick={() => void runMutation(() => addPreDemandaVinculo(preId, item.preId).then(() => setToolbarDialog(null)), "Vinculo criado.")} type="button">
                <span>
                  <span className="block font-semibold text-slate-950">{item.principalNumero}</span>
                  <span className="text-xs text-slate-400">{item.preId}</span>
                  <span className="text-sm text-slate-500">{item.assunto}</span>
                </span>
                <Plus className="h-4 w-4 text-slate-500" />
              </button>
            ))}
            {processSearch.trim().length >= 2 && linkedProcessResults.length === 0 ? <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhum processo encontrado para este termo.</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "related"}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Iniciar processo relacionado</DialogTitle>
            <DialogDescription>Crie um novo processo relacionado sem depender de solicitante vinculado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Assunto">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, assunto: event.target.value }))} value={relatedForm.assunto} />
            </FormField>
            <FormField label="Data de referencia">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, data_referencia: event.target.value }))} type="date" value={relatedForm.data_referencia} />
            </FormField>
            <FormField label="Prazo do processo">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, prazo_processo: event.target.value }))} type="date" value={relatedForm.prazo_processo} />
            </FormField>
            <FormField label="Descricao">
              <Textarea onChange={(event) => setRelatedForm((current) => ({ ...current, descricao: event.target.value }))} rows={4} value={relatedForm.descricao} />
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={!relatedForm.prazo_processo || relatedForm.assunto.trim().length < 3 || isSubmitting}
              onClick={() =>
                void runMutation(
                  async () => {
                    const created = await createPreDemanda({
                      assunto: relatedForm.assunto,
                      data_referencia: relatedForm.data_referencia,
                      descricao: relatedForm.descricao,
                      prazo_processo: relatedForm.prazo_processo,
                    });
                    await addPreDemandaVinculo(preId, created.preId);
                    navigate(`/pre-demandas/${created.preId}`);
                  },
                  "Processo relacionado criado.",
                )
              }
              type="button"
            >
              Criar relacionado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "andamento"}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar andamento manual</DialogTitle>
            <DialogDescription>Inclua uma movimentacao livre no historico do processo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Data e hora">
              <Input onChange={(event) => setAndamentoForm((current) => ({ ...current, data_hora: event.target.value }))} type="datetime-local" value={andamentoForm.data_hora} />
            </FormField>
            <FormField label="Descricao">
              <Textarea onChange={(event) => setAndamentoForm((current) => ({ ...current, descricao: event.target.value }))} rows={6} value={andamentoForm.descricao} />
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={andamentoForm.descricao.trim().length < 3 || isSubmitting}
              onClick={() =>
                void runMutation(
                  async () => {
                    await addPreDemandaAndamento(preId, {
                      descricao: andamentoForm.descricao,
                      data_hora: toIsoFromDateTimeLocal(andamentoForm.data_hora),
                    });
                    setAndamentoForm({ descricao: "", data_hora: "" });
                    setToolbarDialog(null);
                  },
                  "Andamento registrado.",
                )
              }
              type="button"
            >
              Lancar andamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setEditingAndamento(null)} open={Boolean(editingAndamento)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar andamento manual</DialogTitle>
            <DialogDescription>Ajuste o texto e a data/hora do andamento manual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Data e hora">
              <Input onChange={(event) => setEditAndamentoForm((current) => ({ ...current, data_hora: event.target.value }))} type="datetime-local" value={editAndamentoForm.data_hora} />
            </FormField>
            <FormField label="Descricao">
              <Textarea onChange={(event) => setEditAndamentoForm((current) => ({ ...current, descricao: event.target.value }))} rows={6} value={editAndamentoForm.descricao} />
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={() => setEditingAndamento(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={!editingAndamento || editAndamentoForm.descricao.trim().length < 3 || isSubmitting}
              onClick={() =>
                editingAndamento
                  ? void runMutation(
                      async () => {
                        await updatePreDemandaAndamento(preId, editingAndamento.id, {
                          descricao: editAndamentoForm.descricao,
                          data_hora: toIsoFromDateTimeLocal(editAndamentoForm.data_hora),
                        });
                        setEditingAndamento(null);
                      },
                      "Andamento atualizado.",
                    )
                  : undefined
              }
              type="button"
            >
              Salvar alteracoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setDeleteAndamento(null)} open={Boolean(deleteAndamento)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir andamento manual</DialogTitle>
            <DialogDescription>Esta acao remove o andamento manual e regista a remocao no historico. Digite EXCLUIR para confirmar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {deleteAndamento?.descricao}
            </div>
            <FormField label="Confirmacao">
              <Input onChange={(event) => setDeleteAndamentoConfirm(event.target.value)} placeholder="EXCLUIR" value={deleteAndamentoConfirm} />
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={() => setDeleteAndamento(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={!deleteAndamento || deleteAndamentoConfirm !== "EXCLUIR" || isSubmitting}
              onClick={() =>
                deleteAndamento
                  ? void runMutation(
                      async () => {
                        await removePreDemandaAndamento(preId, deleteAndamento.id);
                        setDeleteAndamento(null);
                      },
                      "Andamento removido.",
                    )
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

      <Dialog onOpenChange={(open) => !open && setEditingTask(null)} open={Boolean(editingTask)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
            <DialogDescription>Ajuste a descriçao e o tipo da próxima tarefa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Descriçao">
              <Textarea onChange={(event) => setEditTaskForm((current) => ({ ...current, descricao: event.target.value }))} rows={5} value={editTaskForm.descricao} />
            </FormField>
            <FormField label="Tipo">
              <select className={selectClassName} onChange={(event) => setEditTaskForm((current) => ({ ...current, tipo: event.target.value as "fixa" | "livre" }))} value={editTaskForm.tipo}>
                <option value="livre">Livre</option>
                <option value="fixa">Fixa</option>
              </select>
            </FormField>
            <FormField label="Prazo de conclusao">
              <Input max={record?.prazoProcesso ?? undefined} onChange={(event) => setEditTaskForm((current) => ({ ...current, prazo_conclusao: event.target.value }))} type="date" value={editTaskForm.prazo_conclusao} />
            </FormField>
            <FormField label="Recorrencia">
              <select className={selectClassName} onChange={(event) => setEditTaskForm((current) => ({ ...current, recorrencia_tipo: event.target.value as "" | TarefaRecorrenciaTipo, recorrencia_dias_semana: event.target.value === "semanal" ? current.recorrencia_dias_semana : [], recorrencia_dia_mes: event.target.value === "mensal" ? current.recorrencia_dia_mes : "" }))} value={editTaskForm.recorrencia_tipo}>
                <option value="">Sem recorrencia</option>
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </FormField>
            {editTaskForm.recorrencia_tipo === "semanal" ? <div className="col-span-2 flex flex-wrap gap-2">{WEEKDAY_OPTIONS.map((item) => <Button key={`edit-${item}`} onClick={() => setEditTaskForm((current) => ({ ...current, recorrencia_dias_semana: current.recorrencia_dias_semana.includes(item) ? current.recorrencia_dias_semana.filter((value) => value !== item) : [...current.recorrencia_dias_semana, item] }))} size="sm" type="button" variant={editTaskForm.recorrencia_dias_semana.includes(item) ? "primary" : "outline"}>{item}</Button>)}</div> : null}
            {editTaskForm.recorrencia_tipo === "mensal" ? <FormField label="Dia do mes"><Input max="31" min="1" onChange={(event) => setEditTaskForm((current) => ({ ...current, recorrencia_dia_mes: event.target.value }))} type="number" value={editTaskForm.recorrencia_dia_mes} /></FormField> : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setEditingTask(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={!editingTask || editTaskForm.descricao.trim().length < 3 || isSubmitting || !editTaskForm.prazo_conclusao}
              onClick={() => (editingTask ? void handleUpdateTask() : undefined)}
              type="button"
            >
              Salvar alteraçoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setTaskPrazoChange(null)} open={Boolean(taskPrazoChange)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteracao de prazo do processo</DialogTitle>
            <DialogDescription>
              {taskPrazoChange?.details.prazoLabel ?? "Este prazo"} ja possui uma data gravada neste processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Data anterior: {taskPrazoChange?.details.prazoDataAnterior ? new Date(taskPrazoChange.details.prazoDataAnterior).toLocaleDateString("pt-BR") : "-"}
            </div>
            <div className="rounded-[20px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Nova data: {taskPrazoChange?.details.prazoDataNova ? new Date(taskPrazoChange.details.prazoDataNova).toLocaleDateString("pt-BR") : "-"}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTaskPrazoChange(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                if (!taskPrazoChange) {
                  return;
                }
                void (taskPrazoChange.mode === "create" ? handleCreateTask(true) : handleUpdateTask(true));
              }}
              type="button"
            >
              Confirmar alteracao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setDeleteTask(null)} open={Boolean(deleteTask)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir tarefa</DialogTitle>
            <DialogDescription>Esta ação remove a tarefa pendente e registra a remoção no histórico. Digite EXCLUIR para confirmar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {deleteTask?.descricao}
            </div>
            <FormField label="Confirmação">
              <Input onChange={(event) => setDeleteTaskConfirm(event.target.value)} placeholder="EXCLUIR" value={deleteTaskConfirm} />
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={() => setDeleteTask(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={!deleteTask || deleteTaskConfirm !== "EXCLUIR" || isSubmitting}
              onClick={() =>
                deleteTask
                  ? void runMutation(
                      async () => {
                        await removePreDemandaTarefa(preId, deleteTask.id);
                        setDeleteTask(null);
                      },
                      "Tarefa excluída.",
                    )
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

      <ConfirmDialog
        confirmLabel={statusAction?.title ?? "Confirmar alteracao"}
        description="Registre o motivo para manter a trilha de auditoria completa."
        onConfirm={async ({ motivo, observacoes }) => {
          if (!statusAction) return;
          try {
            setError("");
            setMessage("");
            await updatePreDemandaStatus(preId, { status: statusAction.nextStatus, motivo, observacoes });
            await load();
            setMessage(`Processo atualizado para ${getPreDemandaStatusLabel(statusAction.nextStatus)}.`);
          } catch (nextError) {
            throw new Error(formatPreDemandaMutationError(nextError, "Falha ao atualizar o processo."));
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
