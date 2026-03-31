import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/confirm-dialog";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { formatAppError, listPreDemandas, listSetores, updatePreDemandaStatus } from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { getPreferredReopenStatus, getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda, PreDemandaSortBy, PreDemandaStatus, QueueHealthLevel, Setor, SortOrder, StatusCount } from "../types";
import { PreDemandasFilters } from "./pre-demandas-filters";
import { PreDemandasTable } from "./pre-demandas-table";
import {
  BoardView,
  QuickAction,
  ResolvedSearchState,
  SectorQueueSummary,
  buildSectorQueueSearch,
  buildWithoutSetorQueueSearch,
  getSectorRiskLevel,
  resolveSearchState,
} from "./pre-demandas-utils";

export function PreDemandasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PreDemanda[]>([]);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);

  const searchKey = searchParams.toString();
  const resolvedState = useMemo(() => resolveSearchState(searchParams), [searchKey]);



  async function load() {
    setLoading(true);

    try {
      const response = await listPreDemandas({
        q: resolvedState.q,
        status: resolvedState.statuses,
        queueHealth: resolvedState.queueHealth,
        dateFrom: resolvedState.dateFrom || undefined,
        dateTo: resolvedState.dateTo || undefined,
        hasSei: resolvedState.hasSei ? resolvedState.hasSei === "true" : undefined,
        setorAtualId: resolvedState.setorAtualId || undefined,
        withoutSetor: resolvedState.withoutSetor ? resolvedState.withoutSetor === "true" : undefined,
        dueState: resolvedState.dueState || undefined,
        deadlineCampo: resolvedState.deadlineCampo || undefined,
        prazoRecorte: resolvedState.prazoRecorte || undefined,
        taskRecurrence: resolvedState.taskRecurrence || undefined,
        paymentInvolved: resolvedState.paymentInvolved ? resolvedState.paymentInvolved === "true" : undefined,
        hasInteressados: resolvedState.hasInteressados ? resolvedState.hasInteressados === "true" : undefined,
        closedWithinDays: resolvedState.closedWithinDays ? Number(resolvedState.closedWithinDays) : undefined,
        reopenedWithinDays: resolvedState.reopenedWithinDays ? Number(resolvedState.reopenedWithinDays) : undefined,
        sortBy: resolvedState.sortBy,
        sortOrder: resolvedState.sortOrder,
        page: resolvedState.page,
        pageSize,
      });

      setItems(response.items);
      setCounts(response.counts);
      setTotal(response.total);
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar processos."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handleUpdate = () => {
      void load();
    };

    window.addEventListener("pre-demanda-updated", handleUpdate);
    return () => {
      window.removeEventListener("pre-demanda-updated", handleUpdate);
    };
  }, [searchKey, load]);

  useEffect(() => {
    void load();
  }, [searchKey]);

  useEffect(() => {
    async function loadSetorOptions() {
      try {
        setSetores(await listSetores());
      } catch {
        setSetores([]);
      }
    }

    void loadSetorOptions();
  }, []);

  const pageSize = 12;



  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const metrics = useMemo(() => counts, [counts]);
  const selectedSetor = useMemo(() => setores.find((item) => item.id === resolvedState.setorAtualId) ?? null, [resolvedState.setorAtualId, setores]);
  const isWithoutSetorFocused = resolvedState.withoutSetor === "true" && !resolvedState.setorAtualId;
  const sectorSummaries = useMemo<SectorQueueSummary[]>(() => {
    const groups = new Map<string, SectorQueueSummary>();

    for (const item of items) {
      const key = item.setorAtual?.id ?? "__sem_setor__";
      const current =
        groups.get(key) ??
        {
          setorId: item.setorAtual?.id ?? null,
          sigla: item.setorAtual?.sigla ?? "Sem setor",
          nome: item.setorAtual?.nomeCompleto ?? "Processos ainda sem setor definido.",
          total: 0,
          overdue: 0,
          dueSoon: 0,
          criticalQueue: 0,
          attentionQueue: 0,
          withoutInteressados: 0,
          riskLevel: "normal",
          riskScore: 0,
        };

      current.total += 1;

      if (item.interessados.length === 0) {
        current.withoutInteressados += 1;
      }

      if (item.prazoProcesso) {
        const dueDate = new Date(item.prazoProcesso);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const dueDateOnly = new Date(dueDate);
        dueDateOnly.setHours(0, 0, 0, 0);
        const diffDays = Math.round((dueDateOnly.getTime() - startOfToday.getTime()) / 86400000);

        if (diffDays < 0) {
          current.overdue += 1;
        } else if (diffDays <= 7) {
          current.dueSoon += 1;
        }
      }

      if (item.queueHealth.level === "critical") {
        current.criticalQueue += 1;
      } else if (item.queueHealth.level === "attention") {
        current.attentionQueue += 1;
      }

      current.riskScore = current.overdue * 3 + current.criticalQueue * 2 + current.dueSoon + current.withoutInteressados;
      current.riskLevel = getSectorRiskLevel(current.riskScore);
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }

      return right.total - left.total;
    });
  }, [items]);
  const sectorRiskById = useMemo<Record<string, "normal" | "attention" | "critical">>(() => {
    return sectorSummaries.reduce<Record<string, "normal" | "attention" | "critical">>((acc, item) => {
      if (item.setorId) {
        acc[item.setorId] = item.riskLevel;
      }

      return acc;
    }, {});
  }, [sectorSummaries]);
  const quickGroups = useMemo(
    () => [
      {
        id: "em-risco",
        label: "Em risco",
        description: "Fila com maior risco operacional e atualizacao mais antiga primeiro.",
        value: items.filter((item) => item.queueHealth.level === "critical").length,
        href: "/pre-demandas?preset=em-risco",
      },
      {
        id: "vencidas",
        label: "Prazos vencidos",
        description: "Processos ativos com prazo do processo ja ultrapassado.",
        value: items.filter((item) => item.prazoProcesso && new Date(`${item.prazoProcesso}T00:00:00`).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
        href: "/pre-demandas?preset=prazos-vencidos",
      },
      {
        id: "na-semana",
        label: "Vencem na semana",
        description: "Processos ativos que exigem seguimento antes do prazo do processo.",
        value: items.filter((item) => {
          if (!item.prazoProcesso) {
            return false;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(`${item.prazoProcesso}T00:00:00`);
          const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
          return diffDays >= 0 && diffDays <= 7;
        }).length,
        href: "/pre-demandas?preset=vencem-na-semana",
      },
      {
        id: "sem-envolvidos",
        label: "Sem envolvidos",
        description: "Cases a completar antes de seguir o fluxo.",
        value: items.filter((item) => item.interessados.length === 0).length,
        href: "/pre-demandas?preset=sem-envolvidos",
      },
      {
        id: "sem-setor",
        label: "Sem setor",
        description: "Cases ainda sem destinacao formal.",
        value: items.filter((item) => !item.setorAtual).length,
        href: "/pre-demandas?preset=sem-setor",
      },
    ],
    [items],
  );
  function updateView(view: BoardView) {
    const next = new URLSearchParams(searchParams);
    next.set("view", view);
    setSearchParams(next);
  }

  const firstVisibleItem = total === 0 ? 0 : (resolvedState.page - 1) * pageSize + 1;
  const lastVisibleItem = total === 0 ? 0 : Math.min(total, resolvedState.page * pageSize);

  if (loading) {
    return <LoadingState description="Preparando o quadro operacional e os filtros da fila." title="Carregando processos" />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/pre-demandas/nova">Novo processo</Link>
          </Button>
        }
        description="Filtre, ordene e aja sobre a fila operacional sem sair do quadro principal."
        eyebrow="Fila operacional"
        title="Processos do Gestor"
      />

      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} value={item.total} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grupos rapidos</CardTitle>
          <CardDescription>Recortes operacionais prontos para acao imediata dentro da fila atual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-5">
          {quickGroups.map((group) => (
            <article className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4" key={group.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{group.label}</p>
                  <h3 className="mt-2 text-3xl font-semibold text-slate-950">{group.value}</h3>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to={group.href}>Abrir</Link>
                </Button>
              </div>
              <p className="text-sm text-slate-600">{group.description}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      {sectorSummaries.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Setores em foco</CardTitle>
            <CardDescription>Resumo dos setores mais pressionados dentro do recorte atual da fila, para trocar rapidamente de contexto sem voltar ao painel administrativo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-4">
            {sectorSummaries.slice(0, 4).map((sector) => (
              <article
                className={`grid gap-3 rounded-[22px] border px-4 py-4 ${
                  sector.riskLevel === "critical"
                    ? "border-rose-200 bg-rose-50/80"
                    : sector.riskLevel === "attention"
                      ? "border-amber-200 bg-amber-50/80"
                      : "border-slate-200 bg-slate-50/70"
                }`}
                key={sector.setorId ?? "sem-setor"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{sector.sigla}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{sector.nome}</h3>
                  </div>
                  <span className="rounded-full border border-current/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {sector.riskLevel}
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  {sector.total} activas - {sector.overdue} vencidas - {sector.dueSoon} a vencer - {sector.withoutInteressados} sem envolvidos
                </p>
                {sector.setorId ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant={resolvedState.setorAtualId === sector.setorId ? "primary" : "secondary"}>
                      <Link to={buildSectorQueueSearch(searchParams, sector.setorId, sector.overdue > 0 ? "overdue" : "")}>
                        {sector.overdue > 0 ? "Abrir fila critica" : "Focar setor"}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={buildSectorQueueSearch(searchParams, sector.setorId, "")}>Todas do setor</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to={buildWithoutSetorQueueSearch(searchParams, sector.overdue > 0 ? "overdue" : "", "")}>
                        Tratar sem setor
                      </Link>
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {selectedSetor ? (
        <Card>
          <CardHeader>
            <CardTitle>Contexto operacional</CardTitle>
            <CardDescription>
              A fila esta focada no setor {selectedSetor.sigla}. Use os atalhos para alternar rapidamente entre todos os processos, vencidos e proximos do prazo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="sm" variant={resolvedState.dueState === "" ? "primary" : "secondary"}>
              <Link to={buildSectorQueueSearch(searchParams, selectedSetor.id, "")}>Todas do setor</Link>
            </Button>
            <Button asChild size="sm" variant={resolvedState.dueState === "overdue" ? "primary" : "secondary"}>
              <Link to={buildSectorQueueSearch(searchParams, selectedSetor.id, "overdue")}>So vencidas</Link>
            </Button>
            <Button asChild size="sm" variant={resolvedState.dueState === "due_soon" ? "primary" : "secondary"}>
              <Link to={buildSectorQueueSearch(searchParams, selectedSetor.id, "due_soon")}>Vencem em 7 dias</Link>
            </Button>
            <Button asChild size="sm" variant={resolvedState.hasInteressados === "false" ? "outline" : "ghost"}>
              <Link to={`/pre-demandas?${new URLSearchParams({ ...Object.fromEntries(searchParams), setorAtualId: selectedSetor.id, hasInteressados: "false", view: "table", page: "1" }).toString()}`}>
                Sem envolvidos
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isWithoutSetorFocused ? (
        <Card>
          <CardHeader>
            <CardTitle>Contexto operacional</CardTitle>
            <CardDescription>A fila esta focada em processos ainda sem setor. Use os atalhos para distribuir primeiro os processos vencidos, proximos do prazo ou ainda sem envolvidos.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="sm" variant={resolvedState.dueState === "" && resolvedState.hasInteressados !== "false" ? "primary" : "secondary"}>
              <Link to={buildWithoutSetorQueueSearch(searchParams, "", "")}>Todas sem setor</Link>
            </Button>
            <Button asChild size="sm" variant={resolvedState.dueState === "overdue" ? "primary" : "secondary"}>
              <Link to={buildWithoutSetorQueueSearch(searchParams, "overdue", "")}>So vencidas</Link>
            </Button>
            <Button asChild size="sm" variant={resolvedState.dueState === "due_soon" ? "primary" : "secondary"}>
              <Link to={buildWithoutSetorQueueSearch(searchParams, "due_soon", "")}>Vencem em 7 dias</Link>
            </Button>
            <Button asChild size="sm" variant={resolvedState.hasInteressados === "false" ? "outline" : "ghost"}>
              <Link to={buildWithoutSetorQueueSearch(searchParams, "", "false")}>Sem envolvidos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <PreDemandasFilters resolvedState={resolvedState} setores={setores} searchParams={searchParams} setSearchParams={setSearchParams} />

      <PreDemandasTable
        items={items}
        sectorRiskById={sectorRiskById}
        onQuickAction={(item, action) => {
          if (action === "aguardando") {
            setQuickAction({ item, nextStatus: "aguardando_sei", label: "Marcar como aguardando SEI", requireReason: false });
            return;
          }

          if (action === "encerrar") {
            setQuickAction({ item, nextStatus: "encerrada", label: "Encerrar processo", requireReason: true });
            return;
          }

          const reopenStatus = getPreferredReopenStatus(item); 

          if (!reopenStatus) {
            return;
          }

          setQuickAction({
            item,
            nextStatus: reopenStatus,
            label: "Reabrir processo",
            requireReason: true,
          });
        }}
      />

      <div className="flex flex-col items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,246,249,0.88))] px-4 py-3 text-sm text-slate-600 shadow-[0_12px_24px_rgba(20,33,61,0.05)] sm:flex-row">
        <span>
          Pagina {resolvedState.page} de {totalPages} - {firstVisibleItem} a {lastVisibleItem} de {total}
        </span>
        <div className="flex gap-2">
          <Button
            disabled={resolvedState.page <= 1}
            onClick={() => setSearchParams(new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(resolvedState.page - 1) }))}
            type="button"
            variant="secondary"
          >
            Anterior
          </Button>
          <Button
            disabled={resolvedState.page >= totalPages}
            onClick={() => setSearchParams(new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(resolvedState.page + 1) }))}
            type="button"
            variant="secondary"
          >
            Proxima
          </Button>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel={quickAction?.label ?? "Confirmar"}
        description="Registre o motivo da alteracao de status para manter a trilha de auditoria operacional."
        extraOption={
          quickAction?.nextStatus === "encerrada"
            ? {
                label: "Excluir todas as tarefas pendentes ao concluir",
                description: "As tarefas pendentes serao removidas, com registro no historico do processo.",
              }
            : undefined
        }
        reopenScheduleOption={quickAction?.nextStatus === "encerrada"}
        onConfirm={async ({ motivo, observacoes, extraOptionChecked, reopenSchedule }) => {
          if (!quickAction) {
            return;
          }

          try {
            setError("");
            setMessage("");
            await updatePreDemandaStatus(quickAction.item.preId, {
              status: quickAction.nextStatus,
              motivo,
              observacoes,
              delete_pending_tasks: quickAction.nextStatus === "encerrada" ? extraOptionChecked : undefined,
              reopen_schedule: quickAction.nextStatus === "encerrada" ? reopenSchedule : undefined,
            });
            setMessage(`Processo ${quickAction.item.principalNumero} atualizado para ${getPreDemandaStatusLabel(quickAction.nextStatus)}.`);
            await load();
          } catch (nextError) {
            throw new Error(formatPreDemandaMutationError(nextError, "Falha ao atualizar o processo."));
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setQuickAction(null);
          }
        }}
        open={Boolean(quickAction)}
        requireReason={quickAction?.requireReason}
        title={quickAction?.label ?? "Confirmar alteracao"}
      />
    </section>
  );
}
