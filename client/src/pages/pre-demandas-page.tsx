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
import { formatAppError, listPreDemandas, listSetores, updatePreDemandaStatus } from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { getPreferredReopenStatus, getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda, PreDemandaSortBy, PreDemandaStatus, QueueHealthLevel, Setor, SortOrder, StatusCount } from "../types";

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
type SavedViewId =
  | "fila-operacional"
  | "triagem-abertas"
  | "aguardando-sei"
  | "fila-parada"
  | "criticas"
  | "prazos-vencidos"
  | "vencem-na-semana"
  | "sem-envolvidos"
  | "sem-setor"
  | "com-sei"
  | "ultimas-encerradas";

type QuickAction = {
  item: PreDemanda;
  nextStatus: PreDemandaStatus;
  label: string;
  requireReason: boolean;
};

type SectorQueueSummary = {
  setorId: string | null;
  sigla: string;
  nome: string;
  total: number;
  overdue: number;
  dueSoon: number;
  criticalQueue: number;
  attentionQueue: number;
  withoutInteressados: number;
  riskLevel: "normal" | "attention" | "critical";
  riskScore: number;
};

type ResolvedSearchState = {
  presetId: SavedViewId | null;
  q: string;
  statuses: string[];
  queueHealth: QueueHealthLevel[];
  dateFrom: string;
  dateTo: string;
  hasSei: "" | "true" | "false";
  setorAtualId: string;
  withoutSetor: "" | "true" | "false";
  dueState: "" | "overdue" | "due_soon" | "none";
  hasInteressados: "" | "true" | "false";
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
    setorAtualId?: string;
    withoutSetor?: "" | "true" | "false";
    dueState?: "" | "overdue" | "due_soon" | "none";
    hasInteressados?: "" | "true" | "false";
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
      hasInteressados: "true",
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
    id: "criticas",
    label: "Criticas",
    description: "Demandas activas em risco maximo de fila, ordenadas pela actualizacao mais antiga.",
    defaults: {
      statuses: ["aberta", "aguardando_sei", "associada"],
      queueHealth: ["critical"],
      sortBy: "updatedAt",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "prazos-vencidos",
    label: "Prazos vencidos",
    description: "Casos activos com prazo final ja ultrapassado.",
    defaults: {
      statuses: ["aberta", "aguardando_sei", "associada"],
      dueState: "overdue",
      sortBy: "prazoFinal",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "vencem-na-semana",
    label: "Vencem na semana",
    description: "Demandas activas com prazo nos proximos 7 dias.",
    defaults: {
      statuses: ["aberta", "aguardando_sei", "associada"],
      dueState: "due_soon",
      sortBy: "prazoFinal",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "sem-envolvidos",
    label: "Sem envolvidos",
    description: "Casos activos que ainda precisam de envolvidos vinculados.",
    defaults: {
      statuses: ["aberta", "aguardando_sei", "associada"],
      hasInteressados: "false",
      sortBy: "updatedAt",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "sem-setor",
    label: "Sem setor",
    description: "Casos activos ainda sem setor formalmente definido.",
    defaults: {
      statuses: ["aberta", "aguardando_sei", "associada"],
      withoutSetor: "true",
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

function buildSectorQueueSearch(current: URLSearchParams, setorAtualId: string, dueState: "" | "overdue" | "due_soon" | "none") {
  const next = new URLSearchParams(current);
  next.set("setorAtualId", setorAtualId);
  next.set("view", "table");
  next.set("page", "1");
  next.set("sortBy", "updatedAt");
  next.set("sortOrder", dueState === "overdue" ? "asc" : "desc");

  if (dueState) {
    next.set("dueState", dueState);
  } else {
    next.delete("dueState");
  }

  return `/pre-demandas?${next.toString()}`;
}

function buildQueueSearch(current: URLSearchParams, overrides: Record<string, string | null>) {
  const next = new URLSearchParams(current);

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === null || value === "") {
      next.delete(key);
      return;
    }

    next.set(key, value);
  });

  next.set("page", "1");
  return `/pre-demandas?${next.toString()}`;
}

function getSectorRiskLevel(score: number) {
  if (score >= 8) {
    return "critical" as const;
  }

  if (score >= 4) {
    return "attention" as const;
  }

  return "normal" as const;
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
    setorAtualId: searchParams.get("setorAtualId") ?? preset?.defaults.setorAtualId ?? "",
    withoutSetor: searchParams.has("withoutSetor") ? ((searchParams.get("withoutSetor") as "true" | "false") ?? "") : preset?.defaults.withoutSetor ?? "",
    dueState: searchParams.has("dueState") ? ((searchParams.get("dueState") as "overdue" | "due_soon" | "none") ?? "") : preset?.defaults.dueState ?? "",
    hasInteressados: searchParams.has("hasInteressados") ? ((searchParams.get("hasInteressados") as "true" | "false") ?? "") : preset?.defaults.hasInteressados ?? "",
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
  const [setores, setSetores] = useState<Setor[]>([]);
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
  const [setorAtualId, setSetorAtualId] = useState(resolvedState.setorAtualId);
  const [withoutSetor, setWithoutSetor] = useState(resolvedState.withoutSetor);
  const [dueState, setDueState] = useState(resolvedState.dueState);
  const [hasInteressados, setHasInteressados] = useState(resolvedState.hasInteressados);
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
    setSetorAtualId(resolvedState.setorAtualId);
    setWithoutSetor(resolvedState.withoutSetor);
    setDueState(resolvedState.dueState);
    setHasInteressados(resolvedState.hasInteressados);
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
        setorAtualId: resolvedState.setorAtualId || undefined,
        withoutSetor: resolvedState.withoutSetor ? resolvedState.withoutSetor === "true" : undefined,
        dueState: resolvedState.dueState || undefined,
        hasInteressados: resolvedState.hasInteressados ? resolvedState.hasInteressados === "true" : undefined,
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

    if (setorAtualId) {
      next.set("setorAtualId", setorAtualId);
    }

    if (withoutSetor) {
      next.set("withoutSetor", withoutSetor);
    }

    if (dueState) {
      next.set("dueState", dueState);
    }

    if (hasInteressados) {
      next.set("hasInteressados", hasInteressados);
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
    setSetorAtualId("");
    setWithoutSetor("");
    setDueState("");
    setHasInteressados("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setSearchParams(new URLSearchParams({ view: resolvedState.view, page: "1", sortBy: "updatedAt", sortOrder: "desc" }));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const metrics = useMemo(() => counts, [counts]);
  const hiddenClosedCount = useMemo(() => (resolvedState.view === "kanban" ? items.filter((item) => item.status === "encerrada").length : 0), [items, resolvedState.view]);
  const selectedSetor = useMemo(() => setores.find((item) => item.id === resolvedState.setorAtualId) ?? null, [resolvedState.setorAtualId, setores]);
  const sectorSummaries = useMemo<SectorQueueSummary[]>(() => {
    const groups = new Map<string, SectorQueueSummary>();

    for (const item of items) {
      const key = item.setorAtual?.id ?? "__sem_setor__";
      const current =
        groups.get(key) ??
        {
          setorId: item.setorAtual?.id ?? null,
          sigla: item.setorAtual?.sigla ?? "Sem setor",
          nome: item.setorAtual?.nomeCompleto ?? "Demandas ainda sem setor definido.",
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

      if (item.prazoFinal) {
        const dueDate = new Date(item.prazoFinal);
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
        id: "criticas",
        label: "Criticas",
        description: "Fila com maior risco operativo e actualizacao mais antiga primeiro.",
        value: items.filter((item) => item.queueHealth.level === "critical").length,
        href: "/pre-demandas?preset=criticas",
      },
      {
        id: "vencidas",
        label: "Prazos vencidos",
        description: "Demandas activas com prazo final ja ultrapassado.",
        value: items.filter((item) => item.prazoFinal && new Date(`${item.prazoFinal}T00:00:00`).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
        href: "/pre-demandas?preset=prazos-vencidos",
      },
      {
        id: "na-semana",
        label: "Vencem na semana",
        description: "Demandas activas que exigem seguimento antes do prazo final.",
        value: items.filter((item) => {
          if (!item.prazoFinal) {
            return false;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(`${item.prazoFinal}T00:00:00`);
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
          <CardTitle>Grupos rapidos</CardTitle>
          <CardDescription>Recortes operacionais prontos para accao imediata dentro da fila actual.</CardDescription>
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
            <CardDescription>Resumo dos setores mais pressionados dentro do recorte atual da fila, para trocar rapidamente de contexto sem voltar ao painel admin.</CardDescription>
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
                      <Link
                        to={`/pre-demandas?${new URLSearchParams({
                          ...Object.fromEntries(searchParams),
                          view: "table",
                          page: "1",
                          hasInteressados: "false",
                          dueState: sector.overdue > 0 ? "overdue" : "",
                        }).toString()}`}
                      >
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
            <CardTitle>Contexto operativo</CardTitle>
            <CardDescription>
              A fila esta focada no setor {selectedSetor.sigla}. Use os atalhos para alternar rapidamente entre todos os itens, vencidos e proximos do prazo.
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
        <FilterBar className="xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]">
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

          <FormField label="Setor actual">
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
            <select className={selectClassName} onChange={(event) => setDueState(event.target.value as "" | "overdue" | "due_soon" | "none")} value={dueState}>
              <option value="">Todos</option>
              <option value="overdue">Vencido</option>
              <option value="due_soon">Na semana</option>
              <option value="none">Sem prazo</option>
            </select>
          </FormField>

          <FormField label="Envolvidos">
            <select className={selectClassName} onChange={(event) => setHasInteressados(event.target.value as "" | "true" | "false")} value={hasInteressados}>
              <option value="">Todos</option>
              <option value="true">Com envolvidos</option>
              <option value="false">Sem envolvidos</option>
            </select>
          </FormField>

          <FormField label="Ordenacao">
            <select className={selectClassName} onChange={(event) => setSortBy(event.target.value as PreDemandaSortBy)} value={sortBy}>
              <option value="updatedAt">Actualizacao</option>
              <option value="createdAt">Criacao</option>
              <option value="dataReferencia">Data de referencia</option>
              <option value="solicitante">Solicitante</option>
              <option value="status">Status</option>
              <option value="prazoFinal">Prazo final</option>
              <option value="numeroJudicial">Numero judicial</option>
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
          sectorRiskById={sectorRiskById}
          selectedSetorId={resolvedState.setorAtualId}
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
                  <th className="px-3 py-3">Setor</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Fila</th>
                  <th className="px-3 py-3">Prazo</th>
                  <th className="px-3 py-3">SEI</th>
                  <th className="px-3 py-3">Envolvidos</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Acoes</th>
                </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      className={`border-t ${
                        item.setorAtual?.id && sectorRiskById[item.setorAtual.id] === "critical"
                          ? "border-rose-200 bg-rose-50/40"
                          : item.setorAtual?.id && sectorRiskById[item.setorAtual.id] === "attention"
                            ? "border-amber-200 bg-amber-50/40"
                            : "border-slate-200"
                      }`}
                      key={item.preId}
                    >
                      <td className="px-3 py-4 font-semibold text-slate-950">
                        <Link to={`/pre-demandas/${item.preId}`}>{item.preId}</Link>
                      </td>
                      <td className="px-3 py-4">{item.solicitante}</td>
                      <td className="px-3 py-4">{item.assunto}</td>
                      <td className="px-3 py-4">
                        <div className="grid gap-1">
                          <span>{item.setorAtual ? item.setorAtual.sigla : "-"}</span>
                          {item.setorAtual?.id && sectorRiskById[item.setorAtual.id] !== "normal" ? (
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {sectorRiskById[item.setorAtual.id] === "critical" ? "Setor critico" : "Setor em atencao"}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="grid gap-2">
                          <QueueHealthPill item={item} />
                          <span className="text-xs text-slate-500">{getQueueHealth(item).detail}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4">{item.prazoFinal ? new Date(item.prazoFinal).toLocaleDateString("pt-BR") : "-"}</td>
                      <td className="px-3 py-4">{item.currentAssociation?.seiNumero ?? "-"}</td>
                      <td className="px-3 py-4">{item.interessados.length}</td>
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
