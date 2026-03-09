import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FilterBar } from "../components/filter-bar";
import { FormField } from "../components/form-field";
import { KanbanBoard } from "../components/kanban-board";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { listPreDemandas, updatePreDemandaStatus } from "../lib/api";
import type { PreDemanda, PreDemandaSortBy, PreDemandaStatus, SortOrder, StatusCount } from "../types";

const STATUSES: Array<{ value: PreDemandaStatus; label: string }> = [
  { value: "aberta", label: "Aberta" },
  { value: "aguardando_sei", label: "Aguardando SEI" },
  { value: "associada", label: "Associada" },
  { value: "encerrada", label: "Encerrada" },
];

const selectClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-amber-200/50";

type QuickAction = {
  item: PreDemanda;
  nextStatus: PreDemandaStatus;
  label: string;
  requireReason: boolean;
};

export function PreDemandasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PreDemanda[]>([]);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(searchParams.get("status")?.split(",").filter(Boolean) ?? []);
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
  const [hasSei, setHasSei] = useState(searchParams.get("hasSei") ?? "");
  const [sortBy, setSortBy] = useState<PreDemandaSortBy>((searchParams.get("sortBy") as PreDemandaSortBy) ?? "updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>((searchParams.get("sortOrder") as SortOrder) ?? "desc");

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 12;
  const view = searchParams.get("view") === "table" ? "table" : "kanban";

  async function load() {
    setLoading(true);

    try {
      const response = await listPreDemandas({
        q: searchParams.get("q") ?? "",
        status: searchParams.get("status")?.split(",").filter(Boolean) ?? [],
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
        hasSei: searchParams.get("hasSei") ? searchParams.get("hasSei") === "true" : undefined,
        sortBy: (searchParams.get("sortBy") as PreDemandaSortBy | null) ?? "updatedAt",
        sortOrder: (searchParams.get("sortOrder") as SortOrder | null) ?? "desc",
        page,
        pageSize,
      });

      setItems(response.items);
      setCounts(response.counts);
      setTotal(response.total);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Falha ao carregar pre-demandas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, searchParams]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();

    if (query.trim()) {
      next.set("q", query.trim());
    }

    if (selectedStatuses.length) {
      next.set("status", selectedStatuses.join(","));
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
    next.set("view", view);
    next.set("page", "1");
    setSearchParams(next);
  }

  function updateView(nextView: "kanban" | "table") {
    const next = new URLSearchParams(searchParams);
    next.set("view", nextView);
    setSearchParams(next);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const metrics = useMemo(() => counts, [counts]);

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
            <Button onClick={() => updateView("kanban")} type="button" variant={view === "kanban" ? "primary" : "secondary"}>
              Quadro Kanban
            </Button>
            <Button onClick={() => updateView("table")} type="button" variant={view === "table" ? "primary" : "secondary"}>
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

      <form onSubmit={handleFilterSubmit}>
        <FilterBar className="xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]">
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

            <FormField label="Data inicial">
              <Input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
            </FormField>

            <FormField label="Data final">
              <Input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
            </FormField>

            <FormField label="Presenca de SEI">
              <select className={selectClassName} onChange={(event) => setHasSei(event.target.value)} value={hasSei}>
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
              <Button
                onClick={() => {
                  setQuery("");
                  setSelectedStatuses([]);
                  setDateFrom("");
                  setDateTo("");
                  setHasSei("");
                  setSortBy("updatedAt");
                  setSortOrder("desc");
                  setSearchParams(new URLSearchParams({ view, page: "1", sortBy: "updatedAt", sortOrder: "desc" }));
                }}
                type="button"
                variant="ghost"
              >
                Limpar
              </Button>
            </div>
        </FilterBar>
      </form>

      {view === "kanban" ? (
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

            setQuickAction({
              item,
              nextStatus: item.currentAssociation ? "associada" : "aberta",
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
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-3">PRE</th>
                  <th className="px-3 py-3">Solicitante</th>
                  <th className="px-3 py-3">Assunto</th>
                  <th className="px-3 py-3">Status</th>
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
                    <td className="px-3 py-4">{item.currentAssociation?.seiNumero ?? "-"}</td>
                    <td className="px-3 py-4">{new Date(item.dataReferencia).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link to={`/pre-demandas/${item.preId}`}>Detalhe</Link>
                        </Button>
                        {item.status !== "encerrada" ? (
                          <Button onClick={() => setQuickAction({ item, nextStatus: "encerrada", label: "Encerrar demanda", requireReason: true })} size="sm" type="button" variant="ghost">
                            Encerrar
                          </Button>
                        ) : (
                          <Button
                            onClick={() =>
                              setQuickAction({
                                item,
                                nextStatus: item.currentAssociation ? "associada" : "aberta",
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
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 sm:flex-row">
        <span>
          Pagina {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1}
            onClick={() => setSearchParams(new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) }))}
            type="button"
            variant="secondary"
          >
            Anterior
          </Button>
          <Button
            disabled={page >= totalPages}
            onClick={() => setSearchParams(new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) }))}
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

          await updatePreDemandaStatus(quickAction.item.preId, {
            status: quickAction.nextStatus,
            motivo,
            observacoes,
          });
          setMessage(`Demanda ${quickAction.item.preId} actualizada para ${quickAction.nextStatus.replace("_", " ")}.`);
          await load();
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
