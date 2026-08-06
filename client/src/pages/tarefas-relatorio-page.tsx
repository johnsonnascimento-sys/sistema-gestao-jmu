import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, Printer, RotateCcw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { formatAppError, getTaskReport } from "../lib/api";
import { formatDateOnlyPtBr, formatDateTimePtBr } from "../lib/date";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";
import type {
  TaskReportItem,
  TaskReportQuery,
  TaskReportResult,
  TarefaRecorrenciaTipo,
} from "../types";

const RECURRENCE_OPTIONS: Array<{
  value: TarefaRecorrenciaTipo | "sem_recorrencia" | "";
  label: string;
}> = [
  { value: "", label: "Todas" },
  { value: "sem_recorrencia", label: "Sem recorrência" },
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "quadrimestral", label: "Quadrimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

function getSaoPauloDatePlusDays(days: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + days),
  );
  return date.toISOString().slice(0, 10);
}

export function getDefaultTaskReportFilters(): TaskReportQuery {
  return {
    status: "pendentes",
    dueFrom: undefined,
    dueTo: getSaoPauloDatePlusDays(30),
    urgency: "todas",
    recurrence: undefined,
    q: undefined,
  };
}

function formatRecurrence(value: TarefaRecorrenciaTipo | null) {
  return RECURRENCE_OPTIONS.find((option) => option.value === (value ?? "sem_recorrencia"))?.label ?? "-";
}

function formatTaskTime(item: TaskReportItem) {
  if (item.horarioInicio && item.horarioFim) return `${item.horarioInicio}–${item.horarioFim}`;
  if (item.horarioInicio) return `A partir de ${item.horarioInicio}`;
  if (item.horarioFim) return `Até ${item.horarioFim}`;
  return "Sem horário";
}

function describeFilters(filters: TaskReportQuery, unifyByProcess: boolean) {
  const status = {
    todas: "Todas as situações",
    pendentes: "Somente pendentes",
    concluidas: "Somente concluídas",
  }[filters.status];
  const urgency = {
    todas: "Todas as urgências",
    urgentes: "Somente urgentes",
    nao_urgentes: "Somente não urgentes",
  }[filters.urgency];
  const recurrence = filters.recurrence
    ? `Recorrência: ${RECURRENCE_OPTIONS.find((option) => option.value === filters.recurrence)?.label}`
    : "Todas as recorrências";
  const deadline = filters.dueFrom && filters.dueTo
    ? `Prazo de ${formatDateOnlyPtBr(filters.dueFrom)} a ${formatDateOnlyPtBr(filters.dueTo)}`
    : filters.dueFrom
      ? `Prazo a partir de ${formatDateOnlyPtBr(filters.dueFrom)}`
      : filters.dueTo
        ? `Prazo até ${formatDateOnlyPtBr(filters.dueTo)} (inclui atrasadas)`
        : "Todos os prazos";

  return [
    status,
    deadline,
    urgency,
    recurrence,
    filters.q ? `Busca: “${filters.q}”` : null,
    unifyByProcess ? "Unificado por processo/demanda" : null,
  ].filter((value): value is string => Boolean(value));
}

function groupTaskReportItems(items: TaskReportItem[]) {
  const groups = new Map<string, TaskReportItem[]>();

  items.forEach((item) => {
    const currentGroup = groups.get(item.preId);
    if (currentGroup) {
      currentGroup.push(item);
      return;
    }
    groups.set(item.preId, [item]);
  });

  return Array.from(groups, ([preId, groupItems]) => ({
    preId,
    items: groupItems,
    processoUrgente: groupItems.some((item) => item.processoUrgente),
    hasAudiencia: groupItems.some((item) => item.hasAudiencia),
  }));
}

