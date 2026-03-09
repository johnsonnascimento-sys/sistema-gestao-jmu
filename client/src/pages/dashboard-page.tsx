import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { getRecentTimeline, listPreDemandas } from "../lib/api";
import type { StatusCount, TimelineEvent } from "../types";

export function DashboardPage() {
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [recentTimeline, setRecentTimeline] = useState<TimelineEvent[]>([]);
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
        const [response, timeline] = await Promise.all([
          listPreDemandas({ page: 1, pageSize: 6, sortBy: "updatedAt", sortOrder: "desc" }),
          getRecentTimeline(8),
        ]);
        setCounts(response.counts);
        setRecentTimeline(timeline);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Falha ao carregar dashboard.");
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

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/pre-demandas?status=aguardando_sei">Ver aguardando SEI</Link>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {counts.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} value={item.total} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ultimas movimentacoes</CardTitle>
            <CardDescription>A timeline recente do modulo pre-SEI/SEI.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentTimeline.map((event) => (
              <Link className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white" key={event.id} to={`/pre-demandas/${event.preId}`}>
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
            ))}
            {recentTimeline.length === 0 ? <p className="text-sm text-slate-500">Ainda nao ha movimentacoes registadas.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atalhos operacionais</CardTitle>
            <CardDescription>Entradas rápidas para os fluxos do dia-a-dia.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild variant="secondary">
              <Link to="/pre-demandas?status=aberta&sortBy=dataReferencia&sortOrder=asc">Triagem de abertas</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/pre-demandas?status=aguardando_sei">Fila aguardando SEI</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/pre-demandas?status=encerrada&sortBy=updatedAt&sortOrder=desc">Ultimas encerradas</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/pre-demandas">Abrir quadro completo</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
