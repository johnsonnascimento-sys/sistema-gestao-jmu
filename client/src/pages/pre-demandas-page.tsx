import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FilterBar } from "../components/filter-bar";
import { FormField } from "../components/form-field";
import { KanbanBoard } from "../components/kanban-board";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { formatAppError, listPreDemandas, updatePreDemandaStatus } from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { getPreferredReopenStatus, getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda, PreDemandaSortBy, PreDemandaStatus, QueueHealthLevel, SortOrder, StatusCount } from "../types";

const STATUSES: Array<{ value: PreDemandaStatus; label: string }> = [
  { value: "aberta", label: "Aberta" },
  { value: "aguardando_sei", label: "Aguardando SEI" },
  { value: "associada", label: "Associada" },
  { value: "encerrada", label: "Encerrada" },
];

const QUEUE_HEALTH_OPTIONS: Array<{ value: QueueHealthLevel; label: string }> = [
  { value: "fresh", label: "No prazo" },
  { value: "attention", label: "Atencao" },
  { value: "critical", label: "Critica" },
];

const selectClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-amber-200/50";

type BoardView = "kanban" | "table";
type SavedViewId = "fila-operacional" | "triagem-abertas" | "aguardando-sei" | "fila-parada" | "com-sei" | "ultimas-encerradas";

type QuickAction = {
  item: PreDemanda;
  nextStatus: PreDemandaStatus;
  label: string;
  requireReason: boolean;
};

type ResolvedSearchState = {
  presetId: SavedViewId | null;
  q: string;
  statuses: string[];
  queueHealth: QueueHealthLevel[];
  dateFrom: string;
  dateTo: string;
  hasSei: "" | "true" | "false";
  sortBy: PreDemandaSortBy;
  sortOrder: SortOrder;
  page: number;
  view: BoardView;
};