function partitionTaskReportItems(items: TaskReportItem[]) {
  const processesWithHearing = new Set(
    items.filter((item) => item.hasAudiencia).map((item) => item.preId),
  );

  return {
    hearingItems: items.filter((item) => processesWithHearing.has(item.preId)),
    otherItems: items.filter((item) => !processesWithHearing.has(item.preId)),
  };
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="task-report-summary-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function TaskReportSection({
  hasAudiencia,
  items,
  title,
  unifyByProcess,
}: {
  hasAudiencia: boolean;
  items: TaskReportItem[];
  title: string;
  unifyByProcess: boolean;
}) {
  const sectionId = hasAudiencia ? "task-report-hearing-section" : "task-report-other-section";
  const processCount = new Set(items.map((item) => item.preId)).size;
  const itemGroups = useMemo(
    () => unifyByProcess
      ? groupTaskReportItems(items)
      : items.map((item) => ({
          preId: item.id,
          items: [item],
          processoUrgente: item.processoUrgente,
          hasAudiencia,
        })),
    [hasAudiencia, items, unifyByProcess],
  );

  return (
    <section
      aria-labelledby={`${sectionId}-title`}
      className={`task-report-section ${hasAudiencia ? "task-report-section-hearing" : "task-report-section-other"}`}
    >
      <div className="task-report-section-header flex flex-col gap-2 border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="task-report-section-eyebrow text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {hasAudiencia ? "Pauta judicial" : "Fluxo geral"}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-950" id={`${sectionId}-title`}>{title}</h3>
        </div>
        <p className="task-report-section-count text-xs font-semibold text-slate-600">
          {formatCount(processCount, "processo", "processos")} · {formatCount(items.length, "tarefa", "tarefas")}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="task-report-section-empty border-x border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
          Nenhuma tarefa nesta seção.
        </p>
      ) : (
        <div className="task-report-table-wrap overflow-x-auto border-x border-b border-slate-200">
          <table className="task-report-table w-full min-w-[1120px] border-collapse text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-[0.1em] text-slate-600">
              <tr>
                <th className="px-3 py-3 font-bold">Processo / assunto</th>
                <th className="px-3 py-3 font-bold">Tarefa</th>
                <th className="px-3 py-3 font-bold">Prazo / horário</th>
                <th className="px-3 py-3 font-bold">Situação</th>
                <th className="px-3 py-3 font-bold">Urgência</th>
                <th className="px-3 py-3 font-bold">Tipo</th>
                <th className="px-3 py-3 font-bold">Recorrência</th>
                <th className="px-3 py-3 font-bold">Setor</th>
                <th className="px-3 py-3 font-bold">Conclusão</th>
              </tr>
            </thead>
            {itemGroups.map((group) => (
              <tbody
                className={[
                  unifyByProcess ? "task-report-process-group" : "",
                  group.processoUrgente ? "task-report-process-urgent" : "",
                  group.hasAudiencia ? "task-report-process-hearing" : "",
                ].filter(Boolean).join(" ") || undefined}
                key={group.preId}
              >
                {group.items.map((item, itemIndex) => (
                  <tr className="border-t border-slate-200 align-top" key={item.id}>
                    {itemIndex === 0 ? (
                      <td className="px-3 py-3" rowSpan={unifyByProcess ? group.items.length : undefined}>
                        <Link className="font-semibold text-indigo-800 hover:underline" to={buildPreDemandaPath(item.preId)}>
                          {item.preNumero}
                        </Link>
                        {group.processoUrgente ? (
                          <span className="task-report-process-urgent-badge ml-2 w-fit rounded-full border border-rose-300 bg-rose-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-rose-800">
                            Processo urgente
                          </span>
                        ) : null}
                        {group.hasAudiencia ? (
                          <span className="task-report-process-hearing-badge ml-2 w-fit rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-900">
                            Audiência designada
                          </span>
                        ) : null}
                        <p className="mt-1 max-w-52 text-slate-500">{item.assunto}</p>
                      </td>
                    ) : null}
                    <td className="max-w-64 px-3 py-3 font-medium text-slate-900">{item.descricao}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <p className="font-medium text-slate-900">{formatDateOnlyPtBr(item.prazoConclusao)}</p>
                      <p className="mt-1 text-slate-500">{formatTaskTime(item)}</p>
                    </td>
                    <td className="px-3 py-3">{item.concluida ? "Concluída" : "Pendente"}</td>
                    <td className="px-3 py-3">{item.urgente ? "Urgente" : "Normal"}</td>
                    <td className="px-3 py-3 capitalize">{item.tipo}</td>
                    <td className="px-3 py-3">{formatRecurrence(item.recorrenciaTipo)}</td>
                    <td className="px-3 py-3">{item.setorDestinoSigla ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDateTimePtBr(item.concluidaEm)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

function ReportDocument({
  filters,
  result,
  unifyByProcess,
}: {
  filters: TaskReportQuery;
  result: TaskReportResult;
  unifyByProcess: boolean;
}) {
  const filterDescriptions = useMemo(
    () => describeFilters(filters, unifyByProcess),
    [filters, unifyByProcess],
  );
  const { hearingItems, otherItems } = useMemo(
    () => partitionTaskReportItems(result.items),
    [result.items],
  );

  return (
    <article className={`task-report-document ${result.truncated ? "task-report-document-truncated" : ""} mx-auto w-full max-w-[297mm] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]`}>
      <header className="task-report-document-header border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-700">Gestor JMU</p>
            <h2 className='mt-1 font-["IBM_Plex_Serif",Georgia,serif] text-2xl text-slate-950'>Relatório de tarefas</h2>
          </div>
          <p className="text-sm text-slate-500">Gerado em {formatDateTimePtBr(result.generatedAt)}</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          <span className="font-semibold text-slate-800">Filtros aplicados:</span>{" "}
          {filterDescriptions.join(" · ")}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 px-6 py-5 sm:grid-cols-5">
        <SummaryCard label="Tarefas" value={result.summary.total} />
        <SummaryCard label="Pendentes" value={result.summary.pendentes} />
        <SummaryCard label="Concluídas" value={result.summary.concluidas} />
        <SummaryCard label="Urgentes" value={result.summary.urgentes} />
        <SummaryCard label="Atrasadas" value={result.summary.atrasadas} />
      </div>

      <div className="task-report-sections grid gap-5 border-t border-slate-200 px-6 py-5">
        <TaskReportSection
          hasAudiencia
          items={hearingItems}
          title="Processos com audiência designada"
          unifyByProcess={unifyByProcess}
        />
        <TaskReportSection
          hasAudiencia={false}
          items={otherItems}
          title="Demais processos"
          unifyByProcess={unifyByProcess}
        />
      </div>
    </article>
  );
}

export function TarefasRelatorioPage() {
  const initialFilters = useMemo(() => getDefaultTaskReportFilters(), []);
  const [filters, setFilters] = useState<TaskReportQuery>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<TaskReportQuery>(initialFilters);
  const [unifyByProcess, setUnifyByProcess] = useState(false);
  const [appliedUnifyByProcess, setAppliedUnifyByProcess] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState<TaskReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    void getTaskReport(appliedFilters)
      .then((next) => {
        if (mounted) setResult(next);
      })
      .catch((nextError) => {
        if (mounted) setError(formatAppError(nextError, "Falha ao gerar o relatório de tarefas."));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [appliedFilters, requestVersion]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({ ...filters, q: filters.q?.trim() || undefined });
    setAppliedUnifyByProcess(unifyByProcess);
    setRequestVersion((current) => current + 1);
  }

  function resetFilters() {
    const defaults = getDefaultTaskReportFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setUnifyByProcess(false);
    setAppliedUnifyByProcess(false);
    setRequestVersion((current) => current + 1);
  }

  const printDisabled = loading || !result || result.truncated;

  return (
    <section className="task-report-page grid gap-6">
      <div className="task-report-no-print flex flex-col gap-4 rounded-[32px] border border-white/75 bg-white/90 px-6 py-6 shadow-[0_24px_60px_rgba(20,33,61,0.08)] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-700">Tarefas</p>
          <h1 className='mt-2 font-["IBM_Plex_Serif",Georgia,serif] text-2xl text-slate-950 sm:text-3xl'>Relatório para impressão</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Filtre, confira a prévia e use a impressão do navegador para imprimir ou salvar em PDF.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link to="/tarefas"><ArrowLeft className="h-4 w-4" />Voltar</Link>
          </Button>
          <Button disabled={printDisabled} onClick={() => window.print()} type="button">
            <Printer className="h-4 w-4" />Imprimir / Salvar como PDF
          </Button>
        </div>
      </div>

      <Card className="task-report-no-print rounded-[28px]">
        <CardHeader>
          <CardTitle>Filtros do relatório</CardTitle>
          <CardDescription>A data inicial é opcional; deixando-a vazia, tarefas atrasadas também serão incluídas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-12" onSubmit={applyFilters}>
            <label className="grid gap-2 lg:col-span-4">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pesquisa</span>
              <Input onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Processo, assunto, tarefa ou setor" value={filters.q ?? ""} />
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Situação</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-200/50" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TaskReportQuery["status"] }))} value={filters.status}>
                <option value="todas">Todas</option><option value="pendentes">Pendentes</option><option value="concluidas">Concluídas</option>
              </select>
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Prazo inicial</span>
              <Input max={filters.dueTo} onChange={(event) => setFilters((current) => ({ ...current, dueFrom: event.target.value || undefined }))} type="date" value={filters.dueFrom ?? ""} />
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Prazo final</span>
              <Input min={filters.dueFrom} onChange={(event) => setFilters((current) => ({ ...current, dueTo: event.target.value || undefined }))} type="date" value={filters.dueTo ?? ""} />
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Urgência</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-200/50" onChange={(event) => setFilters((current) => ({ ...current, urgency: event.target.value as TaskReportQuery["urgency"] }))} value={filters.urgency}>
                <option value="todas">Todas</option><option value="urgentes">Urgentes</option><option value="nao_urgentes">Não urgentes</option>
              </select>
            </label>
            <label className="grid gap-2 lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recorrência</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-200/50" onChange={(event) => setFilters((current) => ({ ...current, recurrence: (event.target.value || undefined) as TaskReportQuery["recurrence"] }))} value={filters.recurrence ?? ""}>
                {RECURRENCE_OPTIONS.map((option) => <option key={option.value || "todas"} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 lg:col-span-5">
              <input
                checked={unifyByProcess}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-700"
                onChange={(event) => setUnifyByProcess(event.target.checked)}
                type="checkbox"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold text-slate-800">Unificar por processo/demanda</span>
                <span className="text-xs text-slate-500">Exibe o processo uma vez e reúne suas tarefas.</span>
              </span>
            </label>
            <div className="flex flex-wrap items-end gap-3 lg:col-span-4 lg:justify-end">
              <Button onClick={resetFilters} type="button" variant="ghost"><RotateCcw className="h-4 w-4" />Restaurar padrão</Button>
              <Button type="submit"><Search className="h-4 w-4" />Gerar relatório</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result?.truncated && !loading ? (
        <div className="task-report-no-print flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Resultado acima do limite de 1.000 tarefas.</strong> Refine os filtros para imprimir um relatório completo. A impressão permanece desabilitada.</p>
        </div>
      ) : null}

      {loading ? <div className="task-report-no-print"><LoadingState description="Consultando tarefas e montando a prévia." title="Gerando relatório" /></div> : null}
      {!loading && error ? <div className="task-report-no-print"><ErrorState description={error} title="Não foi possível gerar o relatório" /></div> : null}
      {!loading && !error && result && result.items.length === 0 ? <div className="task-report-no-print"><EmptyState description="Altere os filtros para ampliar a consulta." title="Nenhuma tarefa encontrada" /></div> : null}
      {!loading && !error && result ? (
        <ReportDocument
          filters={appliedFilters}
          result={result}
          unifyByProcess={appliedUnifyByProcess}
        />
      ) : null}
    </section>
  );
}
