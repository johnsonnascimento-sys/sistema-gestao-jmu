import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { formatAppError, listDashboardTasks } from "../lib/api";
import { formatDateOnlyPtBr } from "../lib/date";
import type { DashboardTaskItem, TarefaRecorrenciaTipo } from "../types";

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

function TaskList({ items, emptyTitle, emptyDescription }: { items: DashboardTaskItem[]; emptyTitle: string; emptyDescription: string }) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-3">
      {items.map((task) => (
        <Link
          className="rounded-[24px] border border-slate-200 bg-white/95 px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          key={task.id}
          to={`/pre-demandas/${task.preId}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">{task.preNumero}</p>
              <h3 className="mt-2 text-base font-semibold text-slate-950">{task.descricao}</h3>
              <p className="mt-1 text-sm text-slate-500">{task.assunto}</p>
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
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Tipo: {task.tipo}</span>
            {formatTaskTime(task) ? <span>Horario: {formatTaskTime(task)}</span> : null}
            {task.setorDestinoSigla ? <span>Setor destino: {task.setorDestinoSigla}</span> : null}
            <span>Criada em {new Date(task.createdAt).toLocaleString("pt-BR")}</span>
            {task.concluida && task.concluidaEm ? <span>Concluida em {new Date(task.concluidaEm).toLocaleString("pt-BR")}</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function TarefasPage() {
  const [items, setItems] = useState<DashboardTaskItem[]>([]);
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

  const pending = useMemo(() => items.filter((item) => !item.concluida), [items]);
  const completed = useMemo(() => items.filter((item) => item.concluida), [items]);

  if (loading) {
    return <LoadingState title="Tarefas" description="Carregando tarefas pendentes e concluidas." />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
        <PageHeader eyebrow="Operacional" title="Tarefas" description="Painel dedicado para consultar tarefas pendentes e concluidas de todos os processos." />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06, ease: "easeOut" }}>
        <Card className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(240,246,249,0.88))] shadow-[0_12px_24px_rgba(20,33,61,0.05)]">
          <CardHeader>
            <CardTitle>Fila geral de tarefas</CardTitle>
            <CardDescription>{pending.length} pendente(s) e {completed.length} concluida(s).</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pendentes">
              <TabsList className="mb-4">
                <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
                <TabsTrigger value="concluidas">Concluidas</TabsTrigger>
              </TabsList>
              <TabsContent value="pendentes">
                <TaskList items={pending} emptyTitle="Sem pendencias" emptyDescription="Nenhuma tarefa pendente encontrada." />
              </TabsContent>
              <TabsContent value="concluidas">
                <TaskList items={completed} emptyTitle="Sem concluidas" emptyDescription="Nenhuma tarefa concluida encontrada." />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