const SAVED_VIEWS: Array<{
  id: SavedViewId;
  label: string;
  description: string;
  defaults: {
    statuses?: string[];
    queueHealth?: QueueHealthLevel[];
    hasSei?: "" | "true" | "false";
    sortBy: PreDemandaSortBy;
    sortOrder: SortOrder;
    view: BoardView;
  };
}> = [
  {
    id: "fila-operacional",
    label: "Fila operacional",
    description: "Abertas, aguardando SEI e associadas no quadro principal.",
    defaults: {
      statuses: ["aberta", "aguardando_sei", "associada"],
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "kanban",
    },
  },
  {
    id: "triagem-abertas",
    label: "Triagem de abertas",
    description: "Demandas novas, ordenadas pela referencia mais antiga.",
    defaults: {
      statuses: ["aberta"],
      sortBy: "dataReferencia",
      sortOrder: "asc",
      view: "kanban",
    },
  },
  {
    id: "aguardando-sei",
    label: "Aguardando SEI",
    description: "Fila para acompanhamento ate o numero SEI nascer.",
    defaults: {
      statuses: ["aguardando_sei"],
      sortBy: "dataReferencia",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "fila-parada",
    label: "Fila parada",
    description: "Demandas activas com maior tempo sem movimentacao, ordenadas pela actualizacao mais antiga.",
    defaults: {
      statuses: ["aberta", "aguardando_sei", "associada"],
      queueHealth: ["attention", "critical"],
      sortBy: "updatedAt",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "com-sei",
    label: "Com SEI",
    description: "Demandas que ja possuem vinculacao valida.",
    defaults: {
      hasSei: "true",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "ultimas-encerradas",
    label: "Ultimas encerradas",
    description: "Fechamentos mais recentes para revisao ou conferencias.",
    defaults: {
      statuses: ["encerrada"],
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
];

function splitValues(value: string | null) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function getSavedView(presetId: string | null) {
  return SAVED_VIEWS.find((item) => item.id === presetId) ?? null;
}

function resolveSearchState(searchParams: URLSearchParams): ResolvedSearchState {
  const preset = getSavedView(searchParams.get("preset"));

  return {
    presetId: preset?.id ?? null,
    q: searchParams.get("q") ?? "",
    statuses: searchParams.has("status") ? splitValues(searchParams.get("status")) : preset?.defaults.statuses ?? [],
    queueHealth: searchParams.has("queueHealth") ? (splitValues(searchParams.get("queueHealth")) as QueueHealthLevel[]) : preset?.defaults.queueHealth ?? [],
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    hasSei: searchParams.has("hasSei") ? ((searchParams.get("hasSei") as "true" | "false") ?? "") : preset?.defaults.hasSei ?? "",
    sortBy: (searchParams.get("sortBy") as PreDemandaSortBy | null) ?? preset?.defaults.sortBy ?? "updatedAt",
    sortOrder: (searchParams.get("sortOrder") as SortOrder | null) ?? preset?.defaults.sortOrder ?? "desc",
    page: Number(searchParams.get("page") ?? "1"),
    view: searchParams.get("view") === "table" ? "table" : preset?.defaults.view ?? "kanban",
  };
}

export function PreDemandasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PreDemanda[]>([]);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);

  const searchKey = searchParams.toString();
  const resolvedState = useMemo(() => resolveSearchState(searchParams), [searchKey]);

  const [query, setQuery] = useState(resolvedState.q);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(resolvedState.statuses);
  const [selectedQueueHealth, setSelectedQueueHealth] = useState<QueueHealthLevel[]>(resolvedState.queueHealth);
  const [dateFrom, setDateFrom] = useState(resolvedState.dateFrom);
  const [dateTo, setDateTo] = useState(resolvedState.dateTo);
  const [hasSei, setHasSei] = useState(resolvedState.hasSei);
  const [sortBy, setSortBy] = useState<PreDemandaSortBy>(resolvedState.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(resolvedState.sortOrder);

  const pageSize = 12;

  useEffect(() => {
    setQuery(resolvedState.q);
    setSelectedStatuses(resolvedState.statuses);
    setSelectedQueueHealth(resolvedState.queueHealth);
    setDateFrom(resolvedState.dateFrom);
    setDateTo(resolvedState.dateTo);
    setHasSei(resolvedState.hasSei);
    setSortBy(resolvedState.sortBy);
    setSortOrder(resolvedState.sortOrder);
  }, [searchKey, resolvedState]);

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
      setError(formatAppError(nextError, "Falha ao carregar pre-demandas."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [searchKey]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();

    if (query.trim()) {
      next.set("q", query.trim());
    }

    if (selectedStatuses.length) {
      next.set("status", selectedStatuses.join(","));
    }

    if (selectedQueueHealth.length) {
      next.set("queueHealth", selectedQueueHealth.join(","));
    }

    if (dateFrom) {
      next.set("dateFrom", dateFrom);
    }

    if (dateTo) {
      next.set("dateTo", dateTo);
    }

    if (hasSei) {
      next.set("hasSei", hasSei);
    }

    next.set("sortBy", sortBy);
    next.set("sortOrder", sortOrder);
    next.set("view", resolvedState.view);
    next.set("page", "1");
    setSearchParams(next);
  }

  function updateView(nextView: BoardView) {
    const next = new URLSearchParams(searchParams);
    next.set("view", nextView);
    setSearchParams(next);
  }

  function applyPreset(presetId: SavedViewId) {
    const preset = getSavedView(presetId);

    if (!preset) {
      return;
    }

    const next = new URLSearchParams();
    next.set("preset", presetId);
    next.set("view", preset.defaults.view);
    next.set("page", "1");
    setSearchParams(next);
  }

  function clearFilters() {
    setQuery("");
    setSelectedStatuses([]);
    setSelectedQueueHealth([]);
    setDateFrom("");
    setDateTo("");
    setHasSei("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setSearchParams(new URLSearchParams({ view: resolvedState.view, page: "1", sortBy: "updatedAt", sortOrder: "desc" }));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const metrics = useMemo(() => counts, [counts]);
  const hiddenClosedCount = useMemo(() => (resolvedState.view === "kanban" ? items.filter((item) => item.status === "encerrada").length : 0), [items, resolvedState.view]);
  const firstVisibleItem = total === 0 ? 0 : (resolvedState.page - 1) * pageSize + 1;
  const lastVisibleItem = total === 0 ? 0 : Math.min(total, resolvedState.page * pageSize);

  if (loading) {
    return <LoadingState description="A preparar o quadro operativo e os filtros da fila." title="Carregando pre-demandas" />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <>
            <Button onClick={() => updateView("kanban")} type="button" variant={resolvedState.view === "kanban" ? "primary" : "secondary"}>
              Quadro Kanban
            </Button>
            <Button onClick={() => updateView("table")} type="button" variant={resolvedState.view === "table" ? "primary" : "secondary"}>
              Tabela analitica
            </Button>
            <Button asChild>
              <Link to="/pre-demandas/nova">Nova demanda</Link>
            </Button>
          </>
        }
        description="Filtre, ordene e aja sobre a fila operacional sem sair do quadro principal."
        eyebrow="Fila operacional"
        title="Pre-demandas do Gestor"
      />

      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} value={item.total} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visualizacoes salvas</CardTitle>
          <CardDescription>Presets partilhaveis por query string para os filtros mais usados da operacao.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-6">
          {SAVED_VIEWS.map((preset) => (
            <button
              className={`grid gap-1 rounded-[22px] border px-4 py-4 text-left transition ${
                resolvedState.presetId === preset.id
                  ? "border-amber-300 bg-amber-50 text-amber-950 shadow-[0_12px_30px_rgba(217,119,6,0.12)]"
                  : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              type="button"
            >
              <span className="text-sm font-semibold">{preset.label}</span>
              <span className="text-xs text-slate-500">{preset.description}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <form onSubmit={handleFilterSubmit}>
        <FilterBar className="xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]">
          <FormField label="Buscar">
            <Input onChange={(event) => setQuery(event.target.value)} placeholder="PRE, solicitante ou assunto" value={query} />
          </FormField>

          <FormField hint="Multiplos estados." label="Status">
            <select className={selectClassName} multiple onChange={(event) => setSelectedStatuses(Array.from(event.target.selectedOptions, (option) => option.value))} value={selectedStatuses}>
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField hint="Acompanhe itens parados ou no prazo." label="Saude da fila">
            <select
              className={selectClassName}
              multiple
              onChange={(event) => setSelectedQueueHealth(Array.from(event.target.selectedOptions, (option) => option.value as QueueHealthLevel))}
              value={selectedQueueHealth}
            >
              {QUEUE_HEALTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Data inicial">
            <Input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
          </FormField>

          <FormField label="Data final">
            <Input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
          </FormField>

          <FormField label="Presenca de SEI">
            <select className={selectClassName} onChange={(event) => setHasSei(event.target.value as "" | "true" | "false")} value={hasSei}>
              <option value="">Todos</option>
              <option value="true">Com SEI</option>
              <option value="false">Sem SEI</option>
            </select>
          </FormField>

          <FormField label="Ordenacao">
            <select className={selectClassName} onChange={(event) => setSortBy(event.target.value as PreDemandaSortBy)} value={sortBy}>
              <option value="updatedAt">Actualizacao</option>
              <option value="createdAt">Criacao</option>
              <option value="dataReferencia">Data de referencia</option>
              <option value="solicitante">Solicitante</option>
              <option value="status">Status</option>
            </select>
          </FormField>

          <FormField label="Direcao">
            <select className={selectClassName} onChange={(event) => setSortOrder(event.target.value as SortOrder)} value={sortOrder}>
              <option value="desc">Mais recentes</option>
              <option value="asc">Mais antigas</option>
            </select>
          </FormField>

          <div className="flex items-end gap-3">
            <Button className="w-full" type="submit">
              Filtrar
            </Button>
            <Button onClick={clearFilters} type="button" variant="ghost">
              Limpar
            </Button>
          </div>
        </FilterBar>
      </form>

      {hiddenClosedCount > 0 ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 md:flex-row md:items-center">
          <p>
            {hiddenClosedCount} demanda{hiddenClosedCount > 1 ? "s" : ""} encerrada{hiddenClosedCount > 1 ? "s" : ""} corresponde{hiddenClosedCount > 1 ? "m" : ""} aos filtros, mas aparece{hiddenClosedCount > 1 ? "m" : ""} apenas na tabela analitica.
          </p>
          <Button onClick={() => updateView("table")} type="button" variant="secondary">
            Ver na tabela
          </Button>
        </div>
      ) : null}

      {resolvedState.view === "kanban" ? (
        <KanbanBoard
          items={items}
          onQuickAction={(item, action) => {
            if (action === "aguardando") {
              setQuickAction({ item, nextStatus: "aguardando_sei", label: "Marcar como aguardando SEI", requireReason: false });
              return;
            }

            if (action === "encerrar") {
              setQuickAction({ item, nextStatus: "encerrada", label: "Encerrar demanda", requireReason: true });
              return;
            }

            const reopenStatus = getPreferredReopenStatus(item);

            if (!reopenStatus) {
              return;
            }

            setQuickAction({
              item,
              nextStatus: reopenStatus,
              label: "Reabrir demanda",
              requireReason: true,
            });
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tabela analitica</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {items.length === 0 ? (
              <EmptyState description="Ajuste os filtros ou mude para outro preset para encontrar demandas nesta fila." title="Nenhuma demanda encontrada" />
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-3">PRE</th>
                  <th className="px-3 py-3">Solicitante</th>
                  <th className="px-3 py-3">Assunto</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Fila</th>
                  <th className="px-3 py-3">SEI</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Acoes</th>
                </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr className="border-t border-slate-200" key={item.preId}>
                      <td className="px-3 py-4 font-semibold text-slate-950">
                        <Link to={`/pre-demandas/${item.preId}`}>{item.preId}</Link>
                      </td>
                      <td className="px-3 py-4">{item.solicitante}</td>
                      <td className="px-3 py-4">{item.assunto}</td>
                      <td className="px-3 py-4">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="grid gap-2">
                          <QueueHealthPill item={item} />
                          <span className="text-xs text-slate-500">{getQueueHealth(item).detail}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4">{item.currentAssociation?.seiNumero ?? "-"}</td>
                      <td className="px-3 py-4">{new Date(item.dataReferencia).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="secondary">
                            <Link to={`/pre-demandas/${item.preId}`}>Detalhe</Link>
                          </Button>
                          {item.allowedNextStatuses.includes("aguardando_sei") ? (
                            <Button
                              onClick={() => setQuickAction({ item, nextStatus: "aguardando_sei", label: "Marcar como aguardando SEI", requireReason: false })}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Aguardar SEI
                            </Button>
                          ) : null}
                          {item.allowedNextStatuses.includes("encerrada") ? (
                            <Button onClick={() => setQuickAction({ item, nextStatus: "encerrada", label: "Encerrar demanda", requireReason: true })} size="sm" type="button" variant="ghost">
                              Encerrar
                            </Button>
                          ) : item.status === "encerrada" && getPreferredReopenStatus(item) ? (
                            <Button
                              onClick={() =>
                                setQuickAction({
                                  item,
                                  nextStatus: getPreferredReopenStatus(item)!,
                                  label: "Reabrir demanda",
                                  requireReason: true,
                                })
                              }
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Reabrir
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 sm:flex-row">
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
        description="Registe o motivo da alteracao de status para manter a trilha de auditoria operacional."
        onConfirm={async ({ motivo, observacoes }) => {
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
            });
            setMessage(`Demanda ${quickAction.item.preId} actualizada para ${getPreDemandaStatusLabel(quickAction.nextStatus)}.`);
            await load();
          } catch (nextError) {
            throw new Error(formatPreDemandaMutationError(nextError, "Falha ao atualizar a demanda."));
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
