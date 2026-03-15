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
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
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
  removePreDemandaAssunto,
  removePreDemandaInteressado,
  removePreDemandaVinculo,
  tramitarPreDemandaMultiplos,
  updatePreDemandaAnotacoes,
  updatePreDemandaCase,
  updatePreDemandaStatus,
} from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { formatAllowedStatuses, getPreferredReopenStatus, getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import { formatSeiInput, isValidSei, normalizeSeiValue } from "../lib/sei";
import type { Assunto, Interessado, PreDemanda, PreDemandaStatus, Setor, TimelineEvent } from "../types";

type ToolbarDialog = null | "related" | "edit" | "send" | "link" | "notes" | "deadline" | "andamento";

type StatusAction = {
  nextStatus: PreDemandaStatus;
  title: string;
  requireReason: boolean;
};

const FIXED_TASKS = [
  "Aguardando assinatura de pessoa",
  "Aguardando envio ao setor",
  "Aguardando retorno do setor",
  "Aguardando definicao de audiencia",
];

const WEEKDAY_OPTIONS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"] as const;
const selectClassName =
  "h-11 w-full rounded-2xl border border-sky-100/90 bg-white/95 px-4 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-sky-200/55";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associationForm, setAssociationForm] = useState({ sei_numero: "", motivo: "", observacoes: "" });
  const [editForm, setEditForm] = useState({
    assunto: "",
    descricao: "",
    fonte: "",
    observacoes: "",
    numero_judicial: "",
    prazo_inicial: "",
    prazo_intermediario: "",
    prazo_final: "",
    frequencia: "",
    frequencia_dias_semana: [] as string[],
    frequencia_dia_mes: "",
    pagamento_envolvido: false,
    audiencia_data: "",
    audiencia_status: "",
  });
  const [relatedForm, setRelatedForm] = useState({
    assunto: "",
    data_referencia: new Date().toISOString().slice(0, 10),
    descricao: "",
    prazo_inicial: "",
    prazo_intermediario: "",
    prazo_final: "",
  });
  const [notesForm, setNotesForm] = useState("");
  const [deadlineForm, setDeadlineForm] = useState({
    prazo_inicial: "",
    prazo_intermediario: "",
    prazo_final: "",
  });
  const [tramitarSetorIds, setTramitarSetorIds] = useState<string[]>([]);
  const [andamentoForm, setAndamentoForm] = useState("");
  const [taskForm, setTaskForm] = useState({ descricao: "", tipo: "livre" as const });
  const [commentForm, setCommentForm] = useState("");
  const [documentForm, setDocumentForm] = useState<{ file: File | null; descricao: string }>({ file: null, descricao: "" });
  const [interessadoSearch, setInteressadoSearch] = useState("");
  const [interessadoRole, setInteressadoRole] = useState<"solicitante" | "interessado">("interessado");
  const [newInteressadoForm, setNewInteressadoForm] = useState({ nome: "", matricula: "", cpf: "" });
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
        numero_judicial: nextRecord.numeroJudicial ?? "",
        prazo_inicial: nextRecord.prazoInicial ?? "",
        prazo_intermediario: nextRecord.prazoIntermediario ?? "",
        prazo_final: nextRecord.prazoFinal ?? "",
        frequencia: nextRecord.metadata.frequencia ?? "",
        frequencia_dias_semana: nextRecord.metadata.frequenciaDiasSemana ?? [],
        frequencia_dia_mes: nextRecord.metadata.frequenciaDiaMes ? String(nextRecord.metadata.frequenciaDiaMes) : "",
        pagamento_envolvido: nextRecord.metadata.pagamentoEnvolvido ?? false,
        audiencia_data: nextRecord.metadata.audienciaData ?? "",
        audiencia_status: nextRecord.metadata.audienciaStatus ?? "",
      });
      setNotesForm(nextRecord.anotacoes ?? "");
      setDeadlineForm({
        prazo_inicial: nextRecord.prazoInicial ?? "",
        prazo_intermediario: nextRecord.prazoIntermediario ?? "",
        prazo_final: nextRecord.prazoFinal ?? "",
      });
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar processo."));
    } finally {
      setLoading(false);
    }
  }

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

  const queueHealth = useMemo(() => (record ? getQueueHealth(record) : null), [record]);
  const pendingTasks = useMemo(() => record?.tarefasPendentes.filter((item) => !item.concluida) ?? [], [record]);
  const completedTasks = useMemo(() => record?.tarefasPendentes.filter((item) => item.concluida) ?? [], [record]);
  const lastEvent = useMemo(() => timeline[0] ?? null, [timeline]);
  const nextAction = useMemo(() => {
    if (!record) return { title: "", description: "" };
    switch (record.status) {
      case "em_andamento":
        return { title: "Conduzir a execucao administrativa", description: "Vincule pessoas, complemente metadata, tramita o caso e conclua tarefas pendentes ate o encerramento." };
      case "aguardando_sei":
        return { title: "Monitorar a geracao do processo", description: "Mantenha tarefas de acompanhamento activas e associe o numero SEI assim que ele existir." };
      case "encerrada":
        return { title: "Preservar historico e reabrir apenas com motivo", description: "O caso esta fechado. Reabra so se houver fato novo, correcao processual ou impulso operacional real." };
    }
  }, [record]);
  const taskShortcutOptions = useMemo(() => {
    const items = [...FIXED_TASKS];
    const interessadoShortcuts = (record?.interessados ?? []).slice(0, 6).map((item) => `Aguardando assinatura de ${item.interessado.nome}`);

    if (record?.setorAtual) {
      items.push(`Aguardando retorno do setor ${record.setorAtual.sigla}`);
    }

    return Array.from(new Set([...items, ...interessadoShortcuts]));
  }, [record]);
  const availableAssuntos = useMemo(
    () => assuntosCatalogo.filter((item) => !record?.assuntos.some((linked) => linked.assunto.id === item.id)),
    [assuntosCatalogo, record],
  );
  const frequencySummary = useMemo(() => {
    if (!record?.metadata.frequencia) return "-";
    if (record.metadata.frequencia === "Semanal" && record.metadata.frequenciaDiasSemana?.length) {
      return `Semanal (${record.metadata.frequenciaDiasSemana.join(", ")})`;
    }
    if (record.metadata.frequencia === "Mensal" && record.metadata.frequenciaDiaMes) {
      return `Mensal (dia ${record.metadata.frequenciaDiaMes})`;
    }
    return record.metadata.frequencia;
  }, [record]);
  const sectionSummaries = useMemo(
    () =>
      record
        ? {
            resumo: `${getPreDemandaStatusLabel(record.status)} • ${record.setorAtual?.sigla ?? "Sem setor"} • prazo final ${record.prazoFinal ? new Date(record.prazoFinal).toLocaleDateString("pt-BR") : "-"}`,
            pessoas: record.interessados.length ? `${record.interessados.length} pessoa(s) vinculada(s)` : "Nenhuma pessoa vinculada",
            setores: record.setoresAtivos.length ? `${record.setoresAtivos.length} setor(es) activo(s)` : "Sem setores activos",
            checklist: `${pendingTasks.length} pendente(s) • ${completedTasks.length} concluida(s)`,
            visao: `${nextAction.title} • fila ${queueHealth?.summary ?? "-"}`,
            relacionados: record.vinculos.length ? `${record.vinculos.length} vinculo(s) activo(s)` : "Sem processos relacionados",
            associacaoSei: record.currentAssociation?.seiNumero ?? "Sem numero SEI associado",
            documentos: record.documentos.length ? `${record.documentos.length} documento(s) anexado(s)` : "Sem documentos anexados",
            comentarios: record.comentarios.length ? `${record.comentarios.length} comentario(s) registado(s)` : "Sem comentarios",
            historico: timeline.length ? `${timeline.length} evento(s) registado(s)` : "Sem eventos registados",
          }
        : null,
    [completedTasks.length, nextAction.title, pendingTasks.length, queueHealth?.summary, record, timeline.length],
  );

  function updateEditFrequencia(nextValue: string) {
    setEditForm((current) => ({
      ...current,
      frequencia: nextValue,
      frequencia_dias_semana: nextValue === "Semanal" ? current.frequencia_dias_semana : [],
      frequencia_dia_mes: nextValue === "Mensal" ? current.frequencia_dia_mes : "",
    }));
  }

  function toggleEditWeekday(day: string) {
    setEditForm((current) => ({
      ...current,
      frequencia_dias_semana: current.frequencia_dias_semana.includes(day)
        ? current.frequencia_dias_semana.filter((item) => item !== day)
        : [...current.frequencia_dias_semana, day],
    }));
  }

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
    return <LoadingState description="A workbench processual esta a ser preparada com metadados, envolvidos e historico." title="Carregando processo" />;
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
        description="Workbench operacional inspirada no SEI para controle de envolvidos, tarefas, tramitacoes e historico."
        eyebrow={record.preId}
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
            <ToolbarActionButton icon={CheckCircle} label="Concluir" onClick={() => setStatusAction({ nextStatus: "encerrada", title: "Concluir processo", requireReason: true })} title="Concluir processo" variant="ghost" />
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.resumo} title="Resumo executivo">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Resumo executivo</CardTitle>
                  <CardDescription>{nextAction.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={record.status} />
                  <QueueHealthPill item={record} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
              <SummaryItem label="Pessoa principal" value={record.pessoaPrincipal?.nome ?? record.solicitante} />
              <SummaryItem label="Setor atual" value={record.setorAtual ? `${record.setorAtual.sigla} - ${record.setorAtual.nomeCompleto}` : "Nao tramitado"} />
              <SummaryItem label="Prazo inicial" value={record.prazoInicial ? new Date(record.prazoInicial).toLocaleDateString("pt-BR") : "-"} />
              <SummaryItem label="Prazo intermediario" value={record.prazoIntermediario ? new Date(record.prazoIntermediario).toLocaleDateString("pt-BR") : "-"} />
              <SummaryItem label="Prazo final" value={record.prazoFinal ? new Date(record.prazoFinal).toLocaleDateString("pt-BR") : "-"} />
              <SummaryItem label="Numero principal" value={record.principalNumero} />
              <SummaryItem label="Pagamento envolvido" value={record.metadata.pagamentoEnvolvido ? "Sim" : "Nao informado"} />
              <SummaryItem label="Frequencia" value={frequencySummary} />
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
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <Input onChange={(event) => setInteressadoSearch(event.target.value)} placeholder="Buscar pessoa..." value={interessadoSearch} />
                <select className={selectClassName} onChange={(event) => setInteressadoRole(event.target.value as "solicitante" | "interessado")} value={interessadoRole}>
                  <option value="interessado">Pessoa vinculada</option>
                  <option value="solicitante">Pessoa principal</option>
                </select>
                <Button
                  onClick={() =>
                    interessadoResults[0]
                      ? void runMutation(() => addPreDemandaInteressado(preId, { interessado_id: interessadoResults[0].id, papel: interessadoRole }).then(() => undefined), "Pessoa vinculada.")
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
                        onClick={() => void runMutation(() => addPreDemandaInteressado(preId, { interessado_id: item.id, papel: interessadoRole }).then(() => undefined), "Pessoa vinculada.")}
                        type="button"
                      >
                        <span>
                          <span className="block font-semibold text-slate-950">{item.nome}</span>
                          <span className="block text-slate-500">{item.cpf ?? item.matricula ?? "Sem identificador adicional"}</span>
                        </span>
                        <Plus className="h-4 w-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 rounded-[24px] border border-dashed border-slate-300 p-4">
                <p className="text-sm font-semibold text-slate-950">Adicionar nova pessoa</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input onChange={(event) => setNewInteressadoForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome" value={newInteressadoForm.nome} />
                  <Input onChange={(event) => setNewInteressadoForm((current) => ({ ...current, matricula: event.target.value }))} placeholder="Matricula" value={newInteressadoForm.matricula} />
                  <Input onChange={(event) => setNewInteressadoForm((current) => ({ ...current, cpf: event.target.value }))} placeholder="CPF" value={newInteressadoForm.cpf} />
                </div>
                <div className="flex justify-end">
                  <Button
                    disabled={newInteressadoForm.nome.trim().length < 3}
                    onClick={() =>
                      void runMutation(
                        async () => {
                          const created = await createPessoa({ nome: newInteressadoForm.nome, matricula: newInteressadoForm.matricula || null, cpf: newInteressadoForm.cpf || null });
                          await addPreDemandaInteressado(preId, { interessado_id: created.id, papel: interessadoRole });
                          setNewInteressadoForm({ nome: "", matricula: "", cpf: "" });
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
                <EmptyState description="Vincule pessoas ao caso para destravar tarefas, tramitacoes e relacoes processuais." title="Sem pessoas vinculadas" />
              ) : (
                <div className="grid gap-3">
                  {record.interessados.map((item) => (
                    <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.interessado.id}>
                      <div>
                        <p className="font-semibold text-slate-950">{item.interessado.nome}</p>
                        <p className="text-sm text-slate-500">{item.papel} - {item.interessado.cpf ?? item.interessado.matricula ?? "Sem CPF/matricula"}</p>
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

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.setores} title="Setores activos">
            <CardHeader>
              <CardTitle>Setores activos</CardTitle>
              <CardDescription>O mesmo processo pode correr em paralelo por mais de um setor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {record.setoresAtivos.length === 0 ? (
                <EmptyState description="Abra a acao Tramitar para distribuir o processo entre um ou mais setores." title="Sem setores activos" />
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

              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <Input onChange={(event) => setTaskForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Descreva a proxima tarefa" value={taskForm.descricao} />
                <select className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm" onChange={(event) => setTaskForm((current) => ({ ...current, tipo: event.target.value as "fixa" | "livre" }))} value={taskForm.tipo}>
                  <option value="livre">Livre</option>
                  <option value="fixa">Fixa</option>
                </select>
                <Button
                  disabled={taskForm.descricao.trim().length < 3}
                  onClick={() =>
                    void runMutation(
                      async () => {
                        await createPreDemandaTarefa(preId, taskForm);
                        setTaskForm({ descricao: "", tipo: "livre" });
                      },
                      "Tarefa criada.",
                    )
                  }
                  type="button"
                >
                  Criar tarefa
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm" onChange={(event) => setTaskForm({ descricao: event.target.value, tipo: "fixa" })} value="">
                  <option value="">Atalhos de tarefas</option>
                  {taskShortcutOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 md:self-center">Os atalhos consideram envolvidos e setor atual.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {taskShortcutOptions.slice(0, 6).map((item) => (
                  <Button key={item} onClick={() => setTaskForm({ descricao: item, tipo: "fixa" })} size="sm" type="button" variant="outline">
                    {item}
                  </Button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3">
                  <p className="text-sm font-semibold text-slate-950">Pendentes</p>
                  {pendingTasks.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhuma tarefa pendente.</p>
                  ) : (
                    pendingTasks.map((task) => (
                      <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={task.id}>
                        <input className="mt-1 h-4 w-4 accent-slate-950" onChange={() => void runMutation(() => concluirPreDemandaTarefa(preId, task.id).then(() => undefined), "Tarefa concluida.")} type="checkbox" />
                        <span>
                          <span className="block font-semibold text-slate-950">{task.descricao}</span>
                          <span className="text-sm text-slate-500">{task.tipo}</span>
                          {task.setorDestino ? <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Ao concluir, tramita para {task.setorDestino.sigla}</span> : null}
                        </span>
                      </label>
                    ))
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
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </DetailSectionCard>
        </div>

        <div className="grid gap-6">
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
              <SummaryItem label="Ultima movimentacao" value={lastEvent ? `${new Date(lastEvent.occurredAt).toLocaleString("pt-BR")} - ${lastEvent.descricao ?? "Evento registado"}` : "Nenhum evento registado"} />
              <SummaryItem label="Saude da fila" value={queueHealth.summary} />
              <SummaryItem label="Detalhe da fila" value={queueHealth.detail} />
              <SummaryItem label="Proximos estados permitidos" value={record.allowedNextStatuses.length ? formatAllowedStatuses(record.allowedNextStatuses) : "Nenhuma transicao manual disponivel"} />
              <SummaryItem label="Data de conclusao" value={record.dataConclusao ? new Date(record.dataConclusao).toLocaleDateString("pt-BR") : "-"} />
            </CardContent>
          </DetailSectionCard>

          <DetailSectionCard defaultOpen={false} summary={sectionSummaries?.relacionados} title="Processos relacionados">
            <CardHeader>
              <CardTitle>Processos relacionados</CardTitle>
              <CardDescription>Relacione casos dependentes, espelho ou desdobramentos sem duplicar trabalho.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {record.vinculos.length === 0 ? (
                <EmptyState description="Use a toolbar para criar um processo relacionado ou vincular um PRE existente." title="Sem vinculos" />
              ) : (
                record.vinculos.map((item) => (
                  <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.processo.preId}>
                    <div>
                      <p className="font-semibold text-slate-950">{item.processo.preId}</p>
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
              <CardTitle>Associacao PRE para SEI</CardTitle>
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
                      "Comentario registado.",
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
              <CardTitle>Historico (Andamentos)</CardTitle>
              <CardDescription>Timeline unificada com criacao, status, SEI, tramitacoes, tarefas e lancamentos manuais.</CardDescription>
            </CardHeader>
            <CardContent>{timeline.length === 0 ? <EmptyState description="Assim que houver qualquer movimentacao operacional, os eventos aparecem aqui." title="Sem eventos registados" /> : <Timeline events={timeline} />}</CardContent>
          </DetailSectionCard>
        </div>
      </div>

      <Dialog onOpenChange={(open) => !open && setToolbarDialog(null)} open={toolbarDialog === "edit"}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consultar / Alterar processo</DialogTitle>
            <DialogDescription>Atualize os dados principais e o metadata operacional do caso.</DialogDescription>
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
                <Input onChange={(event) => setEditForm((current) => ({ ...current, numero_judicial: event.target.value }))} value={editForm.numero_judicial} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Prazo inicial">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, prazo_inicial: event.target.value }))} type="date" value={editForm.prazo_inicial} />
              </FormField>
              <FormField label="Prazo intermediario">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, prazo_intermediario: event.target.value }))} type="date" value={editForm.prazo_intermediario} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Prazo final">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, prazo_final: event.target.value }))} type="date" value={editForm.prazo_final} />
              </FormField>
              <FormField label="Frequencia">
                <select className={selectClassName} onChange={(event) => updateEditFrequencia(event.target.value)} value={editForm.frequencia}>
                  <option value="">Selecione a frequencia</option>
                  <option value="Diaria">Diaria</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Eventual">Eventual</option>
                </select>
              </FormField>
            </div>
            {editForm.frequencia === "Semanal" ? (
              <div className="grid gap-3">
                <p className="text-sm font-medium text-slate-950">Dias da semana</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((item) => (
                    <Button
                      className={editForm.frequencia_dias_semana.includes(item) ? "border-transparent bg-gradient-to-r from-blue-800 to-teal-600 text-white ring-0" : ""}
                      key={item}
                      onClick={() => toggleEditWeekday(item)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {editForm.frequencia === "Mensal" ? (
              <FormField label="Dia do mes (1-31)">
                <Input max="31" min="1" onChange={(event) => setEditForm((current) => ({ ...current, frequencia_dia_mes: event.target.value }))} type="number" value={editForm.frequencia_dia_mes} />
              </FormField>
            ) : null}
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
                <span className="text-slate-500">Sinalizador rapido para o caso.</span>
              </span>
              <input checked={editForm.pagamento_envolvido} className="h-5 w-5 accent-slate-950" onChange={(event) => setEditForm((current) => ({ ...current, pagamento_envolvido: event.target.checked }))} type="checkbox" />
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
                      prazo_inicial: editForm.prazo_inicial || null,
                      prazo_intermediario: editForm.prazo_intermediario || null,
                      prazo_final: editForm.prazo_final || null,
                      numero_judicial: editForm.numero_judicial || null,
                      metadata: {
                        frequencia: editForm.frequencia || null,
                        frequencia_dias_semana: editForm.frequencia === "Semanal" ? editForm.frequencia_dias_semana : null,
                        frequencia_dia_mes: editForm.frequencia === "Mensal" && editForm.frequencia_dia_mes ? Number(editForm.frequencia_dia_mes) : null,
                        pagamento_envolvido: editForm.pagamento_envolvido,
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
            <DialogTitle>Controle de prazos</DialogTitle>
            <DialogDescription>Defina, altere ou remova os tres prazos estruturados do caso.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Prazo inicial">
              <Input onChange={(event) => setDeadlineForm((current) => ({ ...current, prazo_inicial: event.target.value }))} type="date" value={deadlineForm.prazo_inicial} />
            </FormField>
            <FormField label="Prazo intermediario">
              <Input onChange={(event) => setDeadlineForm((current) => ({ ...current, prazo_intermediario: event.target.value }))} type="date" value={deadlineForm.prazo_intermediario} />
            </FormField>
            <FormField label="Prazo final">
              <Input onChange={(event) => setDeadlineForm((current) => ({ ...current, prazo_final: event.target.value }))} type="date" value={deadlineForm.prazo_final} />
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
                      prazo_inicial: deadlineForm.prazo_inicial || null,
                      prazo_intermediario: deadlineForm.prazo_intermediario || null,
                      prazo_final: deadlineForm.prazo_final || null,
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
                  <span className="block font-semibold text-slate-950">{item.preId}</span>
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
            <DialogDescription>Crie um novo processo relacionado usando a mesma pessoa principal do caso atual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Pessoa principal">
              <Input disabled value={record?.pessoaPrincipal?.nome ?? "Vincule uma pessoa principal antes de criar relacionado"} />
            </FormField>
            <FormField label="Assunto">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, assunto: event.target.value }))} value={relatedForm.assunto} />
            </FormField>
            <FormField label="Data de referencia">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, data_referencia: event.target.value }))} type="date" value={relatedForm.data_referencia} />
            </FormField>
            <FormField label="Prazo inicial">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, prazo_inicial: event.target.value }))} type="date" value={relatedForm.prazo_inicial} />
            </FormField>
            <FormField label="Prazo intermediario">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, prazo_intermediario: event.target.value }))} type="date" value={relatedForm.prazo_intermediario} />
            </FormField>
            <FormField label="Prazo final">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, prazo_final: event.target.value }))} type="date" value={relatedForm.prazo_final} />
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
              disabled={!record?.pessoaPrincipal?.id || !relatedForm.prazo_final || relatedForm.assunto.trim().length < 3 || isSubmitting}
              onClick={() =>
                void runMutation(
                  async () => {
                    const created = await createPreDemanda({
                      pessoa_solicitante_id: record?.pessoaPrincipal?.id ?? null,
                      assunto: relatedForm.assunto,
                      data_referencia: relatedForm.data_referencia,
                      descricao: relatedForm.descricao,
                      prazo_inicial: relatedForm.prazo_inicial || null,
                      prazo_intermediario: relatedForm.prazo_intermediario || null,
                      prazo_final: relatedForm.prazo_final,
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
            <DialogDescription>Inclua uma movimentacao livre no historico do caso.</DialogDescription>
          </DialogHeader>
          <Textarea onChange={(event) => setAndamentoForm(event.target.value)} rows={6} value={andamentoForm} />
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={andamentoForm.trim().length < 3 || isSubmitting}
              onClick={() =>
                void runMutation(
                  async () => {
                    await addPreDemandaAndamento(preId, { descricao: andamentoForm });
                    setAndamentoForm("");
                    setToolbarDialog(null);
                  },
                  "Andamento registado.",
                )
              }
              type="button"
            >
              Lancar andamento
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

async function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler o ficheiro."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Falha ao ler o ficheiro."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function SummaryItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-slate-950">{value}</p>
    </div>
  );
}

function DetailSectionCard({
  children,
  defaultOpen = false,
  summary,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  summary?: string | null;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={open ? "" : "overflow-hidden"}>
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-7 py-5 text-left transition hover:bg-white/40"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{summary ?? "Sem resumo disponivel."}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-rose-800">
            {open ? "Em destaque" : "Recolhido"}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm">
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>
      {open ? children : null}
    </Card>
  );
}

function ToolbarActionButton({
  icon: Icon,
  label,
  title,
  onClick,
  variant = "secondary",
}: {
  icon: typeof FilePlus2;
  label: string;
  title: string;
  onClick: () => void;
  variant?: "secondary" | "ghost";
}) {
  return (
    <Button
      className="h-auto min-w-[92px] flex-col rounded-[24px] border border-white/10 px-4 py-3 text-xs shadow-[0_12px_26px_rgba(20,33,61,0.12)]"
      onClick={onClick}
      title={title}
      type="button"
      variant={variant}
    >
      <Icon className="h-5 w-5" />
      <span className="font-semibold">{label}</span>
    </Button>
  );
}
