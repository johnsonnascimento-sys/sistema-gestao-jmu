import {
  CalendarClock,
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
import { useNavigate, useParams } from "react-router-dom";
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
  addPreDemandaInteressado,
  addPreDemandaVinculo,
  associateSei,
  concluirPreDemandaTarefa,
  createInteressado,
  createPreDemanda,
  createPreDemandaTarefa,
  formatAppError,
  getPreDemanda,
  getTimeline,
  listInteressados,
  listPreDemandas,
  listSetores,
  removePreDemandaInteressado,
  removePreDemandaVinculo,
  tramitarPreDemanda,
  updatePreDemandaAnotacoes,
  updatePreDemandaCase,
  updatePreDemandaStatus,
} from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { formatAllowedStatuses, getPreferredReopenStatus, getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import { formatSeiInput, isValidSei, normalizeSeiValue } from "../lib/sei";
import type { Interessado, PreDemanda, PreDemandaStatus, Setor, TimelineEvent } from "../types";

type ToolbarDialog = null | "related" | "edit" | "send" | "link" | "notes" | "deadline" | "andamento";

type StatusAction = {
  nextStatus: PreDemandaStatus;
  title: string;
  requireReason: boolean;
};

const FIXED_TASKS = [
  "Aguardando assinatura de interessado",
  "Aguardando envio ao setor",
  "Aguardando retorno do setor",
  "Aguardando definicao de audiencia",
];

export function PreDemandaDetailPage() {
  const { preId = "" } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<PreDemanda | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
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
    prazo_final: "",
    frequencia: "",
    pagamento_envolvido: false,
    audiencia_data: "",
    audiencia_status: "",
  });
  const [relatedForm, setRelatedForm] = useState({
    solicitante: "",
    assunto: "",
    data_referencia: new Date().toISOString().slice(0, 10),
    descricao: "",
  });
  const [notesForm, setNotesForm] = useState("");
  const [deadlineForm, setDeadlineForm] = useState("");
  const [tramitarSetorId, setTramitarSetorId] = useState("");
  const [andamentoForm, setAndamentoForm] = useState("");
  const [taskForm, setTaskForm] = useState({ descricao: "", tipo: "livre" as const });
  const [interessadoSearch, setInteressadoSearch] = useState("");
  const [interessadoRole, setInteressadoRole] = useState<"solicitante" | "interessado">("interessado");
  const [newInteressadoForm, setNewInteressadoForm] = useState({ nome: "", matricula: "", cpf: "" });
  const [processSearch, setProcessSearch] = useState("");
  const isSeiValid = isValidSei(associationForm.sei_numero);

  async function load() {
    setLoading(true);
    try {
      const [nextRecord, nextTimeline, nextSetores] = await Promise.all([getPreDemanda(preId), getTimeline(preId), listSetores()]);
      setRecord(nextRecord);
      setTimeline(nextTimeline);
      setSetores(nextSetores);
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
        prazo_final: nextRecord.prazoFinal ?? "",
        frequencia: nextRecord.metadata.frequencia ?? "",
        pagamento_envolvido: nextRecord.metadata.pagamentoEnvolvido ?? false,
        audiencia_data: nextRecord.metadata.audienciaData ?? "",
        audiencia_status: nextRecord.metadata.audienciaStatus ?? "",
      });
      setNotesForm(nextRecord.anotacoes ?? "");
      setDeadlineForm(nextRecord.prazoFinal ?? "");
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar demanda."));
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
        const result = await listInteressados({ q: interessadoSearch, page: 1, pageSize: 8 });
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
      case "aberta":
        return { title: "Triar e enriquecer o caso", description: "Vincule interessados, complemente metadata e defina setor, prazo e relacionamentos processuais." };
      case "aguardando_sei":
        return { title: "Monitorar a geracao do processo", description: "Mantenha tarefas de acompanhamento activas e associe o numero SEI assim que ele existir." };
      case "associada":
        return { title: "Conduzir a execucao administrativa", description: "Tramite o caso, conclua tarefas pendentes e encerre apenas quando a tratativa estiver fechada." };
      case "encerrada":
        return { title: "Preservar historico e reabrir apenas com motivo", description: "O caso esta fechado. Reabra so se houver fato novo, correcao processual ou impulso operacional real." };
    }
  }, [record]);

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
      setError("Informe um numero SEI no formato 0000000-00.0000.0.00.0000.");
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

  if (loading) {
    return <LoadingState description="A workbench processual esta a ser preparada com metadados, envolvidos e historico." title="Carregando demanda" />;
  }

  if (error && !record) {
    return <ErrorState description={error} />;
  }

  if (!record || !queueHealth) {
    return <ErrorState description="Demanda nao encontrada." />;
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
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Button onClick={() => setToolbarDialog("related")} type="button" variant="secondary">
            <FilePlus2 className="h-4 w-4" />
            Relacionado
          </Button>
          <Button onClick={() => setToolbarDialog("edit")} type="button" variant="secondary">
            <Edit className="h-4 w-4" />
            Alterar
          </Button>
          <Button onClick={() => setToolbarDialog("send")} type="button" variant="secondary">
            <Send className="h-4 w-4" />
            Tramitar
          </Button>
          <Button onClick={() => setToolbarDialog("link")} type="button" variant="secondary">
            <LinkIcon className="h-4 w-4" />
            Vincular
          </Button>
          <Button onClick={() => setToolbarDialog("notes")} type="button" variant="secondary">
            <StickyNote className="h-4 w-4" />
            Anotacoes
          </Button>
          <Button onClick={() => setToolbarDialog("deadline")} type="button" variant="secondary">
            <CalendarClock className="h-4 w-4" />
            Prazos
          </Button>
          <Button onClick={() => setToolbarDialog("andamento")} type="button" variant="ghost">
            <Plus className="h-4 w-4" />
            Andamento
          </Button>
          <Button onClick={() => setStatusAction({ nextStatus: "encerrada", title: "Concluir processo", requireReason: true })} type="button" variant="ghost">
            <CheckCircle className="h-4 w-4" />
            Concluir
          </Button>
          {record.allowedNextStatuses.includes("aguardando_sei") ? (
            <Button onClick={() => setStatusAction({ nextStatus: "aguardando_sei", title: "Marcar como aguardando SEI", requireReason: false })} type="button" variant="ghost">
              Aguardar SEI
            </Button>
          ) : null}
          {record.status === "encerrada" && reopenStatus ? (
            <Button onClick={() => setStatusAction({ nextStatus: reopenStatus, title: "Reabrir processo", requireReason: true })} type="button" variant="ghost">
              Reabrir
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <Card>
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
              <SummaryItem label="Solicitante legado" value={record.solicitante} />
              <SummaryItem label="Setor atual" value={record.setorAtual ? `${record.setorAtual.sigla} - ${record.setorAtual.nomeCompleto}` : "Nao tramitado"} />
              <SummaryItem label="Prazo final" value={record.prazoFinal ? new Date(record.prazoFinal).toLocaleDateString("pt-BR") : "-"} />
              <SummaryItem label="Numero judicial" value={record.numeroJudicial ?? "-"} />
              <SummaryItem label="Pagamento envolvido" value={record.metadata.pagamentoEnvolvido ? "Sim" : "Nao informado"} />
              <SummaryItem label="Frequencia" value={record.metadata.frequencia ?? "-"} />
              <SummaryItem label="Data da audiencia" value={record.metadata.audienciaData ? new Date(record.metadata.audienciaData).toLocaleDateString("pt-BR") : "-"} />
              <SummaryItem label="Status da audiencia" value={record.metadata.audienciaStatus ?? "-"} />
              <SummaryItem className="md:col-span-2" label="Anotacoes" value={record.anotacoes ?? "-"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Envolvidos</CardTitle>
              <CardDescription>Multi-cadastro de interessados para substituir o controle isolado em planilha.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <Input onChange={(event) => setInteressadoSearch(event.target.value)} placeholder="Buscar interessado..." value={interessadoSearch} />
                <select className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm" onChange={(event) => setInteressadoRole(event.target.value as "solicitante" | "interessado")} value={interessadoRole}>
                  <option value="interessado">Interessado</option>
                  <option value="solicitante">Solicitante</option>
                </select>
                <Button
                  onClick={() =>
                    interessadoResults[0]
                      ? void runMutation(() => addPreDemandaInteressado(preId, { interessado_id: interessadoResults[0].id, papel: interessadoRole }).then(() => undefined), "Interessado vinculado.")
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
                        onClick={() => void runMutation(() => addPreDemandaInteressado(preId, { interessado_id: item.id, papel: interessadoRole }).then(() => undefined), "Interessado vinculado.")}
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
                <p className="text-sm font-semibold text-slate-950">Adicionar novo interessado</p>
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
                          const created = await createInteressado({ nome: newInteressadoForm.nome, matricula: newInteressadoForm.matricula || null, cpf: newInteressadoForm.cpf || null });
                          await addPreDemandaInteressado(preId, { interessado_id: created.id, papel: interessadoRole });
                          setNewInteressadoForm({ nome: "", matricula: "", cpf: "" });
                          setInteressadoSearch("");
                        },
                        "Interessado criado e vinculado.",
                      )
                    }
                    type="button"
                  >
                    Criar e vincular
                  </Button>
                </div>
              </div>

              {record.interessados.length === 0 ? (
                <EmptyState description="Vincule os envolvidos do caso para destravar tarefas, tramitacoes e relacoes processuais." title="Sem envolvidos" />
              ) : (
                <div className="grid gap-3">
                  {record.interessados.map((item) => (
                    <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3" key={item.interessado.id}>
                      <div>
                        <p className="font-semibold text-slate-950">{item.interessado.nome}</p>
                        <p className="text-sm text-slate-500">{item.papel} - {item.interessado.cpf ?? item.interessado.matricula ?? "Sem CPF/matricula"}</p>
                      </div>
                      <Button onClick={() => void runMutation(() => removePreDemandaInteressado(preId, item.interessado.id).then(() => undefined), "Interessado removido.")} size="sm" type="button" variant="ghost">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist / Proximas tarefas</CardTitle>
              <CardDescription>Concluir uma tarefa baixa automaticamente para o historico processual.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
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

              <div className="flex flex-wrap gap-2">
                {FIXED_TASKS.map((item) => (
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
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Visao operacional</CardTitle>
              <CardDescription>{nextAction.title}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-slate-600">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-900">{nextAction.title}</p>
                <p className="mt-2 text-sm text-amber-800">{nextAction.description}</p>
              </div>
              <SummaryItem label="SEI atual" value={record.currentAssociation?.seiNumero ?? "Ainda nao associado"} />
              <SummaryItem label="Ultima movimentacao" value={lastEvent ? `${new Date(lastEvent.occurredAt).toLocaleString("pt-BR")} - ${lastEvent.descricao ?? "Evento registado"}` : "Nenhum evento registado"} />
              <SummaryItem label="Saude da fila" value={queueHealth.summary} />
              <SummaryItem label="Detalhe da fila" value={queueHealth.detail} />
              <SummaryItem label="Proximos estados permitidos" value={record.allowedNextStatuses.length ? formatAllowedStatuses(record.allowedNextStatuses) : "Nenhuma transicao manual disponivel"} />
              <SummaryItem label="Data de conclusao" value={record.dataConclusao ? new Date(record.dataConclusao).toLocaleDateString("pt-BR") : "-"} />
            </CardContent>
          </Card>

          <Card>
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Associacao PRE para SEI</CardTitle>
              <CardDescription>Validacao e mascara seguem o backend para manter o vinculo confiavel.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleAssociation}>
                <FormField hint={<code>0000000-00.0000.0.00.0000</code>} label="Numero SEI">
                  <Input onChange={(event) => setAssociationForm((current) => ({ ...current, sei_numero: formatSeiInput(event.target.value) }))} placeholder="0000000-00.0000.0.00.0000" value={associationForm.sei_numero} />
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historico (Andamentos)</CardTitle>
              <CardDescription>Timeline unificada com criacao, status, SEI, tramitacoes, tarefas e lancamentos manuais.</CardDescription>
            </CardHeader>
            <CardContent>{timeline.length === 0 ? <EmptyState description="Assim que houver qualquer movimentacao operacional, os eventos aparecem aqui." title="Sem eventos registados" /> : <Timeline events={timeline} />}</CardContent>
          </Card>
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
              <FormField label="Prazo final">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, prazo_final: event.target.value }))} type="date" value={editForm.prazo_final} />
              </FormField>
              <FormField label="Frequencia">
                <Input onChange={(event) => setEditForm((current) => ({ ...current, frequencia: event.target.value }))} value={editForm.frequencia} />
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
            <label className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
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
                      prazo_final: editForm.prazo_final || null,
                      numero_judicial: editForm.numero_judicial || null,
                      metadata: {
                        frequencia: editForm.frequencia || null,
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
            <select className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm" onChange={(event) => setTramitarSetorId(event.target.value)} value={tramitarSetorId}>
              <option value="">Selecione um setor</option>
              {setores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sigla} - {item.nomeCompleto}
                </option>
              ))}
            </select>
          </FormField>
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={!tramitarSetorId || isSubmitting} onClick={() => void runMutation(() => tramitarPreDemanda(preId, tramitarSetorId).then(() => setToolbarDialog(null)), "Processo tramitado.")} type="button">
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
            <DialogDescription>Defina, altere ou remova o prazo final do caso.</DialogDescription>
          </DialogHeader>
          <FormField label="Prazo final">
            <Input onChange={(event) => setDeadlineForm(event.target.value)} type="date" value={deadlineForm} />
          </FormField>
          <DialogFooter>
            <Button onClick={() => setToolbarDialog(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={isSubmitting} onClick={() => void runMutation(() => updatePreDemandaCase(preId, { prazo_final: deadlineForm || null }).then(() => setToolbarDialog(null)), "Prazo atualizado.")} type="button">
              Salvar prazo
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
            <DialogDescription>Crie uma nova pre-demanda e relacione-a automaticamente ao caso atual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Solicitante">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, solicitante: event.target.value }))} value={relatedForm.solicitante} />
            </FormField>
            <FormField label="Assunto">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, assunto: event.target.value }))} value={relatedForm.assunto} />
            </FormField>
            <FormField label="Data de referencia">
              <Input onChange={(event) => setRelatedForm((current) => ({ ...current, data_referencia: event.target.value }))} type="date" value={relatedForm.data_referencia} />
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
              disabled={relatedForm.solicitante.trim().length < 3 || relatedForm.assunto.trim().length < 3 || isSubmitting}
              onClick={() =>
                void runMutation(
                  async () => {
                    const created = await createPreDemanda(relatedForm);
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

function SummaryItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-slate-950">{value}</p>
    </div>
  );
}
