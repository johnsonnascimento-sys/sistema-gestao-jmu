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
import { formatDateOnlyPtBr } from "../lib/date";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda, PreDemandaDashboardSummary, TimelineEvent } from "../types";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

function buildAnalyticalTableHref(overrides: Record<string, string>) {
  const search = new URLSearchParams({ view: "table", page: "1", ...overrides });
  return `/pre-demandas?${search.toString()}`;
}

function formatStructuredDeadlines(item: PreDemanda) {
  const isClosed = item.status === "encerrada";
  return [
    `Prazo do processo: ${isClosed ? "-" : formatDateOnlyPtBr(item.prazoProcesso)}`,
    `Proxima tarefa: ${isClosed ? "-" : formatDateOnlyPtBr(item.proximoPrazoTarefa, "sem tarefas pendentes")}`,
  ].join(" | ");
}

export function DashboardPage() {
  const [summary, setSummary] = useState<PreDemandaDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function describeEvent(event: TimelineEvent) {
    switch (event.type) {
      case "created":
        return "Novo processo registrado.";
      case "status_changed":
        return `Status alterado para ${event.statusNovo?.replace("_", " ") ?? "-"}.`;
      case "sei_linked":
        return `SEI ${event.seiNumeroNovo ?? "-"} associado.`;
      case "sei_reassociated":
        return `SEI corrigido para ${event.seiNumeroNovo ?? "-"}.`;
      default:
        return "MovimentaÃ§Ã£o operacional registrada.";
    }
  }

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
    return <ErrorState description="Resumo operacional indisponÃ­vel." />;
  }

  const staleItems = summary.staleItems;
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
      return `Prazo vencido hÃ¡ ${Math.abs(diffDays)}d`;
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
          <p>Setor: {item.setorAtual ? item.setorAtual.sigla : "NÃ£o tramitado"}</p>
          {highlightType !== "urgent" && highlightType !== "payment" && <p>Pessoa: {item.interessados.length}</p>}
          <p>{formatPrazo(item)}</p>
          <p>{formatStructuredDeadlines(item)}</p>
          <p>ReferÃªncia: {formatDateOnlyPtBr(item.dataReferencia)}</p>
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
          description="VisÃ£o operacional diÃ¡ria. Acompanhe gargalos, priorize urgÃªncias e acompanhe movimentos recentes."
          eyebrow="VisÃ£o geral"
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
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=ultimas-encerradas">Ãšltimos Encerrados</Link></Button>
        <Button asChild variant="ghost" size="sm" className="h-8"><Link to="/pre-demandas">Acessar Busca AvanÃ§ada &rarr;</Link></Button>
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
            { id: "tarefas", label: "Prazos das tarefas", campo: "proximoPrazoTarefa", secondary: "totalPending" },
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
                  <div className="relative z-10 h-[100px] w-[100px]">
                    {total > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2} dataKey="value" stroke="none">
                            {data.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} itemStyle={{ color: '#334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
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
                      {"totalPending" in metrics ? metrics.totalPending : metrics.totalDefined}
                    </h3>
                    <p className="text-xs font-medium text-slate-400">{"totalPending" in metrics ? "tarefas pendentes" : "processos com prazo"}</p>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs font-medium text-slate-600">
                    <Link className="flex w-fit items-center gap-2 hover:text-rose-600 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "overdue" })}><div className="w-2 h-2 rounded-full bg-rose-500"></div>Vencidos: {metrics.overdueTotal}</Link>
                    <Link className="flex w-fit items-center gap-2 hover:text-amber-600 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "today" })}><div className="w-2 h-2 rounded-full bg-amber-500"></div>Vence hoje: {metrics.dueTodayTotal}</Link>
                    <Link className="flex w-fit items-center gap-2 hover:text-sky-600 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "soon" })}><div className="w-2 h-2 rounded-full bg-sky-500"></div>Na semana: {metrics.dueSoonTotal}</Link>
                  </div>
                </div>
                <div className="relative z-10 h-[100px] w-[100px]">
                  {total > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2} dataKey="value" stroke="none">
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} itemStyle={{ color: '#334155' }} />
                      </PieChart>
                    </ResponsiveContainer>
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
        className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
      >
        <Card className="h-fit rounded-[32px] overflow-hidden border-white/60 bg-white/50 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-light tracking-tight text-slate-800">Filas de AÃ§Ã£o Imediata</CardTitle>
            <CardDescription className="text-slate-500">Filas de trabalho prioritÃ¡rias para desafogar a operaÃ§Ã£o.</CardDescription>
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
                  <span>PendÃªncias</span>
                  <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{summary.dueSoonItems.length + summary.withoutSetorItems.length + summary.withoutInteressadosItems.length}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="urgentes" className="grid gap-3">
                {summary.urgentItems.length === 0 ? (
                  <div className="py-8"><EmptyState description="Nenhum processo marcado como urgente para tratamento imediato." title="Zero UrgÃªncias" /></div>
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
                  <div className="py-8"><EmptyState description="Tudo fluindo regularmente. Fila pedindo andamento estÃ¡ zerada." title="Fluxo ContÃ­nuo" /></div>
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
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Todos os processos ativos jÃ¡ possuem setor.</p>
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
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Os processos ativos jÃ¡ possuem envolvidos vinculados.</p>
                  ) : (
                    summary.withoutInteressadosItems.slice(0, 3).map((item) => renderQueueItem(item))
                  )}
                </div>
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>

        <Card className="flex h-[800px] flex-col rounded-[32px] overflow-hidden border-white/60 bg-white/50 backdrop-blur-xl shadow-xl">
          <CardHeader className="shrink-0 pb-4">
            <CardTitle className="text-xl font-light tracking-tight text-slate-800">Ãšltimas MovimentaÃ§Ãµes</CardTitle>
            <CardDescription className="text-slate-500">A timeline recente da operaÃ§Ã£o.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 overflow-y-auto pr-2 pb-6">
            {summary.recentTimeline.length === 0 ? (
              <EmptyState description="As Ãºltimas criaÃ§Ãµes e mudanÃ§as aparecerÃ£o aqui." title="Sem movimentaÃ§Ãµes recentes" />
            ) : (
              summary.recentTimeline.map((event) => (
                <Link
                  className="group relative flex flex-col gap-3 rounded-[24px] border border-white/80 bg-gradient-to-br from-white/95 to-slate-50/80 px-5 py-4 shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl shrink-0"
                  key={event.id}
                  to={`/pre-demandas/${event.preId}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-600">{event.principalNumero}</p>
                      <h3 className="mt-2 text-base font-semibold text-slate-950">{describeEvent(event)}</h3>
                    </div>
                    {event.statusNovo ? <StatusPill status={event.statusNovo} /> : null}
                  </div>
                  <div className="grid gap-1 text-sm text-slate-500">
                    <p>{event.actor ? `${event.actor.name} (${event.actor.email})` : "Sistema"}</p>
                    <p>{new Date(event.occurredAt).toLocaleString("pt-BR")}</p>
                    {event.motivo ? <p className="mt-1 font-medium text-slate-700">Nota: {event.motivo}</p> : null}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}


