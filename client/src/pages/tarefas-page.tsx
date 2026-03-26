import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock3, Gavel } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { formatAppError, listDashboardTasks } from "../lib/api";
import { formatDateOnlyPtBr } from "../lib/date";
import type { DashboardTaskItem, DashboardTaskSortMode, DashboardTaskStatusFilter, OpenProcessWithoutTaskItem, TarefaRecorrenciaTipo } from "../types";

const PAGE_SIZE = 20;

const SORT_OPTIONS: Array<{ value: DashboardTaskSortMode; label: string }> = [
  { value: "prazo_asc", label: "Melhor ordem: prazo mais antigo primeiro" },
  { value: "created_desc", label: "Mais novas primeiro" },
  { value: "created_asc", label: "Mais antigas primeiro" },
];

const RECURRENCE_OPTIONS: Array<{ value: TarefaRecorrenciaTipo | "sem_recorrencia" | ""; label: string }> = [
  { value: "", label: "Todas as recorrencias" },
  { value: "sem_recorrencia", label: "Sem recorrencia" },
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "quadrimestral", label: "Quadrimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

function formatTaskRecurrence(recorrenciaTipo: TarefaRecorrenciaTipo | null) {
  if (!recorrenciaTipo) return "Sem recorrencia";
  if (recorrenciaTipo === "diaria") return "Diaria";
  if (recorrenciaTipo === "semanal") return "Semanal";
  if (recorrenciaTipo === "mensal") return "Mensal";
  if (recorrenciaTipo === "trimestral") return "Trimestral";
  if (recorrenciaTipo === "quadrimestral") return "Quadrimestral";
  if (recorrenciaTipo === "semestral") return "Semestral";
  return "Anual";
}

function formatTaskTime(task: Pick<DashboardTaskItem, "horarioInicio" | "horarioFim">) {
  if (task.horarioInicio && task.horarioFim) return `${task.horarioInicio} - ${task.horarioFim}`;
  if (task.horarioInicio) return `Inicio ${task.horarioInicio}`;
  if (task.horarioFim) return `Termino ${task.horarioFim}`;
  return null;
}

function getTaskDeadlineTone(prazoConclusao: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${prazoConclusao}T00:00:00`);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (diffDays === 0) return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
}

function TaskCard({ task }: { task: DashboardTaskItem }) {
  const timeLabel = formatTaskTime(task);

  return (
    <Link
      className="rounded-[24px] border border-slate-200 bg-white/95 px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      to={`/pre-demandas/${task.preId}`}
    >
      <div className="grid gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">{task.preNumero}</p>
          <h3 className="mt-2 text-base font-semibold text-slate-950">{task.descricao}</h3>
          <p className="mt-1 text-sm text-slate-500">{task.assunto}</p>
          {timeLabel ? (
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-sky-800">
              <Clock3 className="h-4 w-4" />
              Horario: {timeLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${getTaskDeadlineTone(task.prazoConclusao)}`}>
            Prazo {formatDateOnlyPtBr(task.prazoConclusao)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
            {formatTaskRecurrence(task.recorrenciaTipo)}
          </span>
          {task.geradaAutomaticamente ? (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700 ring-1 ring-indigo-200">
              Fluxo do assunto
            </span>
          ) : null}
          {task.hasAudiencia ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800 ring-1 ring-amber-200">
              <Gavel className="h-3.5 w-3.5" />
              Processo com audiencia
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Tipo: {task.tipo}</span>
          {task.setorDestinoSigla ? <span>Setor destino: {task.setorDestinoSigla}</span> : null}
          <span>Criada em {new Date(task.createdAt).toLocaleString("pt-BR")}</span>
          {task.concluida && task.concluidaEm ? <span>Concluida em {new Date(task.concluidaEm).toLocaleString("pt-BR")}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function ProcessTaskGroupCard({ preId, preNumero, assunto, hasAudiencia, tasks }: { preId: string; preNumero: string; assunto: string; hasAudiencia: boolean; tasks: DashboardTaskItem[] }) {
  return (
    <Link
      className="rounded-[24px] border border-slate-200 bg-white/95 px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      to={`/pre-demandas/${preId}`}
    >
      <div className="grid gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">{preNumero}</p>
            {hasAudiencia ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800 ring-1 ring-amber-200">
                <Gavel className="h-3.5 w-3.5" />
                Processo com audiencia
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
              {tasks.length} tarefa(s)
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-950">{assunto}</h3>
        </div>

        <div className="grid gap-2">
          {tasks.map((task) => {
            const timeLabel = formatTaskTime(task);
            return (
              <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{task.descricao}</p>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${getTaskDeadlineTone(task.prazoConclusao)}`}>
                    Prazo {formatDateOnlyPtBr(task.prazoConclusao)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
                    {formatTaskRecurrence(task.recorrenciaTipo)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>Tipo: {task.tipo}</span>
                  {timeLabel ? <span>Horario: {timeLabel}</span> : null}
                  {task.setorDestinoSigla ? <span>Setor destino: {task.setorDestinoSigla}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

function TaskTabPanel({
  items,
  emptyTitle,
  emptyDescription,
  unifyByProcess,
}: {
  items: DashboardTaskItem[];
  emptyTitle: string;
  emptyDescription: string;
  unifyByProcess: boolean;
}) {
  const audienciaItems = useMemo(() => items.filter((item) => item.hasAudiencia), [items]);
  const regularItems = useMemo(() => items.filter((item) => !item.hasAudiencia), [items]);
  const groupByProcess = (groupItems: DashboardTaskItem[]) => {
    const grouped = groupItems.reduce((map, item) => {
      const current = map.get(item.preId) ?? {
        preId: item.preId,
        preNumero: item.preNumero,
        assunto: item.assunto,
        hasAudiencia: item.hasAudiencia,
        tasks: [] as DashboardTaskItem[],
      };
      current.tasks.push(item);
      map.set(item.preId, current);
      return map;
    }, new Map<string, { preId: string; preNumero: string; assunto: string; hasAudiencia: boolean; tasks: DashboardTaskItem[] }>());

    return Array.from(grouped.values());
  };
  const audienciaProcessos = useMemo(() => groupByProcess(audienciaItems), [audienciaItems]);
  const regularProcessos = useMemo(() => groupByProcess(regularItems), [regularItems]);

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
            Processos com audiencia <span className="normal-case tracking-normal text-slate-400">({unifyByProcess ? audienciaProcessos.length : audienciaItems.length})</span>
          </h3>
          <p className="mt-1 text-sm text-slate-500">Tarefas ligadas a processos que possuem audiencia cadastrada.</p>
        </div>
        {unifyByProcess ? (
          audienciaProcessos.length === 0 ? (
            <EmptyState title="Sem tarefas de audiencias" description="Nenhuma tarefa de processo com audiencia neste grupo." />
          ) : (
            <div className="grid gap-3">
              {audienciaProcessos.map((processo) => (
                <ProcessTaskGroupCard key={processo.preId} {...processo} />
              ))}
            </div>
          )
        ) : (
          audienciaItems.length === 0 ? (
            <EmptyState title="Sem tarefas de audiencias" description="Nenhuma tarefa de processo com audiencia neste grupo." />
          ) : (
            <div className="grid gap-3">
              {audienciaItems.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )
        )}
      </div>

      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
            Demais processos <span className="normal-case tracking-normal text-slate-400">({unifyByProcess ? regularProcessos.length : regularItems.length})</span>
          </h3>
          <p className="mt-1 text-sm text-slate-500">Demais tarefas operacionais da fila geral.</p>
        </div>
        {unifyByProcess ? (
          regularProcessos.length === 0 ? (
            <EmptyState title="Sem outras tarefas" description="Nenhuma tarefa fora de processos com audiencia neste grupo." />
          ) : (
            <div className="grid gap-3">
              {regularProcessos.map((processo) => (
                <ProcessTaskGroupCard key={processo.preId} {...processo} />
              ))}
            </div>
          )
        ) : (
          regularItems.length === 0 ? (
            <EmptyState title="Sem outras tarefas" description="Nenhuma tarefa fora de processos com audiencia neste grupo." />
          ) : (
            <div className="grid gap-3">
              {regularItems.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function OpenProcessesWithoutTasksCard({ items, total }: { items: OpenProcessWithoutTaskItem[]; total: number }) {
  return (
    <Card className="rounded-[28px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,247,237,0.88))] shadow-[0_12px_24px_rgba(120,53,15,0.05)]">
      <CardHeader>
        <CardTitle>Processos abertos sem tarefas</CardTitle>
        <CardDescription>{total} processo(s) aberto(s) sem tarefa cadastrada.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="Sem lacunas operacionais" description="Todos os processos abertos possuem ao menos uma tarefa cadastrada." />
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <Link
                key={item.preId}
                className="rounded-[20px] border border-amber-200/70 bg-white/90 px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                to={`/pre-demandas/${item.preId}`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">{item.preNumero}</p>
                <h3 className="mt-2 text-sm font-semibold text-slate-950">{item.assunto}</h3>
                <p className="mt-2 text-xs text-slate-500">Atualizado em {new Date(item.updatedAt).toLocaleString("pt-BR")}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TarefasPage() {
  const [items, setItems] = useState<DashboardTaskItem[]>([]);
  const [openProcessesWithoutTasks, setOpenProcessesWithoutTasks] = useState<{ total: number; items: OpenProcessWithoutTaskItem[] }>({ total: 0, items: [] });
  const [currentTab, setCurrentTab] = useState<DashboardTaskStatusFilter>("pendentes");
  const [sortMode, setSortMode] = useState<DashboardTaskSortMode>("prazo_asc");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedRecurrence, setSelectedRecurrence] = useState<TarefaRecorrenciaTipo | "sem_recorrencia" | "">("");
  const [openWithoutTasksQ, setOpenWithoutTasksQ] = useState("");
  const [unifyByProcess, setUnifyByProcess] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pendentes: 0, concluidas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    void (async () => {
      try {
        const next = await listDashboardTasks({
          status: currentTab,
          sort: sortMode,
          date: selectedDate || undefined,
          recurrence: selectedRecurrence || undefined,
          openWithoutTasksQ: openWithoutTasksQ || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        if (mounted) {
          setItems(next.items);
          setTotal(next.total);
          setCounts(next.counts);
          setOpenProcessesWithoutTasks(next.openProcessesWithoutTasks);
          setError("");
        }
      } catch (nextError) {
        if (mounted) {
          setError(formatAppError(nextError, "Falha ao carregar tarefas."));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentTab, openWithoutTasksQ, page, selectedDate, selectedRecurrence, sortMode]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [currentTab, selectedDate, selectedRecurrence, sortMode]);

  if (loading) {
    return <LoadingState description="Carregando tarefas pendentes e concluidas." title="Tarefas" />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }} transition={{ duration: 0.35, ease: "easeOut" }}>
        <PageHeader eyebrow="Operacional" title="Tarefas" description="Painel dedicado para consultar tarefas pendentes e concluidas de todos os processos." />
      </motion.div>

      <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 14 }} transition={{ duration: 0.4, delay: 0.06, ease: "easeOut" }}>
        <Card className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(240,246,249,0.88))] shadow-[0_12px_24px_rgba(20,33,61,0.05)]">
          <CardHeader className="gap-4">
            <div>
              <CardTitle>Fila geral de tarefas</CardTitle>
              <CardDescription>{counts.pendentes} pendente(s) e {counts.concluidas} concluida(s).</CardDescription>
            </div>
            <div className="grid gap-2 sm:max-w-sm">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="task-sort-mode">
                Visualizacao
              </label>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200/50"
                id="task-sort-mode"
                onChange={(event) => setSortMode(event.target.value as DashboardTaskSortMode)}
                value={sortMode}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:max-w-xs">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Agrupamento</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                <input checked={unifyByProcess} className="h-4 w-4 rounded border-slate-300" onChange={(event) => setUnifyByProcess(event.target.checked)} type="checkbox" />
                Unificar tarefas por processo
              </label>
            </div>
            <div className="grid gap-2 sm:max-w-xs">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="task-recurrence-filter">
                Recorrencia
              </label>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200/50"
                id="task-recurrence-filter"
                onChange={(event) => {
                  setSelectedRecurrence(event.target.value as TarefaRecorrenciaTipo | "sem_recorrencia" | "");
                  setPage(1);
                }}
                value={selectedRecurrence}
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:max-w-xs">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="task-date-filter">
                Data da tarefa
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="task-date-filter"
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setPage(1);
                  }}
                  type="date"
                  value={selectedDate}
                />
                {selectedDate ? (
                  <button
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                    onClick={() => {
                      setSelectedDate("");
                      setPage(1);
                    }}
                    type="button"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs onValueChange={(value) => setCurrentTab(value as DashboardTaskStatusFilter)} value={currentTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
                <TabsTrigger value="concluidas">Concluidas</TabsTrigger>
              </TabsList>
              <TabsContent value="pendentes">
                <TaskTabPanel
                  emptyDescription="Nenhuma tarefa pendente encontrada."
                  emptyTitle="Sem pendencias"
                  items={currentTab === "pendentes" ? items : []}
                  unifyByProcess={unifyByProcess}
                />
              </TabsContent>
              <TabsContent value="concluidas">
                <TaskTabPanel
                  emptyDescription="Nenhuma tarefa concluida encontrada."
                  emptyTitle="Sem concluidas"
                  items={currentTab === "concluidas" ? items : []}
                  unifyByProcess={unifyByProcess}
                />
              </TabsContent>
            </Tabs>
            <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Pagina {page} de {totalPages} • {total} item(ns) nesta aba
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Anterior
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  type="button"
                >
                  Proxima
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}>
        <div className="mb-3 grid gap-2 sm:max-w-md">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="open-without-tasks-filter">
            Filtrar processos abertos sem tarefas
          </label>
          <Input
            id="open-without-tasks-filter"
            onChange={(event) => setOpenWithoutTasksQ(event.target.value)}
            placeholder="Buscar por numero, SEI, numero judicial ou assunto"
            value={openWithoutTasksQ}
          />
        </div>
        <OpenProcessesWithoutTasksCard items={openProcessesWithoutTasks.items} total={openProcessesWithoutTasks.total} />
      </motion.div>
    </section>
  );
}
