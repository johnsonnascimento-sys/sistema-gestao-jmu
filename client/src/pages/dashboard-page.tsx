import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { formatAppError, getDashboardSummary } from "../lib/api";
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

  function renderQueueItem(item: PreDemanda) {
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
          <StatusPill status={item.status} />
        </div>
        <div className="grid gap-1 text-sm text-slate-500">
          <p>{item.solicitante}</p>
          <p>Referencia: {new Date(item.dataReferencia).toLocaleDateString("pt-BR")}</p>
          <p>Atualizado: {new Date(item.updatedAt).toLocaleString("pt-BR")}</p>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summary.counts.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} value={item.total} />
        ))}
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
