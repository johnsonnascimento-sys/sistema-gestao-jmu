import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { formatAppError, getDashboardSummary } from "../lib/api";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda, PreDemandaDashboardSummary, TimelineEvent } from "../types";

function buildAnalyticalTableHref(overrides: Record<string, string>) {
  const search = new URLSearchParams({ view: "table", page: "1", ...overrides });
  return `/pre-demandas?${search.toString()}`;
}

function formatStructuredDeadlines(item: PreDemanda) {
  return [
    `Prazo do processo: ${item.prazoProcesso ? new Date(`${item.prazoProcesso}T00:00:00`).toLocaleDateString("pt-BR") : "-"}`,
    `Proxima tarefa: ${item.proximoPrazoTarefa ? new Date(`${item.proximoPrazoTarefa}T00:00:00`).toLocaleDateString("pt-BR") : "sem tarefas pendentes"}`,
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
        return "Movimentação operacional registrada.";
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setSummary(await getDashboardSummary());
      } catch (nextError) {
        setError(formatAppError(nextError, "Falha ao carregar dashboard."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingState description="Estamos montando o resumo operacional do dia." title="Preparando dashboard" />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  if (!summary) {
    return <ErrorState description="Resumo operacional indisponível." />;
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
      return `Prazo vencido há ${Math.abs(diffDays)}d`;
    }

    if (diffDays === 0) {
      return "Prazo vence hoje";
    }

    return `Prazo em ${diffDays}d`;
  }

  function renderQueueItem(item: PreDemanda, highlightType?: "urgent" | "payment") {
    const queueHealth = getQueueHealth(item);
    
    let borderStyle = "border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,233,0.8))] shadow-[0_12px_28px_rgba(20,33,61,0.06)] hover:shadow-[0_18px_36px_rgba(20,33,61,0.1)]";
    let titleColor = "text-amber-600";
    
    if (highlightType === "urgent") {
      borderStyle = "border-rose-300/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.98),rgba(255,228,230,0.9))] shadow-[0_14px_30px_rgba(190,24,93,0.12)] hover:shadow-[0_18px_36px_rgba(190,24,93,0.16)]";
      titleColor = "text-rose-700";
    } else if (highlightType === "payment") {
      borderStyle = "border-amber-300/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,237,213,0.9))] shadow-[0_14px_30px_rgba(217,119,6,0.12)] hover:shadow-[0_18px_36px_rgba(217,119,6,0.16)]";
      titleColor = "text-amber-700";
    }

    return (
      <Link
        className={`grid gap-2 rounded-[28px] border p-4 transition hover:-translate-y-0.5 ${borderStyle}`}
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
            {item.metadata.envolvePagamento ? <span className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">Pagamento</span> : null}
            <StatusPill status={item.status} />
            {highlightType !== "urgent" && highlightType !== "payment" && <QueueHealthPill item={item} />}
          </div>
        </div>
        <div className="grid gap-1 text-sm text-slate-500">
          <p>{item.pessoaPrincipal?.nome ?? "-"}</p>
          <p>Setor: {item.setorAtual ? item.setorAtual.sigla : "Não tramitado"}</p>
          {highlightType !== "urgent" && highlightType !== "payment" && <p>Envolvidos: {item.interessados.length}</p>}
          <p>{formatPrazo(item)}</p>
          <p>{formatStructuredDeadlines(item)}</p>
          <p>Referência: {new Date(item.dataReferencia).toLocaleDateString("pt-BR")}</p>
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
    <section className="grid gap-6">
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

      <div className="flex flex-wrap gap-2 -mt-4">
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=aguardando-sei">Aguardando SEI</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=fila-parada">Fila Parada</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=criticas">Críticas</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white text-rose-600 border-rose-200"><Link to="/pre-demandas?preset=prazos-vencidos">Prazos Vencidos</Link></Button>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-white"><Link to="/pre-demandas?preset=ultimas-encerradas">Últimos Encerrados</Link></Button>
        <Button asChild variant="ghost" size="sm" className="h-8"><Link to="/pre-demandas">Acessar Busca Avançada &rarr;</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
        {summary.counts.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} to={statusMetricHref[item.status]} value={item.total} />
        ))}
        <MetricCard label="Paradas 2d+" to={buildAnalyticalTableHref({ queueHealth: "attention,critical", sortBy: "updatedAt", sortOrder: "asc" })} value={summary.agingAttentionTotal + summary.agingCriticalTotal} />
        <MetricCard label="Críticas 5d+" to={buildAnalyticalTableHref({ preset: "criticas" })} value={summary.agingCriticalTotal} />
        <MetricCard label="Vence hoje" to={buildAnalyticalTableHref({ preset: "vence-hoje" })} value={summary.dueTodayTotal} />
        <MetricCard label="Prazos na semana" to={buildAnalyticalTableHref({ preset: "vencem-na-semana" })} value={summary.deadlines.processo.dueSoonTotal} />
        <MetricCard label="Sem setor" to={buildAnalyticalTableHref({ preset: "sem-setor" })} value={summary.withoutSetorTotal} />
        <MetricCard label="Sem envolvidos" to={buildAnalyticalTableHref({ preset: "sem-envolvidos" })} value={summary.withoutInteressadosTotal} />
      </div>

      <Card className="border-slate-200/60 bg-white/40">
        <CardHeader className="pb-4">
          <CardTitle>Radar de Prazos</CardTitle>
          <CardDescription>Prazos do processo, prazos das tarefas e consumo do prazo geral pelas tarefas pendentes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-3">
          {[
            { id: "processo", label: "Prazo do processo", campo: "prazoProcesso", secondary: null },
            { id: "tarefas", label: "Prazos das tarefas", campo: "proximoPrazoTarefa", secondary: "totalPending" },
            { id: "sinal", label: "Consumo do prazo", campo: "prazoProcesso", secondary: "signal" },
          ].map((item) => {
            if (item.id === "sinal") {
              return (
                <article className="grid gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(240,246,249,0.88))] px-4 py-4 shadow-[0_14px_28px_rgba(20,33,61,0.06)]" key={item.id}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">{summary.processosCriticosPrazo}</h3>
                    <p className="text-sm text-slate-500">processos criticos</p>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-700">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">Critico: {summary.processosCriticosPrazo}</div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">Atencao: {summary.processosEmAtencaoPrazo}</div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">Normal: monitorado na fila do processo</div>
                  </div>
                </article>
              );
            }
            const metrics = summary.deadlines[item.id as "processo" | "tarefas"];
            return (
              <article className="grid gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(240,246,249,0.88))] px-4 py-4 shadow-[0_14px_28px_rgba(20,33,61,0.06)]" key={item.id}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-950">{item.id === "tarefas" ? metrics.totalPending : metrics.totalDefined}</h3>
                  <p className="text-sm text-slate-500">{item.id === "tarefas" ? "tarefas pendentes com prazo" : "processos com prazo definido"}</p>
                </div>
                <div className="grid gap-2 text-sm text-slate-700">
                  <Link className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 hover:bg-rose-100 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "overdue" })}>
                    Vencidos: {metrics.overdueTotal}
                  </Link>
                  <Link className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 hover:bg-amber-100 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "today" })}>
                    Vence hoje: {metrics.dueTodayTotal}
                  </Link>
                  <Link className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 hover:bg-sky-100 transition-colors" to={buildAnalyticalTableHref({ deadlineCampo: item.campo, prazoRecorte: "soon" })}>
                    Na semana: {metrics.dueSoonTotal}
                  </Link>
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle>Filas de Ação Imediata</CardTitle>
            <CardDescription>Pendências ordenadas por nível de criticidade e gargalos operacionais.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="urgentes">
              <TabsList className="mb-4 w-full flex-wrap justify-start bg-slate-100/50">
                <TabsTrigger value="urgentes">Urgentes ({summary.urgentItems.length})</TabsTrigger>
                <TabsTrigger value="pagamento">Pagamento ({summary.paymentMarkedItems.length})</TabsTrigger>
                <TabsTrigger value="aguardando_sei">Aguardando SEI ({summary.awaitingSeiItems.length})</TabsTrigger>
                <TabsTrigger value="parados">Processos Parados ({staleItems.length})</TabsTrigger>
                <TabsTrigger value="pendencias">Pendências ({summary.dueSoonItems.length + summary.withoutSetorItems.length + summary.withoutInteressadosItems.length})</TabsTrigger>
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

        <Card className="h-[800px] flex flex-col">
          <CardHeader className="pb-4 shrink-0">
            <CardTitle>Últimas Movimentações</CardTitle>
            <CardDescription>A timeline recente da operação.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 overflow-y-auto pr-2 pb-6">
            {summary.recentTimeline.length === 0 ? (
              <EmptyState description="As últimas criações, mudanças de status e vinculações aparecerão aqui." title="Sem movimentações recentes" />
            ) : (
              summary.recentTimeline.map((event) => (
                <Link
                  className="flex flex-col gap-3 rounded-[28px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,233,0.82))] p-4 shadow-[0_12px_28px_rgba(20,33,61,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(20,33,61,0.1)] shrink-0"
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
      </div>
    </section>
  );
}
