import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { EmptyState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { FormField } from "../components/form-field";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  createPreDemandaTarefasLote,
  formatAppError,
  listPreDemandaInteressados,
  listPreDemandas,
  listSetores,
} from "../lib/api";
import { formatDateOnlyPtBr } from "../lib/date";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";
import { getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { FIXED_TASKS, WEEKDAY_OPTIONS, selectClassName } from "./pre-demanda-detail-types";
import type {
  BulkTarefaResult,
  DemandaInteressado,
  PreDemanda,
  Setor,
  TarefaPendenteTipo,
  TarefaRecorrenciaTipo,
} from "../types";

const SEARCH_PAGE_SIZE = 8;
const MONTHLY_RECURRENCES: TarefaRecorrenciaTipo[] = [
  "mensal",
  "trimestral",
  "quadrimestral",
  "semestral",
  "anual",
];

type BulkTaskForm = {
  descricao: string;
  tipo: TarefaPendenteTipo;
  urgente: boolean;
  prazo_conclusao: string;
  horario_inicio: string;
  horario_fim: string;
  recorrencia_tipo: "" | TarefaRecorrenciaTipo;
  recorrencia_dias_semana: string[];
  recorrencia_dia_mes: string;
  setor_destino_id: string;
};

function ProcessSummaryCard({
  item,
  selected,
  onToggle,
}: {
  item: PreDemanda;
  selected: boolean;
  onToggle: (item: PreDemanda) => void;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <input checked={selected} onChange={() => onToggle(item)} type="checkbox" />
            Selecionado
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{item.assunto}</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
              {getPreDemandaStatusLabel(item.status)}
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            {item.principalNumero}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {item.currentAssociation?.seiNumero ? `SEI ${item.currentAssociation.seiNumero} • ` : ""}
            {item.pessoaPrincipal?.nome ?? item.solicitante}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>ID {item.preId}</span>
            <span>Prazo {formatDateOnlyPtBr(item.prazoProcesso, "Nao definido")}</span>
            <Link className="font-semibold text-sky-700 hover:text-sky-900" to={buildPreDemandaPath(item.preId)}>
              Abrir processo
            </Link>
          </div>
        </div>
        <Button onClick={() => onToggle(item)} type="button" variant={selected ? "secondary" : "outline"}>
          {selected ? "Remover" : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-slate-50/80">
      <button
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>
      {open ? <div className="grid gap-4 border-t border-slate-200 px-4 py-4">{children}</div> : null}
    </section>
  );
}

export function TarefasLotePage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<PreDemanda[]>([]);
  const [selectedItems, setSelectedItems] = useState<PreDemanda[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [form, setForm] = useState<BulkTaskForm>({
    descricao: "",
    tipo: "livre",
    urgente: false,
    prazo_conclusao: "",
    horario_inicio: "",
    horario_fim: "",
    recorrencia_tipo: "",
    recorrencia_dias_semana: [],
    recorrencia_dia_mes: "",
    setor_destino_id: "",
  });
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [signatureMode, setSignatureMode] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatureOptionsByPreId, setSignatureOptionsByPreId] = useState<Record<string, DemandaInteressado[]>>({});
  const [signatureLoadingByPreId, setSignatureLoadingByPreId] = useState<Record<string, boolean>>({});
  const [signatureErrorByPreId, setSignatureErrorByPreId] = useState<Record<string, string>>({});
  const [signatureSelections, setSignatureSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [lastResult, setLastResult] = useState<BulkTarefaResult | null>(null);

  const selectedIds = useMemo(() => new Set(selectedItems.map((item) => item.preId)), [selectedItems]);
  const addableResults = useMemo(
    () => results.filter((item) => !selectedIds.has(item.preId)),
    [results, selectedIds],
  );
  const requiresTaskSetorDestino =
    !signatureMode &&
    (form.descricao.trim() === "Envio para" || form.descricao.trim() === "Retorno do setor");
  const hasTimeRangeError =
    Boolean(form.horario_inicio) &&
    Boolean(form.horario_fim) &&
    form.horario_fim < form.horario_inicio;
  const requiresWeeklyDays = form.recorrencia_tipo === "semanal";
  const requiresMonthDay = MONTHLY_RECURRENCES.includes(form.recorrencia_tipo as TarefaRecorrenciaTipo);

  useEffect(() => {
    void listSetores()
      .then(setSetores)
      .catch(() => setSetores([]));
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError("");
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await listPreDemandas({ q: trimmed, pageSize: SEARCH_PAGE_SIZE, page: 1 });
        setResults(response.items);
        setSearchError("");
      } catch (error) {
        setResults([]);
        setSearchError(formatAppError(error, "Falha ao buscar processos."));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setSignatureSelections((current) =>
      Object.fromEntries(Object.entries(current).filter(([preId]) => selectedIds.has(preId))),
    );
  }, [selectedIds]);

  useEffect(() => {
    if (!signatureMode) {
      return;
    }

    const missingPreIds = selectedItems
      .map((item) => item.preId)
      .filter(
        (preId) =>
          !signatureOptionsByPreId[preId] &&
          !signatureLoadingByPreId[preId] &&
          !signatureErrorByPreId[preId],
      );

    if (!missingPreIds.length) {
      return;
    }

    for (const preId of missingPreIds) {
      setSignatureLoadingByPreId((current) => ({ ...current, [preId]: true }));
      void listPreDemandaInteressados(preId)
        .then((items) => {
          setSignatureOptionsByPreId((current) => ({ ...current, [preId]: items }));
          setSignatureErrorByPreId((current) => {
            const next = { ...current };
            delete next[preId];
            return next;
          });
          if (items.length === 1) {
            setSignatureSelections((current) =>
              current[preId] ? current : { ...current, [preId]: items[0]!.interessado.id },
            );
          }
        })
        .catch((error) => {
          setSignatureErrorByPreId((current) => ({
            ...current,
            [preId]: formatAppError(error, "Falha ao carregar os envolvidos deste processo."),
          }));
        })
        .finally(() => {
          setSignatureLoadingByPreId((current) => ({ ...current, [preId]: false }));
        });
    }
  }, [selectedItems, signatureErrorByPreId, signatureLoadingByPreId, signatureMode, signatureOptionsByPreId]);

  function toggleSelected(item: PreDemanda) {
    setSelectedItems((current) =>
      current.some((entry) => entry.preId === item.preId)
        ? current.filter((entry) => entry.preId !== item.preId)
        : [...current, item],
    );
  }

  function addAllResults() {
    if (!addableResults.length) {
      return;
    }
    setSelectedItems((current) => [...current, ...addableResults]);
  }

  function applyShortcut(value: string) {
    setForm((current) => ({
      ...current,
      descricao: value,
      tipo: "fixa",
      setor_destino_id:
        value === "Envio para" || value === "Retorno do setor" ? current.setor_destino_id : "",
    }));
    if (value === "Assinatura de pessoa") {
      setSignatureMode(true);
      setSignatureOpen(true);
    } else if (signatureMode) {
      setSignatureMode(false);
    }
  }

  function toggleSignatureMode(nextValue: boolean) {
    setSignatureMode(nextValue);
    setSignatureOpen(nextValue);
    setForm((current) => ({
      ...current,
      descricao:
        nextValue
          ? "Assinatura de pessoa"
          : current.descricao === "Assinatura de pessoa"
            ? ""
            : current.descricao,
    }));
  }

  const submitBlockMessage = useMemo(() => {
    if (!selectedItems.length) {
      return "Selecione ao menos um processo.";
    }
    if (!signatureMode && form.descricao.trim().length < 3) {
      return "Informe uma descricao valida para a tarefa.";
    }
    if (!form.prazo_conclusao) {
      return "Informe o prazo da tarefa.";
    }
    if (hasTimeRangeError) {
      return "O horario de termino nao pode ser anterior ao horario de inicio.";
    }
    if (requiresWeeklyDays && form.recorrencia_dias_semana.length === 0) {
      return "Selecione ao menos um dia da semana para a recorrencia semanal.";
    }
    if (requiresMonthDay && !form.recorrencia_dia_mes) {
      return "Informe o dia do mes para a recorrencia selecionada.";
    }
    if (requiresTaskSetorDestino && !form.setor_destino_id) {
      return "Selecione o setor destino desta tarefa.";
    }
    if (signatureMode) {
      for (const item of selectedItems) {
        if (signatureLoadingByPreId[item.preId]) {
          return "Aguarde o carregamento dos envolvidos antes de enviar.";
        }
        if (signatureErrorByPreId[item.preId]) {
          return "Existe processo sem envolvidos carregados para assinatura.";
        }
        if ((signatureOptionsByPreId[item.preId] ?? []).length === 0) {
          return "Todos os processos precisam ter ao menos uma pessoa vinculada para assinatura.";
        }
        if (!signatureSelections[item.preId]) {
          return "Selecione a pessoa assinante em cada processo.";
        }
      }
    }
    return "";
  }, [
    form.descricao,
    form.prazo_conclusao,
    form.recorrencia_dia_mes,
    form.recorrencia_dias_semana.length,
    form.setor_destino_id,
    hasTimeRangeError,
    requiresMonthDay,
    requiresTaskSetorDestino,
    requiresWeeklyDays,
    selectedItems,
    signatureErrorByPreId,
    signatureLoadingByPreId,
    signatureMode,
    signatureOptionsByPreId,
    signatureSelections,
  ]);

  async function handleSubmit() {
    if (submitting || submitBlockMessage) {
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await createPreDemandaTarefasLote({
        pre_ids: selectedItems.map((item) => item.preId),
        descricao: signatureMode ? "Assinatura de pessoa" : form.descricao.trim(),
        tipo: form.tipo,
        urgente: form.urgente,
        prazo_conclusao: form.prazo_conclusao,
        horario_inicio: form.horario_inicio || null,
        horario_fim: form.horario_fim || null,
        recorrencia_tipo: form.recorrencia_tipo || null,
        recorrencia_dias_semana:
          form.recorrencia_tipo === "semanal" ? form.recorrencia_dias_semana : null,
        recorrencia_dia_mes:
          requiresMonthDay && form.recorrencia_dia_mes ? Number(form.recorrencia_dia_mes) : null,
        setor_destino_id: form.setor_destino_id || null,
        assinaturas: signatureMode
          ? selectedItems.map((item) => ({
              preId: item.preId,
              interessadoId: signatureSelections[item.preId]!,
            }))
          : null,
      });
      setLastResult(result);
      const failedIds = new Set(result.results.filter((item) => !item.ok).map((item) => item.preId));
      setSelectedItems((current) => current.filter((item) => failedIds.has(item.preId)));
    } catch (error) {
      setSubmitError(formatAppError(error, "Falha ao registrar tarefas em lote."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Operacao em lote"
        title="Tarefas em Lote"
        description="Busque processos, monte sua selecao e replique a mesma tarefa em varios processos de uma vez."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Buscar e selecionar processos</CardTitle>
            <CardDescription>
              Pesquise por processo, SEI, pessoa ou assunto. Voce pode acumular itens de varias buscas antes de enviar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                className="flex-1"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PROCESSO, SEI, pessoa ou assunto"
                value={query}
              />
              <Button disabled={!addableResults.length} onClick={addAllResults} type="button" variant="outline">
                Selecionar resultados
              </Button>
            </div>

            {searchError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {searchError}
              </div>
            ) : null}

            {!query.trim() ? (
              <EmptyState
                title="Digite para buscar"
                description="Use a mesma logica da busca global para localizar processos por numero, SEI, solicitante, pessoa ou assunto."
              />
            ) : searching ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando processos...
              </div>
            ) : results.length ? (
              <div className="grid gap-3">
                {results.map((item) => (
                  <ProcessSummaryCard
                    item={item}
                    key={item.preId}
                    onToggle={toggleSelected}
                    selected={selectedIds.has(item.preId)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhum processo encontrado"
                description={`Nenhum processo corresponde a "${query.trim()}".`}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Selecionados</CardTitle>
              <CardDescription>
                {selectedItems.length} processo(s) pronto(s) para receber a mesma tarefa.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  {selectedItems.length} selecionado(s)
                </span>
                <Button
                  disabled={!selectedItems.length}
                  onClick={() => setSelectedItems([])}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remover todos
                </Button>
              </div>

              {selectedItems.length ? (
                <div className="grid gap-3">
                  {selectedItems.map((item) => (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3" key={item.preId}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">{item.assunto}</p>
                          <p className="mt-1 text-sm text-slate-500">{item.principalNumero}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span>{item.preId}</span>
                            <Link className="font-semibold text-sky-700 hover:text-sky-900" to={buildPreDemandaPath(item.preId)}>
                              Abrir
                            </Link>
                          </div>
                        </div>
                        <Button onClick={() => toggleSelected(item)} size="sm" type="button" variant="ghost">
                          Remover
                        </Button>
                      </div>
                      {signatureMode && signatureSelections[item.preId] ? (
                        <p className="mt-3 text-xs font-semibold text-indigo-700">
                          Assinante selecionado para este processo.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nenhum processo selecionado ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Montar tarefa</CardTitle>
              <CardDescription>
                Defina os dados da tarefa uma vez e replique em todos os processos selecionados.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Descricao">
                    <Textarea
                      disabled={signatureMode}
                      onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
                      rows={4}
                      value={signatureMode ? "Assinatura de pessoa" : form.descricao}
                    />
                  </FormField>
                  <div className="grid gap-4">
                    <FormField label="Tipo">
                      <select
                        className={selectClassName}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            tipo: event.target.value as TarefaPendenteTipo,
                          }))
                        }
                        value={form.tipo}
                      >
                        <option value="livre">Livre</option>
                        <option value="fixa">Fixa</option>
                      </select>
                    </FormField>
                    <FormField label="Prazo da tarefa">
                      <Input
                        onChange={(event) =>
                          setForm((current) => ({ ...current, prazo_conclusao: event.target.value }))
                        }
                        type="date"
                        value={form.prazo_conclusao}
                      />
                    </FormField>
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-[20px] border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-slate-700">
                  <div className="pr-4">
                    <span className="block font-semibold text-slate-950">Marcar tarefa como urgente</span>
                    <span className="text-xs text-slate-600">Com a tarefa urgente, o processo tambem fica urgente.</span>
                  </div>
                  <input
                    checked={form.urgente}
                    className="h-5 w-5 accent-rose-600"
                    onChange={(event) => setForm((current) => ({ ...current, urgente: event.target.checked }))}
                    type="checkbox"
                  />
                </label>

                <div className="grid gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Atalhos de tarefa</p>
                  <div className="flex flex-wrap gap-2">
                    {FIXED_TASKS.map((item) => (
                      <Button key={item} onClick={() => applyShortcut(item)} size="sm" type="button" variant="outline">
                        {item}
                      </Button>
                    ))}
                  </div>
                </div>
              </section>

              <FormSection
                description="Horario inicial e final, quando a tarefa precisar ser agendada."
                onToggle={() => setAgendaOpen((current) => !current)}
                open={agendaOpen}
                title="Agenda"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField hint="Opcional." label="Horario de inicio">
                    <Input
                      onChange={(event) => setForm((current) => ({ ...current, horario_inicio: event.target.value }))}
                      type="time"
                      value={form.horario_inicio}
                    />
                  </FormField>
                  <FormField hint="Opcional." label="Horario de termino">
                    <Input
                      onChange={(event) => setForm((current) => ({ ...current, horario_fim: event.target.value }))}
                      type="time"
                      value={form.horario_fim}
                    />
                  </FormField>
                </div>
                {hasTimeRangeError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    O horario de termino nao pode ser anterior ao horario de inicio.
                  </div>
                ) : null}
              </FormSection>

              <FormSection
                description="Recorrencia e setor destino para tarefas com regra operacional."
                onToggle={() => setAdvancedOpen((current) => !current)}
                open={advancedOpen}
                title="Avancado"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Recorrencia">
                    <select
                      className={selectClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recorrencia_tipo: event.target.value as "" | TarefaRecorrenciaTipo,
                          recorrencia_dias_semana:
                            event.target.value === "semanal" ? current.recorrencia_dias_semana : [],
                          recorrencia_dia_mes:
                            MONTHLY_RECURRENCES.includes(event.target.value as TarefaRecorrenciaTipo)
                              ? current.recorrencia_dia_mes
                              : "",
                        }))
                      }
                      value={form.recorrencia_tipo}
                    >
                      <option value="">Sem recorrencia</option>
                      <option value="diaria">Diaria</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="quadrimestral">Quadrimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </FormField>

                  <FormField label="Setor destino">
                    <select
                      className={selectClassName}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, setor_destino_id: event.target.value }))
                      }
                      value={form.setor_destino_id}
                    >
                      <option value="">Sem setor destino</option>
                      {setores.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sigla} - {item.nomeCompleto}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {requiresWeeklyDays ? (
                  <div className="grid gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Dias da semana</p>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((item) => (
                        <Button
                          key={item}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              recorrencia_dias_semana: current.recorrencia_dias_semana.includes(item)
                                ? current.recorrencia_dias_semana.filter((value) => value !== item)
                                : [...current.recorrencia_dias_semana, item],
                            }))
                          }
                          size="sm"
                          type="button"
                          variant={form.recorrencia_dias_semana.includes(item) ? "primary" : "outline"}
                        >
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {requiresMonthDay ? (
                  <FormField label="Dia do mes">
                    <Input
                      max="31"
                      min="1"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, recorrencia_dia_mes: event.target.value }))
                      }
                      type="number"
                      value={form.recorrencia_dia_mes}
                    />
                  </FormField>
                ) : null}

                {requiresTaskSetorDestino ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Esta tarefa precisa de setor destino porque a descricao atual indica encaminhamento do processo.
                  </div>
                ) : null}
              </FormSection>

              <FormSection
                description="Selecione a pessoa assinante em cada processo quando a tarefa for de assinatura."
                onToggle={() => setSignatureOpen((current) => !current)}
                open={signatureOpen}
                title="Assinatura"
              >
                <label className="flex items-center justify-between rounded-[20px] border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-slate-700">
                  <div className="pr-4">
                    <span className="block font-semibold text-slate-950">Ativar assinatura por processo</span>
                    <span className="text-xs text-slate-600">Cada processo tera uma pessoa assinante propria.</span>
                  </div>
                  <input
                    checked={signatureMode}
                    className="h-5 w-5 accent-indigo-600"
                    onChange={(event) => toggleSignatureMode(event.target.checked)}
                    type="checkbox"
                  />
                </label>

                {signatureMode ? (
                  selectedItems.length ? (
                    <div className="grid gap-4">
                      {selectedItems.map((item) => {
                        const options = signatureOptionsByPreId[item.preId] ?? [];
                        const selectedPersonId = signatureSelections[item.preId] ?? "";
                        return (
                          <div className="rounded-[22px] border border-slate-200 bg-white p-4" key={`signature-${item.preId}`}>
                            <div className="mb-3">
                              <p className="font-semibold text-slate-950">{item.assunto}</p>
                              <p className="text-sm text-slate-500">{item.preId}</p>
                            </div>

                            {signatureLoadingByPreId[item.preId] ? (
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando envolvidos...
                              </div>
                            ) : signatureErrorByPreId[item.preId] ? (
                              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {signatureErrorByPreId[item.preId]}
                              </div>
                            ) : options.length ? (
                              <div className="grid gap-2">
                                {options.map((option) => (
                                  <button
                                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm ${
                                      selectedPersonId === option.interessado.id
                                        ? "border-indigo-300 bg-indigo-50 text-indigo-950"
                                        : "border-slate-200 bg-slate-50 text-slate-700"
                                    }`}
                                    key={option.interessado.id}
                                    onClick={() =>
                                      setSignatureSelections((current) => ({
                                        ...current,
                                        [item.preId]: option.interessado.id,
                                      }))
                                    }
                                    type="button"
                                  >
                                    <span>{option.interessado.nome}</span>
                                    {selectedPersonId === option.interessado.id ? (
                                      <span className="text-xs font-semibold text-indigo-700">Selecionado</span>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Este processo nao possui pessoa vinculada para assinatura.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      Selecione processos antes de configurar a assinatura.
                    </p>
                  )
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Ative este bloco apenas quando a tarefa em lote representar assinatura.
                  </p>
                )}
              </FormSection>

              {submitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </div>
              ) : null}

              {submitBlockMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {submitBlockMessage}
                </div>
              ) : null}

              <Button disabled={Boolean(submitBlockMessage) || submitting} onClick={handleSubmit} type="button">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Lancar tarefa em lote
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {lastResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do lancamento</CardTitle>
            <CardDescription>
              {lastResult.successCount} sucesso(s) e {lastResult.failureCount} falha(s) em {lastResult.total} processo(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {lastResult.successCount} sucesso(s)
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-800">
                <XCircle className="h-4 w-4" />
                {lastResult.failureCount} falha(s)
              </span>
            </div>
            <div className="grid gap-3">
              {lastResult.results.map((item) => (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4" key={`${item.preId}-${item.ok ? "ok" : "error"}`}>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{item.preId}</p>
                    <p className={`mt-1 text-sm ${item.ok ? "text-emerald-700" : "text-rose-700"}`}>
                      {item.message ?? (item.ok ? "Tarefa registrada." : "Falha ao registrar tarefa.")}
                    </p>
                  </div>
                  <Link className="text-sm font-semibold text-sky-700 hover:text-sky-900" to={buildPreDemandaPath(item.preId)}>
                    Abrir processo
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
