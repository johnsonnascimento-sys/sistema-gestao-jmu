import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { formatAppError, getDashboardSummary } from "../lib/api";
import { formatDateOnlyPtBr, formatDateTimePtBr } from "../lib/date";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda, PreDemandaDashboardSummary, TarefaRecorrenciaTipo } from "../types";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { motion } from "framer-motion";

function buildAnalyticalTableHref(overrides: Record<string, string>) {
  const search = new URLSearchParams({ view: "table", page: "1", ...overrides });
  return `/pre-demandas?${search.toString()}`;
}

function buildOldestOpenTasksHref() {
  return buildAnalyticalTableHref({
    status: "em_andamento",
    sortBy: "proximoPrazoTarefa",
    sortOrder: "asc",
    pageSize: "20",
  });
}

function formatStructuredDeadlines(item: PreDemanda) {
  const isClosed = item.status === "encerrada";
  return [
    `Prazo do processo: ${isClosed ? "-" : formatDateOnlyPtBr(item.prazoProcesso)}`,
    `Proxima tarefa: ${isClosed ? "-" : formatDateOnlyPtBr(item.proximoPrazoTarefa, "sem tarefas pendentes")}`,
  ].join(" | ");
}

function formatTaskRecurrence(recorrenciaTipo: TarefaRecorrenciaTipo | null) {
  if (!recorrenciaTipo) {
    return "Sem recorrência";
  }

  if (recorrenciaTipo === "diaria") return "Diária";
  if (recorrenciaTipo === "semanal") return "Semanal";
  if (recorrenciaTipo === "mensal") return "Mensal";
  if (recorrenciaTipo === "trimestral") return "Trimestral";
  if (recorrenciaTipo === "quadrimestral") return "Quadrimestral";
  if (recorrenciaTipo === "semestral") return "Semestral";
  return "Anual";
}

function formatAudienciaSituacao(situacao: string) {
  if (situacao === "designada") return "Designada";
  if (situacao === "convertida_diligencia") return "Convertida em diligência";
  if (situacao === "nao_realizada") return "Não realizada";
  if (situacao === "realizada") return "Realizada";
  if (situacao === "cancelada") return "Cancelada";
  return situacao;
}

