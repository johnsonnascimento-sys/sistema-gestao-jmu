import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { formatAppError, getDashboardSummary } from "../lib/api";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda, PreDemandaDashboardSummary, TimelineEvent } from "../types";

export function DashboardPage() {
  const [summary, setSummary] = useState<PreDemandaDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function describeEvent(event: TimelineEvent) {
    switch (event.type) {
      case "created":
        return "Nova pre-demanda registada.";
      case "status_changed":
        return `Status alterado para ${event.statusNovo?.replace("_", " ") ?? "-"}.`;
      case "sei_linked":
        return `SEI ${event.seiNumeroNovo ?? "-"} associado.`;
      case "sei_reassociated":
        return `SEI corrigido para ${event.seiNumeroNovo ?? "-"}.`;
      default:
        return "Movimentacao operacional registada.";
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
    return <LoadingState description="Estamos a montar o resumo operativo do dia." title="A preparar dashboard" />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  if (!summary) {
    return <ErrorState description="Resumo operativo indisponivel." />;
  }

  const staleItems = summary.staleItems;

  function formatPrazo(item: PreDemanda) {
    if (!item.prazoFinal) {
      return "Sem prazo definido";
    }

    const dueDate = new Date(`${item.prazoFinal}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) {
      return `Prazo vencido ha ${Math.abs(diffDays)}d`;
    }

    if (diffDays === 0) {
      return "Prazo vence hoje";
    }

    return `Prazo em ${diffDays}d`;
  }

  function renderQueueItem(item: PreDemanda) {
    const queueHealth = getQueueHealth(item);

    return (
      <Link
        className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
        key={item.preId}
        to={`/pre-demandas/${item.preId}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-600">{item.preId}</p>
            <h3 className="mt-2 text-base font-semibold text-slate-950">{item.assunto}</h3>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <StatusPill status={item.status} />
            <QueueHealthPill item={item} />
          </div>
        </div>
        <div className="grid gap-1 text-sm text-slate-500">
          <p>{item.solicitante}</p>
          <p>Setor: {item.setorAtual ? item.setorAtual.sigla : "Nao tramitado"}</p>
          <p>Envolvidos: {item.interessados.length}</p>
          <p>{formatPrazo(item)}</p>
          <p>Referencia: {new Date(item.dataReferencia).toLocaleDateString("pt-BR")}</p>
          <p>Atualizado: {new Date(item.updatedAt).toLocaleString("pt-BR")}</p>
          <p>{queueHealth.detail}</p>
        </div>
      </Link>
    );
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/pre-demandas?preset=aguardando-sei">Ver aguardando SEI</Link>
            </Button>
            <Button asChild>
              <Link to="/pre-demandas/nova">Nova demanda</Link>
            </Button>
          </>
        }
        description="Visao operacional do modulo pre-SEI/SEI, com atalhos para triagem e acompanhamento."
        eyebrow="Visao geral"
        title="Dashboard do Gestor"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        {summary.counts.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} value={item.total} />
        ))}
        <MetricCard label="Paradas 2d+" value={summary.agingAttentionTotal + summary.agingCriticalTotal} />
        <MetricCard label="Criticas 5d+" value={summary.agingCriticalTotal} />
        <MetricCard label="Prazos na semana" value={summary.dueSoonTotal} />
        <MetricCard label="Prazos vencidos" value={summary.overdueTotal} />
        <MetricCard label="Sem setor" value={summary.withoutSetorTotal} />
        <MetricCard label="Sem envolvidos" value={summary.withoutInteressadosTotal} />
        <MetricCard label="Reabertas 30d" value={summary.reopenedLast30Days} />
        <MetricCard label="Encerradas 30d" value={summary.closedLast30Days} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ultimas movimentacoes</CardTitle>
            <CardDescription>A timeline recente do modulo pre-SEI/SEI.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {summary.recentTimeline.length === 0 ? (
              <EmptyState description="As ultimas criacoes, mudancas de status e vinculacoes SEI aparecerao aqui." title="Sem movimentacoes recentes" />
            ) : (
              summary.recentTimeline.map((event) => (
                <Link
                  className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                  key={event.id}
                  to={`/pre-demandas/${event.preId}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-600">{event.preId}</p>
                      <h3 className="mt-2 text-base font-semibold text-slate-950">{describeEvent(event)}</h3>
                    </div>
                    {event.statusNovo ? <StatusPill status={event.statusNovo} /> : null}
                  </div>
                  <div className="grid gap-1 text-sm text-slate-500">
                    <p>{event.actor ? `${event.actor.name} (${event.actor.email})` : "Sistema"}</p>
                    <p>{new Date(event.occurredAt).toLocaleString("pt-BR")}</p>
                    {event.motivo ? <p>{event.motivo}</p> : null}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Demandas paradas</CardTitle>
              <CardDescription>Itens activos sem movimentacao recente, ordenados pela actualizacao mais antiga.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {staleItems.length === 0 ? (
                <EmptyState description="Quando houver fila a pedir seguimento por falta de movimentacao, ela aparecera aqui." title="Nenhuma demanda parada" />
              ) : (
                staleItems.map(renderQueueItem)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fila aguardando SEI</CardTitle>
              <CardDescription>Demandas que pedem seguimento operacional imediato.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {summary.awaitingSeiItems.length === 0 ? (
                <EmptyState description="Quando uma demanda entrar em acompanhamento ate nascer o processo, ela aparecera aqui." title="Nenhuma demanda aguardando SEI" />
              ) : (
                summary.awaitingSeiItems.map(renderQueueItem)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prazos e pendencias estruturais</CardTitle>
              <CardDescription>Casos que pedem enriquecimento de case management antes de seguir o fluxo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">Prazos na semana</p>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/pre-demandas?preset=fila-operacional&sortBy=prazoFinal&sortOrder=asc&view=table">Abrir fila</Link>
                  </Button>
                </div>
                {summary.dueSoonItems.length === 0 ? (
                  <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhum prazo iminente registado.</p>
                ) : (
                  summary.dueSoonItems.map(renderQueueItem)
                )}
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">Sem setor atual</p>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/pre-demandas?preset=fila-operacional&sortBy=updatedAt&sortOrder=asc&view=table">Ver fila</Link>
                  </Button>
                </div>
                {summary.withoutSetorItems.length === 0 ? (
                  <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Todos os casos ativos ja possuem setor.</p>
                ) : (
                  summary.withoutSetorItems.map(renderQueueItem)
                )}
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">Sem envolvidos</p>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/interessados">Abrir cadastro</Link>
                  </Button>
                </div>
                {summary.withoutInteressadosItems.length === 0 ? (
                  <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Os casos ativos ja possuem envolvidos vinculados.</p>
                ) : (
                  summary.withoutInteressadosItems.map(renderQueueItem)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atalhos operacionais</CardTitle>
              <CardDescription>Entradas rapidas para os fluxos do dia-a-dia.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=triagem-abertas">Triagem de abertas</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=aguardando-sei">Fila aguardando SEI</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=fila-parada">Fila parada</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=ultimas-encerradas">Ultimas encerradas</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=fila-operacional">Fila operacional</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/pre-demandas">Abrir quadro completo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
