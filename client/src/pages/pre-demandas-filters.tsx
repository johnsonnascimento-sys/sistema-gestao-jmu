import { FormEvent, useEffect, useState } from "react";
import { FilterBar } from "../components/filter-bar";
import { FormField } from "../components/form-field";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import type { PreDemandaSortBy, QueueHealthLevel, Setor, SortOrder } from "../types";
import {
  ResolvedSearchState,
  SAVED_VIEWS,
  SavedViewId,
  STATUSES,
  getSavedView,
  selectClassName,
} from "./pre-demandas-utils";

export function PreDemandasFilters({
  resolvedState,
  setores,
  searchParams,
  setSearchParams,
}: {
  resolvedState: ResolvedSearchState;
  setores: Setor[];
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
}) {
  const [query, setQuery] = useState(resolvedState.q);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(resolvedState.statuses);
  const [selectedQueueHealthKey, setSelectedQueueHealthKey] = useState("all");
  const [dateFrom, setDateFrom] = useState(resolvedState.dateFrom);
  const [dateTo, setDateTo] = useState(resolvedState.dateTo);
  const [hasSei, setHasSei] = useState(resolvedState.hasSei);
  const [setorAtualId, setSetorAtualId] = useState(resolvedState.setorAtualId);
  const [withoutSetor, setWithoutSetor] = useState(resolvedState.withoutSetor);
  const [dueState, setDueState] = useState(resolvedState.dueState);
  const [deadlineCampo, setDeadlineCampo] = useState(resolvedState.deadlineCampo);
  const [prazoRecorte, setPrazoRecorte] = useState(resolvedState.prazoRecorte);
  const [paymentInvolved, setPaymentInvolved] = useState(resolvedState.paymentInvolved);
  const [hasInteressados, setHasInteressados] = useState(resolvedState.hasInteressados);
  const [closedWithinDays, setClosedWithinDays] = useState(resolvedState.closedWithinDays);
  const [reopenedWithinDays, setReopenedWithinDays] = useState(resolvedState.reopenedWithinDays);
  const [sortBy, setSortBy] = useState<PreDemandaSortBy>(resolvedState.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(resolvedState.sortOrder);

  function resolveQueueHealthKey(queueHealth: QueueHealthLevel[]) {
    const normalized = [...queueHealth].sort().join(",");
    if (!normalized) return "all";
    if (normalized === "fresh") return "fresh";
    if (normalized === "attention") return "attention";
    if (normalized === "critical") return "critical";
    if (normalized === "attention,critical") return "attention,critical";
    return "all";
  }

  function resolveQueueHealthValues(key: string) {
    if (key === "fresh") return ["fresh"] as QueueHealthLevel[];
    if (key === "attention") return ["attention"] as QueueHealthLevel[];
    if (key === "critical") return ["critical"] as QueueHealthLevel[];
    if (key === "attention,critical") return ["attention", "critical"] as QueueHealthLevel[];
    return [] as QueueHealthLevel[];
  }

  useEffect(() => {
    setQuery(resolvedState.q);
    setSelectedStatuses(resolvedState.statuses);
    setSelectedQueueHealthKey(resolveQueueHealthKey(resolvedState.queueHealth));
    setDateFrom(resolvedState.dateFrom);
    setDateTo(resolvedState.dateTo);
    setHasSei(resolvedState.hasSei);
    setSetorAtualId(resolvedState.setorAtualId);
    setWithoutSetor(resolvedState.withoutSetor);
    setDueState(resolvedState.dueState);
    setDeadlineCampo(resolvedState.deadlineCampo);
    setPrazoRecorte(resolvedState.prazoRecorte);
    setPaymentInvolved(resolvedState.paymentInvolved);
    setHasInteressados(resolvedState.hasInteressados);
    setClosedWithinDays(resolvedState.closedWithinDays);
    setReopenedWithinDays(resolvedState.reopenedWithinDays);
    setSortBy(resolvedState.sortBy);
    setSortOrder(resolvedState.sortOrder);
  }, [resolvedState]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();

    if (query.trim()) next.set("q", query.trim());
    if (selectedStatuses.length) next.set("status", selectedStatuses.join(","));
    const selectedQueueHealth = resolveQueueHealthValues(selectedQueueHealthKey);
    if (selectedQueueHealth.length) next.set("queueHealth", selectedQueueHealth.join(","));
    if (dateFrom) next.set("dateFrom", dateFrom);
    if (dateTo) next.set("dateTo", dateTo);
    if (hasSei) next.set("hasSei", hasSei);
    if (setorAtualId) next.set("setorAtualId", setorAtualId);
    if (withoutSetor) next.set("withoutSetor", withoutSetor);
    if (dueState) next.set("dueState", dueState);
    if (deadlineCampo) next.set("deadlineCampo", deadlineCampo);
    if (prazoRecorte) next.set("prazoRecorte", prazoRecorte);
    if (paymentInvolved) next.set("paymentInvolved", paymentInvolved);
    if (hasInteressados) next.set("hasInteressados", hasInteressados);
    if (closedWithinDays) next.set("closedWithinDays", closedWithinDays);
    if (reopenedWithinDays) next.set("reopenedWithinDays", reopenedWithinDays);

    next.set("sortBy", sortBy);
    next.set("sortOrder", sortOrder);
    next.set("view", resolvedState.view);
    next.set("page", "1");
    setSearchParams(next);
  }

  function applyPreset(presetId: SavedViewId) {
    const preset = getSavedView(presetId);
    if (!preset) return;
    const next = new URLSearchParams();
    next.set("preset", presetId);
    next.set("view", preset.defaults.view);
    next.set("page", "1");
    setSearchParams(next);
  }

  function clearFilters() {
    setQuery("");
    setSelectedStatuses([]);
    setSelectedQueueHealthKey("all");
    setDateFrom("");
    setDateTo("");
    setHasSei("");
    setSetorAtualId("");
    setWithoutSetor("");
    setDueState("");
    setDeadlineCampo("");
    setPrazoRecorte("");
    setPaymentInvolved("");
    setHasInteressados("");
    setClosedWithinDays("");
    setReopenedWithinDays("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setSearchParams(new URLSearchParams({ view: resolvedState.view, page: "1", sortBy: "updatedAt", sortOrder: "desc" }));
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Visualizacoes salvas</CardTitle>
          <CardDescription>Presets compartilhaveis por query string para os filtros mais usados da operacao.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-6">
          {SAVED_VIEWS.map((preset) => (
            <button
              className={`grid gap-1 rounded-[22px] border px-4 py-4 text-left transition ${
                resolvedState.presetId === preset.id
                  ? "border-sky-300 bg-[linear-gradient(180deg,rgba(219,234,254,0.95),rgba(240,249,255,0.92))] text-sky-950 shadow-[0_14px_32px_rgba(14,165,233,0.12)]"
                  : "border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(247,241,233,0.78))] text-slate-700 shadow-[0_12px_24px_rgba(20,33,61,0.05)] hover:border-sky-200 hover:bg-white"
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
        <FilterBar className="xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]">
          <FormField label="Buscar">
            <Input onChange={(event) => setQuery(event.target.value)} placeholder="PROCESSO, SEI, pessoa ou assunto" value={query} />
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

          <FormField hint="Baseado na ultima movimentacao do processo." label="Situacao da fila">
            <select className={selectClassName} onChange={(event) => setSelectedQueueHealthKey(event.target.value)} value={selectedQueueHealthKey}>
              <option value="all">Todos</option>
              <option value="fresh">Estavel</option>
              <option value="attention">Em observacao</option>
              <option value="critical">Em risco</option>
              <option value="attention,critical">Em observacao + Em risco</option>
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

          <FormField label="Setor atual">
            <select className={selectClassName} onChange={(event) => setSetorAtualId(event.target.value)} value={setorAtualId}>
              <option value="">Todos</option>
              {setores.map((setor) => (
                <option key={setor.id} value={setor.id}>
                  {setor.sigla}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Sem setor">
            <select className={selectClassName} onChange={(event) => setWithoutSetor(event.target.value as "" | "true" | "false")} value={withoutSetor}>
              <option value="">Todos</option>
              <option value="true">Apenas sem setor</option>
              <option value="false">Apenas com setor</option>
            </select>
          </FormField>

          <FormField label="Prazo">
            <select className={selectClassName} onChange={(event) => setDueState(event.target.value as "" | "overdue" | "due_today" | "due_soon" | "none")} value={dueState}>
              <option value="">Todos</option>
              <option value="overdue">Vencido</option>
              <option value="due_today">Vence hoje</option>
              <option value="due_soon">Na semana</option>
              <option value="none">Sem prazo</option>
            </select>
          </FormField>

          <FormField label="Pessoa">
            <select className={selectClassName} onChange={(event) => setHasInteressados(event.target.value as "" | "true" | "false")} value={hasInteressados}>
              <option value="">Todos</option>
              <option value="true">Com pessoa</option>
              <option value="false">Sem pessoa</option>
            </select>
          </FormField>

          <FormField label="Ordenacao">
            <select className={selectClassName} onChange={(event) => setSortBy(event.target.value as PreDemandaSortBy)} value={sortBy}>
              <option value="updatedAt">Atualizacao</option>
              <option value="createdAt">Criacao</option>
              <option value="dataReferencia">Data de referencia</option>
              <option value="solicitante">Pessoa vinculada</option>
              <option value="status">Status</option>
              <option value="prazoProcesso">Prazo do processo</option>
              <option value="proximoPrazoTarefa">Proxima tarefa</option>
              <option value="numeroJudicial">Numero judicial</option>
            </select>
          </FormField>

          <FormField label="Direcao">
            <select className={selectClassName} onChange={(event) => setSortOrder(event.target.value as SortOrder)} value={sortOrder}>
              <option value="desc">Mais recentes</option>
              <option value="asc">Mais antigas</option>
            </select>
          </FormField>

          <div className="flex items-end">
            <Button className="w-full" type="submit">
              Aplicar
            </Button>
          </div>
        </FilterBar>

        <div className="mt-3 flex justify-end">
          <Button onClick={clearFilters} type="button" variant="ghost">
            Limpar filtros
          </Button>
        </div>
      </form>
    </>
  );
}