function getTaskDeadlineState(prazoConclusao: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${prazoConclusao}T00:00:00`);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return {
      label: `Atrasada há ${Math.abs(diffDays)}d`,
      containerClass:
        "border-rose-200/90 bg-gradient-to-br from-rose-50/95 to-white/90 shadow-rose-100/60",
      markerClass: "bg-rose-500",
      labelClass: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
      dateClass: "bg-white text-rose-700 ring-1 ring-rose-200",
      titleClass: "text-rose-950",
      subtitleClass: "text-rose-700",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Vence hoje",
      containerClass:
        "border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-white/90 shadow-amber-100/50",
      markerClass: "bg-amber-500",
      labelClass: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
      dateClass: "bg-white text-amber-800 ring-1 ring-amber-200",
      titleClass: "text-amber-950",
      subtitleClass: "text-amber-700",
    };
  }

  return {
    label: `Vence em ${diffDays}d`,
    containerClass: "border-white/80 bg-gradient-to-br from-white/95 to-slate-50/80 shadow-md",
    markerClass: "bg-sky-500",
    labelClass: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    dateClass: "bg-white text-slate-600 ring-1 ring-slate-200",
    titleClass: "text-slate-950",
    subtitleClass: "text-slate-600",
  };
}

export function DashboardPage() {
  const [summary, setSummary] = useState<PreDemandaDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setSummary(await getDashboardSummary());
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar dashboard."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      void loadDashboard();
    };

    window.addEventListener("pre-demanda-updated", handleUpdate);
    return () => {
      window.removeEventListener("pre-demanda-updated", handleUpdate);
    };
  }, []);

  if (loading) {
    return (
      <section className="grid gap-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-start">
          <div className="grid gap-3">
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-10 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
        
        <div className="flex gap-2 -mt-2">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[24px]" />
          ))}
        </div>

        <Skeleton className="h-[200px] w-full rounded-[32px]" />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[600px] rounded-[32px]" />
          <Skeleton className="h-[600px] rounded-[32px]" />
        </div>
      </section>
    );
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  if (!summary) {
    return <ErrorState description="Resumo operacional indisponível." />;
  }

  const staleItems = summary.staleItems;
  const upcomingAudiencias = summary.upcomingAudiencias ?? [];
  const statusMetricHref: Record<string, string> = {
    em_andamento: buildAnalyticalTableHref({ status: "em_andamento" }),
    aguardando_sei: buildAnalyticalTableHref({ status: "aguardando_sei" }),
    encerrada: buildAnalyticalTableHref({ status: "encerrada" }),
  };

  function formatPrazo(item: PreDemanda) {
    if (!item.prazoProcesso) {
      return "Sem prazo definido";
    }

    const dueDate = new Date(`${item.prazoProcesso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) {
      return `Prazo vencido há ${Math.abs(diffDays)}d`;
    }

    if (diffDays === 0) {
      return "Prazo vence hoje";
    }

    return `Prazo em ${diffDays}d`;
  }

  function renderQueueItem(item: PreDemanda, highlightType?: "urgent" | "payment") {
    const queueHealth = getQueueHealth(item);
    
    let borderStyle = "border-white/80 bg-gradient-to-br from-white/95 to-slate-50/80 backdrop-blur-lg shadow-md hover:shadow-xl hover:-translate-y-1";
    let titleColor = "text-sky-600";
    
    if (highlightType === "urgent") {
      borderStyle = "border-rose-200/80 bg-gradient-to-br from-rose-50/95 to-white/80 backdrop-blur-lg shadow-rose-100/50 shadow-md hover:shadow-xl hover:-translate-y-1";
      titleColor = "text-rose-600";
    } else if (highlightType === "payment") {
      borderStyle = "border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-white/80 backdrop-blur-lg shadow-amber-100/50 shadow-md hover:shadow-xl hover:-translate-y-1";
      titleColor = "text-amber-600";
    }

    return (
      <Link
        className={`relative grid gap-2 rounded-[24px] border px-5 py-4 transition-all duration-300 ${borderStyle}`}
        key={item.preId}
        to={`/pre-demandas/${item.preId}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.24em] ${titleColor}`}>{item.principalNumero}</p>
            <h3 className="mt-2 text-base font-semibold text-slate-950">{item.assunto}</h3>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {item.metadata.urgente ? <span className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">Urgente</span> : null}
            {item.metadata.pagamentoEnvolvido ? <span className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">Pagamento</span> : null}
            <StatusPill status={item.status} />
            {highlightType !== "urgent" && highlightType !== "payment" && <QueueHealthPill item={item} />}
          </div>
        </div>
        <div className="grid gap-1 text-sm text-slate-500">
          <p>{item.pessoaPrincipal?.nome ?? "-"}</p>
          <p>Setor: {item.setorAtual ? item.setorAtual.sigla : "Não tramitado"}</p>
          {highlightType !== "urgent" && highlightType !== "payment" && <p>Pessoa: {item.interessados.length}</p>}
          <p>{formatPrazo(item)}</p>
          <p>{formatStructuredDeadlines(item)}</p>
          <p>Referência: {formatDateOnlyPtBr(item.dataReferencia)}</p>
          {highlightType !== "urgent" && highlightType !== "payment" && (
            <>
              <p>Atualizado: {new Date(item.updatedAt).toLocaleString("pt-BR")}</p>
              <p className="font-medium text-slate-700">{queueHealth.detail}</p>
            </>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="grid gap-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <PageHeader
          actions={
            <div className="flex gap-2">
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=fila-operacional">Fila Operacional</Link>
              </Button>
              <Button asChild>
                <Link to="/pre-demandas/nova">Novo processo</Link>
              </Button>
            </div>
          }
          description="Visão operacional diária. Acompanhe gargalos, priorize urgências e acompanhe movimentos recentes."
          eyebrow="Visão geral"
          title="Dashboard do Gestor"
        />
      </motion.div>

      <motion.div 
        className="flex flex-wrap gap-2 -mt-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      >
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=aguardando-sei">Aguardando SEI</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=fila-parada">Fila Parada</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=em-risco">Em risco</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white text-rose-600 border-rose-200"><Link to="/pre-demandas?preset=prazos-vencidos">Prazos Vencidos</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=ultimas-encerradas">Últimos Encerrados</Link></Button>
        <Button asChild variant="ghost" size="sm" className="h-8"><Link to="/pre-demandas">Acessar Busca Avançada &rarr;</Link></Button>
      </motion.div>

      <motion.div 
        className="grid gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      >
        {summary.counts.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} to={statusMetricHref[item.status]} value={item.total} />
        ))}
        <MetricCard label="Paradas 2d+" to={buildAnalyticalTableHref({ queueHealth: "attention,critical", sortBy: "updatedAt", sortOrder: "asc" })} value={summary.agingAttentionTotal + summary.agingCriticalTotal} />
        <MetricCard label="Em risco 5d+" to={buildAnalyticalTableHref({ preset: "em-risco" })} value={summary.agingCriticalTotal} />
        <MetricCard label="Vence hoje" to={buildAnalyticalTableHref({ preset: "vence-hoje" })} value={summary.dueTodayTotal} />
        <MetricCard label="Prazos na semana" to={buildAnalyticalTableHref({ preset: "vencem-na-semana" })} value={summary.deadlines.processo.dueSoonTotal} />
        <MetricCard label="Sem setor" to={buildAnalyticalTableHref({ preset: "sem-setor" })} value={summary.withoutSetorTotal} />
        <MetricCard label="Sem envolvidos" to={buildAnalyticalTableHref({ preset: "sem-envolvidos" })} value={summary.withoutInteressadosTotal} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
      >
        <Card className="border-white/60 bg-white/50 backdrop-blur-xl shadow-xl rounded-[32px] overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-light tracking-tight text-slate-800">Radar de Prazos</CardTitle>
            <CardDescription className="text-slate-500">Prazos do processo, tarefas e consumo do tempo geral.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-3">
          {[
            { id: "processo", label: "Prazo do processo", campo: "prazoProcesso", secondary: null },
            { id: "tarefas", label: "Processos com tarefa pendente", campo: "proximoPrazoTarefa", secondary: "processesWithPendingTasks" },
            { id: "prazo", label: "Situacao do prazo", campo: "prazoProcesso", secondary: "binary" },
          ].map((item) => {
            if (item.id === "prazo") {
              const atrasados = summary.deadlines.processo?.overdueTotal ?? 0;
              const noPrazo = Math.max((summary.deadlines.processo?.totalDefined ?? 0) - atrasados, 0);
              const data = [
                { name: "Atrasado", value: atrasados, color: "#f43f5e" },
                { name: "No prazo", value: noPrazo, color: "#0ea5e9" },
              ].filter((entry) => entry.value > 0);
              
              const total = atrasados + noPrazo;

              return (
                <article className="group relative grid grid-cols-[1fr_100px] gap-3 items-center overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/90 to-slate-50/80 px-5 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" key={item.id}>
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                      <h3 className="mt-2 text-3xl font-light tracking-tight text-slate-900">{atrasados}</h3>
                      <p className="text-sm font-medium text-slate-400">processos atrasados</p>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs font-medium text-slate-600">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div>Atrasado: {atrasados}</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-500"></div>No prazo: {noPrazo}</div>
                    </div>
                  </div>
                  <div className="relative z-10 flex h-[100px] w-[100px] items-center justify-center">
                    {total > 0 ? (
                      <PieChart height={100} width={100}>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2} dataKey="value" stroke="none">
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} itemStyle={{ color: '#334155' }} />
                      </PieChart>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-full border border-dashed border-slate-300">
                        <span className="text-[10px] font-medium text-slate-400">Zeradão!</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            }
            const metrics = summary.deadlines[item.id as "processo" | "tarefas"];
            const data = [
              { name: 'Vencidos', value: metrics.overdueTotal, color: '#f43f5e' },
              { name: 'Vence hoje', value: metrics.dueTodayTotal, color: '#f59e0b' },
              { name: 'Na semana', value: metrics.dueSoonTotal, color: '#0ea5e9' }
            ].filter(d => d.value > 0);

            const total = metrics.overdueTotal + metrics.dueTodayTotal + metrics.dueSoonTotal;

            return (
              <article className="group relative grid grid-cols-[1fr_100px] gap-3 items-center overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/90 to-slate-50/80 px-5 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" key={item.id}>
                <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                    <h3 className="mt-2 text-3xl font-light tracking-tight text-slate-900">
                      {"processesWithPendingTasks" in metrics ? metrics.processesWithPendingTasks : metrics.totalDefined}
                    </h3>
                    <p className="text-xs font-medium text-slate-400">{"processesWithPendingTasks" in metrics ? "processos com tarefas abertas" : "processos com prazo"}</p>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs font-medium text-slate-600">
                    <Link className="flex w-fit items-center gap-2 hover:text-rose-600 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "overdue" })}><div className="w-2 h-2 rounded-full bg-rose-500"></div>Vencidos: {metrics.overdueTotal}</Link>
                    <Link className="flex w-fit items-center gap-2 hover:text-amber-600 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "today" })}><div className="w-2 h-2 rounded-full bg-amber-500"></div>Vence hoje: {metrics.dueTodayTotal}</Link>
                    <Link className="flex w-fit items-center gap-2 hover:text-sky-600 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "soon" })}><div className="w-2 h-2 rounded-full bg-sky-500"></div>Na semana: {metrics.dueSoonTotal}</Link>
                  </div>
                </div>
                <div className="relative z-10 flex h-[100px] w-[100px] items-center justify-center">
                  {total > 0 ? (
                    <PieChart height={100} width={100}>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2} dataKey="value" stroke="none">
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} itemStyle={{ color: '#334155' }} />
                    </PieChart>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-full border border-dashed border-slate-300">
                      <span className="text-[10px] font-medium text-slate-400">Tranquilo!</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        id="audiencias-designadas"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
      >
        <Card className="overflow-hidden rounded-[32px] border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white/90 to-amber-100/60 shadow-xl">
          <CardHeader className="gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1">
              <CardTitle className="text-xl font-light tracking-tight text-amber-950">Pauta de audiências</CardTitle>
              <CardDescription className="text-amber-800/80">Processos com audiência permanecem aqui até o processo ser concluído, independentemente do status do ato.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center rounded-full bg-amber-100 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800 ring-1 ring-amber-200">
                {upcomingAudiencias.length} {upcomingAudiencias.length === 1 ? "audiência" : "audiências"}
              </span>
              <Button asChild size="sm" variant="outline" className="h-8 rounded-full border-amber-200 bg-white shadow-sm">
                <Link to="/pauta-audiencias">Ver pauta</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid max-h-[720px] gap-3 overflow-y-auto pr-2">
            {upcomingAudiencias.length === 0 ? (
              <EmptyState
                title="Sem audiências na pauta"
                description="Nenhum processo ativo com audiência cadastrada está na pauta neste momento."
              />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {upcomingAudiencias.map((audiencia) => (
                  <article
                    key={audiencia.id}
                    className="group relative grid gap-3 overflow-hidden rounded-[24px] border border-amber-200/80 bg-white/90 px-5 py-4 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-orange-400" />
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">{audiencia.preNumero}</p>
                        <h3 className="mt-2 break-words text-base font-semibold leading-snug text-slate-950">{audiencia.assunto}</h3>
                        <p className="mt-2 text-sm text-slate-600">{formatDateTimePtBr(audiencia.dataHoraInicio)}</p>
                        {audiencia.magistradoNome ? <p className="mt-1 text-sm text-slate-500">Magistrado: {audiencia.magistradoNome}</p> : null}
                      </div>
                      <div className="grid shrink-0 gap-2 justify-items-start md:justify-items-end">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800 ring-1 ring-amber-200">
                          {formatAudienciaSituacao(audiencia.situacao)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200">
                          Início: {formatDateTimePtBr(audiencia.dataHoraInicio)}
                        </span>
                      </div>
                    </div>
                    {audiencia.observacoes ?? audiencia.descricao ? <p className="text-sm leading-6 text-slate-500">{audiencia.observacoes ?? audiencia.descricao}</p> : null}
                    {audiencia.dataHoraFim ? <p className="text-sm font-medium text-slate-700">Término previsto: {formatDateTimePtBr(audiencia.dataHoraFim)}</p> : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Abrir processo para detalhes da audiência</p>
                      <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-amber-200 bg-white shadow-sm">
                        <Link to={`/pre-demandas/${audiencia.preId}`}>Ver processo</Link>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div 
        className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
      >
        <Card className="h-fit rounded-[32px] overflow-hidden border-white/60 bg-white/50 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-light tracking-tight text-slate-800">Filas de Ação Imediata</CardTitle>
            <CardDescription className="text-slate-500">Filas de trabalho prioritárias para desafogar a operação.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="urgentes" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-2 p-4 justify-start bg-transparent">
                <TabsTrigger value="urgentes" className="group flex items-center gap-2 rounded-full px-4 py-2 border border-slate-200/60 bg-white shadow-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:border-transparent data-[state=active]:shadow-md hover:bg-slate-50 transition-all duration-200">
                  <span>Urgentes</span>
                  <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{summary.urgentItems.length}</span>
                </TabsTrigger>
                <TabsTrigger value="pagamento" className="group flex items-center gap-2 rounded-full px-4 py-2 border border-slate-200/60 bg-white shadow-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:border-transparent data-[state=active]:shadow-md hover:bg-slate-50 transition-all duration-200">
                  <span>Pagamento</span>
                  <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{summary.paymentMarkedItems.length}</span>
                </TabsTrigger>
                <TabsTrigger value="aguardando_sei" className="group flex items-center gap-2 rounded-full px-4 py-2 border border-slate-200/60 bg-white shadow-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:border-transparent data-[state=active]:shadow-md hover:bg-slate-50 transition-all duration-200">
                  <span>Aguardando SEI</span>
                  <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{summary.awaitingSeiItems.length}</span>
                </TabsTrigger>
                <TabsTrigger value="parados" className="group flex items-center gap-2 rounded-full px-4 py-2 border border-slate-200/60 bg-white shadow-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:border-transparent data-[state=active]:shadow-md hover:bg-slate-50 transition-all duration-200">
                  <span>Parados</span>
                  <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{staleItems.length}</span>
                </TabsTrigger>
                <TabsTrigger value="pendencias" className="group flex items-center gap-2 rounded-full px-4 py-2 border border-slate-200/60 bg-white shadow-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:border-transparent data-[state=active]:shadow-md hover:bg-slate-50 transition-all duration-200">
                  <span>Pendências</span>
                  <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{summary.dueSoonItems.length + summary.withoutSetorItems.length + summary.withoutInteressadosItems.length}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="urgentes" className="grid gap-3">
                {summary.urgentItems.length === 0 ? (
                  <div className="py-8"><EmptyState description="Nenhum processo marcado como urgente para tratamento imediato." title="Zero Urgências" /></div>
                ) : (
                  summary.urgentItems.map((item) => renderQueueItem(item, "urgent"))
                )}
              </TabsContent>

              <TabsContent value="pagamento" className="grid gap-3">
                {summary.paymentMarkedItems.length === 0 ? (
                  <div className="py-8"><EmptyState description="Nenhum processo assinalado com impacto de pagamento." title="Limpo" /></div>
                ) : (
                  summary.paymentMarkedItems.map((item) => renderQueueItem(item, "payment"))
                )}
              </TabsContent>

              <TabsContent value="aguardando_sei" className="grid gap-3">
                {summary.awaitingSeiItems.length === 0 ? (
                  <div className="py-8"><EmptyState description="Nenhuma demanda aguardando abertura de processo SEI para seguir." title="Fila Limpa" /></div>
                ) : (
                  summary.awaitingSeiItems.map((item) => renderQueueItem(item))
                )}
              </TabsContent>

              <TabsContent value="parados" className="grid gap-3">
                {staleItems.length === 0 ? (
                  <div className="py-8"><EmptyState description="Tudo fluindo regularmente. Fila pedindo andamento está zerada." title="Fluxo Contínuo" /></div>
                ) : (
                  staleItems.map((item) => renderQueueItem(item))
                )}
              </TabsContent>

              <TabsContent value="pendencias" className="grid gap-6">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3 text-slate-800">
                    <p className="text-sm font-semibold">Prazos na semana ({summary.dueSoonItems.length})</p>
                    <Link className="text-sm font-medium hover:underline text-blue-600" to="/pre-demandas?preset=vencem-na-semana">Ver todos</Link>
                  </div>
                  {summary.dueSoonItems.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhum prazo iminente registrado.</p>
                  ) : (
                    summary.dueSoonItems.slice(0, 3).map((item) => renderQueueItem(item))
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3 text-slate-800">
                    <p className="text-sm font-semibold">Sem setor atual ({summary.withoutSetorItems.length})</p>
                    <Link className="text-sm font-medium hover:underline text-blue-600" to="/pre-demandas?preset=sem-setor">Ver todos</Link>
                  </div>
                  {summary.withoutSetorItems.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Todos os processos ativos já possuem setor.</p>
                  ) : (
                    summary.withoutSetorItems.slice(0, 3).map((item) => renderQueueItem(item))
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3 text-slate-800">
                    <p className="text-sm font-semibold">Sem envolvidos ({summary.withoutInteressadosItems.length})</p>
                    <Link className="text-sm font-medium hover:underline text-blue-600" to="/pre-demandas?preset=sem-envolvidos">Ver todos</Link>
                  </div>
                  {summary.withoutInteressadosItems.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Os processos ativos já possuem envolvidos vinculados.</p>
                  ) : (
                    summary.withoutInteressadosItems.slice(0, 3).map((item) => renderQueueItem(item))
                  )}
                </div>
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>

        <Card className="flex h-[800px] flex-col rounded-[32px] overflow-hidden border-white/60 bg-white/50 backdrop-blur-xl shadow-xl">
          <CardHeader className="shrink-0 gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1">
              <CardTitle className="text-xl font-light tracking-tight text-slate-800">Tarefas abertas mais antigas</CardTitle>
              <CardDescription className="text-slate-500">Ordenadas pelo prazo de conclusão mais antigo.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-full border-slate-200 bg-white shadow-sm">
              <Link to={buildOldestOpenTasksHref()}>Ver mais</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 overflow-y-auto pr-2 pb-6">
            {summary.oldestOpenTasks.length === 0 ? (
              <EmptyState description="Nenhuma tarefa aberta para exibir." title="Fila limpa" />
            ) : (
              summary.oldestOpenTasks.map((task) => {
                const deadlineState = getTaskDeadlineState(task.prazoConclusao);

                return (
                <Link
                  className={`group relative flex flex-col gap-3 overflow-hidden rounded-[24px] border px-5 py-4 shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl shrink-0 ${deadlineState.containerClass}`}
                  key={task.id}
                  to={`/pre-demandas/${task.preId}`}
                >
                  <div className={`absolute inset-y-0 left-0 w-1 ${deadlineState.markerClass}`} />
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-600">{task.preNumero}</p>
                      <h3 className={`mt-2 break-words text-base font-semibold leading-snug ${deadlineState.titleClass}`}>{task.descricao}</h3>
                    </div>
                    <div className="grid shrink-0 gap-2 justify-items-start md:justify-items-end">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineState.labelClass}`}>
                        {deadlineState.label}
                      </span>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-200">
                        {formatTaskRecurrence(task.recorrenciaTipo)}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineState.dateClass}`}>
                        {formatDateOnlyPtBr(task.prazoConclusao)}
                      </span>
                    </div>
                  </div>
                  <div className={`grid gap-1 text-sm ${deadlineState.subtitleClass}`}>
                    <p>{task.assunto}</p>
                    <p>{task.setorDestinoSigla ? `Setor destino: ${task.setorDestinoSigla}` : "Sem setor destino"}</p>
                    <p className="font-medium text-slate-700">Aberta desde {new Date(task.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}


