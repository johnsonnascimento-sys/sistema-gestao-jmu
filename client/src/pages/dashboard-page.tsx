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
  const quickGroups = [
    {
      id: "criticas",
      label: "Criticas",
      value: summary.agingCriticalTotal,
      href: "/pre-demandas?preset=criticas",
    },
    {
      id: "vencidas",
      label: "Prazos vencidos",
      value: summary.overdueTotal,
      href: "/pre-demandas?preset=prazos-vencidos",
    },
    {
      id: "vence-hoje",
      label: "Vence hoje",
      value: summary.dueTodayTotal,
      href: "/pre-demandas?dueState=due_soon&view=table",
    },
    {
      id: "na-semana",
      label: "Vencem na semana",
      value: summary.dueSoonTotal,
      href: "/pre-demandas?preset=vencem-na-semana",
    },
    {
      id: "sem-envolvidos",
      label: "Sem envolvidos",
      value: summary.withoutInteressadosTotal,
      href: "/pre-demandas?preset=sem-envolvidos",
    },
  ];

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
        className="grid gap-2 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,233,0.8))] p-4 shadow-[0_12px_28px_rgba(20,33,61,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(20,33,61,0.1)]"
        key={item.preId}
        to={`/pre-demandas/${item.preId}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-600">{item.principalNumero}</p>
            <h3 className="mt-2 text-base font-semibold text-slate-950">{item.assunto}</h3>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <StatusPill status={item.status} />
            <QueueHealthPill item={item} />
          </div>
        </div>
        <div className="grid gap-1 text-sm text-slate-500">
          <p>{item.pessoaPrincipal?.nome ?? item.solicitante}</p>
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
        <MetricCard label="Vence hoje" value={summary.dueTodayTotal} />
        <MetricCard label="Com pagamento" value={summary.paymentMarkedTotal} />
        <MetricCard label="Prazos na semana" value={summary.dueSoonTotal} />
        <MetricCard label="Prazos vencidos" value={summary.overdueTotal} />
        <MetricCard label="Sem setor" value={summary.withoutSetorTotal} />
        <MetricCard label="Sem envolvidos" value={summary.withoutInteressadosTotal} />
        <MetricCard label="Reabertas 30d" value={summary.reopenedLast30Days} />
        <MetricCard label="Encerradas 30d" value={summary.closedLast30Days} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grupos rapidos da operacao</CardTitle>
          <CardDescription>Entradas directas para os recortes com maior urgencia operacional.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-4">
          {quickGroups.map((group) => (
            <article className="grid gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(240,246,249,0.88))] px-4 py-4 shadow-[0_14px_28px_rgba(20,33,61,0.06)]" key={group.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{group.label}</p>
                  <h3 className="mt-2 text-3xl font-semibold text-slate-950">{group.value}</h3>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to={group.href}>Abrir</Link>
                </Button>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

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
                  className="flex flex-col gap-3 rounded-[28px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,233,0.82))] p-4 shadow-[0_12px_28px_rgba(20,33,61,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(20,33,61,0.1)]"
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
              <CardTitle>Processos com pagamento</CardTitle>
              <CardDescription>Casos com impacto financeiro marcado no metadata, em destaque para controlo prioritário.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {summary.paymentMarkedItems.length === 0 ? (
                <EmptyState description="Quando um processo tiver pagamento envolvido marcado, ele aparece aqui com destaque." title="Nenhum processo com pagamento" />
              ) : (
                summary.paymentMarkedItems.map((item) => (
                  <Link
                    className="grid gap-2 rounded-[28px] border border-amber-300/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,237,213,0.9))] p-4 shadow-[0_14px_30px_rgba(217,119,6,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(217,119,6,0.16)]"
                    key={`payment-${item.preId}`}
                    to={`/pre-demandas/${item.preId}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">{item.principalNumero}</p>
                        <h3 className="mt-2 text-base font-semibold text-slate-950">{item.assunto}</h3>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <span className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">Pagamento</span>
                        <StatusPill status={item.status} />
                      </div>
                    </div>
                    <div className="grid gap-1 text-sm text-slate-600">
                      <p>{item.pessoaPrincipal?.nome ?? item.solicitante}</p>
                      <p>Setor: {item.setorAtual ? item.setorAtual.sigla : "Nao tramitado"}</p>
                      <p>{formatPrazo(item)}</p>
                      <p>Referencia: {new Date(item.dataReferencia).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

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
                    <Link to="/pre-demandas?preset=vencem-na-semana">Abrir fila</Link>
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
                    <Link to="/pre-demandas?preset=sem-setor">Ver fila</Link>
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
                    <Link to="/pre-demandas?preset=sem-envolvidos">Ver fila</Link>
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
                <Link to="/pre-demandas?preset=criticas">Fila critica</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=prazos-vencidos">Prazos vencidos</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=ultimas-encerradas">Ultimas encerradas</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/pre-demandas?preset=sem-setor">Sem setor</Link>
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
