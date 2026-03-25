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
import type { DashboardTaskItem, TarefaRecorrenciaTipo } from "../types";

type TaskSortMode = "prazo_asc" | "created_desc" | "created_asc";

const SORT_OPTIONS: Array<{ value: TaskSortMode; label: string }> = [
  { value: "prazo_asc", label: "Melhor ordem: prazo mais antigo primeiro" },
  { value: "created_desc", label: "Mais novas primeiro" },
  { value: "created_asc", label: "Mais antigas primeiro" },
];

function formatTaskRecurrence(recorrenciaTipo: TarefaRecorrenciaTipo | null) {
  if (!recorrenciaTipo) return "Sem recorrencia";
  if (recorrenciaTipo === "diaria") return "Diaria";
  if (recorrenciaTipo === "semanal") return "Semanal";
  return "Mensal";
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

function sortTasks(items: DashboardTaskItem[], mode: TaskSortMode) {
  const copy = [...items];
  copy.sort((left, right) => {
    if (mode === "created_desc") {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (mode === "created_asc") {
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    }

    const dueDiff = new Date(`${left.prazoConclusao}T00:00:00`).getTime() - new Date(`${right.prazoConclusao}T00:00:00`).getTime();
    if (dueDiff !== 0) return dueDiff;
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
  return copy;
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

function TaskGroup({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  items: DashboardTaskItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="grid gap-3">
          {items.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskTabPanel({
  items,
  sortMode,
  emptyTitle,
  emptyDescription,
}: {
  items: DashboardTaskItem[];
  sortMode: TaskSortMode;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const sortedItems = useMemo(() => sortTasks(items, sortMode), [items, sortMode]);
  const audienciaItems = useMemo(() => sortedItems.filter((item) => item.hasAudiencia), [sortedItems]);
  const regularItems = useMemo(() => sortedItems.filter((item) => !item.hasAudiencia), [sortedItems]);

  if (sortedItems.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-6">
      <TaskGroup
        description="Tarefas ligadas a processos que possuem audiencia cadastrada."
        emptyDescription="Nenhuma tarefa de processo com audiencia neste grupo."
        emptyTitle="Sem tarefas de audiencias"
        items={audienciaItems}
        title="Processos com audiencia"
      />
      <TaskGroup
        description="Demais tarefas operacionais da fila geral."
        emptyDescription="Nenhuma tarefa fora de processos com audiencia neste grupo."
        emptyTitle="Sem outras tarefas"
        items={regularItems}
        title="Demais processos"
      />
    </div>
  );
}

export function TarefasPage() {
  const [items, setItems] = useState<DashboardTaskItem[]>([]);
  const [sortMode, setSortMode] = useState<TaskSortMode>("prazo_asc");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const next = await listDashboardTasks();
        if (mounted) {
          setItems(next);
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
  }, []);

  const filteredItems = useMemo(
    () => items.filter((item) => !selectedDate || item.prazoConclusao === selectedDate),
    [items, selectedDate],
  );
  const pending = useMemo(() => filteredItems.filter((item) => !item.concluida), [filteredItems]);
  const completed = useMemo(() => filteredItems.filter((item) => item.concluida), [filteredItems]);

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
              <CardDescription>{pending.length} pendente(s) e {completed.length} concluida(s).</CardDescription>
            </div>
            <div className="grid gap-2 sm:max-w-sm">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="task-sort-mode">
                Visualizacao
              </label>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200/50"
                id="task-sort-mode"
                onChange={(event) => setSortMode(event.target.value as TaskSortMode)}
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
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="task-date-filter">
                Data da tarefa
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="task-date-filter"
                  onChange={(event) => setSelectedDate(event.target.value)}
                  type="date"
                  value={selectedDate}
                />
                {selectedDate ? (
                  <button
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                    onClick={() => setSelectedDate("")}
                    type="button"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pendentes">
              <TabsList className="mb-4">
                <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
                <TabsTrigger value="concluidas">Concluidas</TabsTrigger>
              </TabsList>
              <TabsContent value="pendentes">
                <TaskTabPanel
                  emptyDescription="Nenhuma tarefa pendente encontrada."
                  emptyTitle="Sem pendencias"
                  items={pending}
                  sortMode={sortMode}
                />
              </TabsContent>
              <TabsContent value="concluidas">
                <TaskTabPanel
                  emptyDescription="Nenhuma tarefa concluida encontrada."
                  emptyTitle="Sem concluidas"
                  items={completed}
                  sortMode={sortMode}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
