import type {
  PreDemanda,
  PreDemandaSortBy,
  PreDemandaStatus,
  QueueHealthLevel,
  SortOrder,
  TarefaRecorrenciaTipo,
} from "../types";

export const STATUSES: Array<{ value: PreDemandaStatus; label: string }> = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_sei", label: "Aguardando SEI" },
  { value: "encerrada", label: "Encerrado" },
];

export const QUEUE_HEALTH_OPTIONS: Array<{ value: QueueHealthLevel; label: string }> = [
  { value: "fresh", label: "Estavel" },
  { value: "attention", label: "Em observacao" },
  { value: "critical", label: "Em risco" },
];

export const TASK_RECURRENCE_OPTIONS: Array<{ value: TarefaRecorrenciaTipo | "sem_recorrencia"; label: string }> = [
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "sem_recorrencia", label: "Sem recorrência" },
];

export const selectClassName =
  "h-11 w-full rounded-2xl border border-sky-100/90 bg-white/95 px-4 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-sky-200/55";

export type BoardView = "table";
export type SavedViewId =
  | "fila-operacional"
  | "triagem-em-andamento"
  | "aguardando-sei"
  | "fila-parada"
  | "em-risco"
  | "vence-hoje"
  | "prazos-vencidos"
  | "vencem-na-semana"
  | "com-pagamento"
  | "sem-envolvidos"
  | "sem-setor"
  | "tarefas-diarias"
  | "tarefas-semanais"
  | "tarefas-mensais"
  | "sem-recorrencia"
  | "reabertas-30d"
  | "encerradas-30d"
  | "com-sei"
  | "ultimas-encerradas";

export type QuickAction = {
  item: PreDemanda;
  nextStatus: PreDemandaStatus;
  label: string;
  requireReason: boolean;
};

export type SectorQueueSummary = {
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

export type ResolvedSearchState = {
  presetId: SavedViewId | null;
  q: string;
  statuses: string[];
  queueHealth: QueueHealthLevel[];
  dateFrom: string;
  dateTo: string;
  hasSei: "" | "true" | "false";
  setorAtualId: string;
  withoutSetor: "" | "true" | "false";
  dueState: "" | "overdue" | "due_today" | "due_soon" | "none";
  deadlineCampo: "" | "prazoProcesso" | "proximoPrazoTarefa";
  prazoRecorte: "" | "overdue" | "today" | "soon";
  taskRecurrence: "" | TarefaRecorrenciaTipo | "sem_recorrencia";
  paymentInvolved: "" | "true" | "false";
  hasInteressados: "" | "true" | "false";
  closedWithinDays: string;
  reopenedWithinDays: string;
  sortBy: PreDemandaSortBy;
  sortOrder: SortOrder;
  page: number;
  view: BoardView;
};

export const SAVED_VIEWS: Array<{
  id: SavedViewId;
  label: string;
  description: string;
  defaults: {
    statuses?: string[];
    queueHealth?: QueueHealthLevel[];
    hasSei?: "" | "true" | "false";
    setorAtualId?: string;
    withoutSetor?: "" | "true" | "false";
    dueState?: "" | "overdue" | "due_today" | "due_soon" | "none";
    taskRecurrence?: "" | TarefaRecorrenciaTipo | "sem_recorrencia";
    paymentInvolved?: "" | "true" | "false";
    hasInteressados?: "" | "true" | "false";
    closedWithinDays?: string;
    reopenedWithinDays?: string;
    sortBy: PreDemandaSortBy;
    sortOrder: SortOrder;
    view: BoardView;
  };
}> = [
  {
    id: "fila-operacional",
    label: "Fila operacional",
    description: "Processos em andamento e aguardando SEI no quadro principal.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      hasInteressados: "true",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "triagem-em-andamento",
    label: "Em andamento",
    description: "Processos em andamento, ordenados pela referencia mais antiga.",
    defaults: {
      statuses: ["em_andamento"],
      sortBy: "dataReferencia",
      sortOrder: "asc",
      view: "table",
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
    description: "Processos ativos com maior tempo sem movimentacao, ordenados pela atualizacao mais antiga.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      queueHealth: ["attention", "critical"],
      sortBy: "updatedAt",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "em-risco",
    label: "Em risco",
    description: "Processos ativos em risco maximo de fila, ordenados pela atualizacao mais antiga.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      queueHealth: ["critical"],
      sortBy: "updatedAt",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "vence-hoje",
    label: "Vence hoje",
    description: "Processos ativos com prazo final vencendo hoje.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      dueState: "due_today",
      sortBy: "prazoProcesso",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "prazos-vencidos",
    label: "Prazos vencidos",
    description: "Processos ativos com prazo final ja ultrapassado.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      dueState: "overdue",
      sortBy: "prazoProcesso",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "vencem-na-semana",
    label: "Vencem na semana",
    description: "Processos ativos com prazo nos proximos 7 dias.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      dueState: "due_soon",
      sortBy: "prazoProcesso",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "com-pagamento",
    label: "Com pagamento",
    description: "Processos com pagamento envolvido marcado no cadastro.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      paymentInvolved: "true",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "sem-envolvidos",
    label: "Sem envolvidos",
    description: "Processos ativos que ainda precisam de envolvidos vinculados.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      hasInteressados: "false",
      sortBy: "updatedAt",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "sem-setor",
    label: "Sem setor",
    description: "Processos ativos ainda sem setor formalmente definido.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      withoutSetor: "true",
      sortBy: "updatedAt",
      sortOrder: "asc",
      view: "table",
    },
  },
  {
    id: "tarefas-diarias",
    label: "Tarefas diárias",
    description: "Processos com pelo menos uma tarefa recorrente diária.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      taskRecurrence: "diaria",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "tarefas-semanais",
    label: "Tarefas semanais",
    description: "Processos com pelo menos uma tarefa recorrente semanal.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      taskRecurrence: "semanal",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "tarefas-mensais",
    label: "Tarefas mensais",
    description: "Processos com pelo menos uma tarefa recorrente mensal.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      taskRecurrence: "mensal",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "sem-recorrencia",
    label: "Sem recorrência",
    description: "Processos sem nenhuma tarefa recorrente.",
    defaults: {
      statuses: ["em_andamento", "aguardando_sei"],
      taskRecurrence: "sem_recorrencia",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "reabertas-30d",
    label: "Reabertas 30d",
    description: "Processos com reabertura registrada nos ultimos 30 dias.",
    defaults: {
      reopenedWithinDays: "30",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "encerradas-30d",
    label: "Encerradas 30d",
    description: "Processos com encerramento registrado nos ultimos 30 dias.",
    defaults: {
      closedWithinDays: "30",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "com-sei",
    label: "Com SEI",
    description: "Processos que ja possuem vinculacao valida.",
    defaults: {
      hasSei: "true",
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
  {
    id: "ultimas-encerradas",
    label: "Ultimos encerrados",
    description: "Fechamentos mais recentes para revisao ou conferencias.",
    defaults: {
      statuses: ["encerrada"],
      sortBy: "updatedAt",
      sortOrder: "desc",
      view: "table",
    },
  },
];

export function splitValues(value: string | null) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

export function getSavedView(presetId: string | null) {
  const normalizedPresetId = presetId === "triagem-abertas" ? "triagem-em-andamento" : presetId;
  return SAVED_VIEWS.find((item) => item.id === normalizedPresetId) ?? null;
}

export function buildSectorQueueSearch(current: URLSearchParams, setorAtualId: string, dueState: "" | "overdue" | "due_today" | "due_soon" | "none") {
  const next = new URLSearchParams(current);
  next.set("setorAtualId", setorAtualId);
  next.delete("withoutSetor");
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

export function buildWithoutSetorQueueSearch(current: URLSearchParams, dueState: "" | "overdue" | "due_today" | "due_soon" | "none", hasInteressados: "" | "true" | "false" = "") {
  const next = new URLSearchParams(current);
  next.delete("setorAtualId");
  next.set("withoutSetor", "true");
  next.set("view", "table");
  next.set("page", "1");
  next.set("sortBy", dueState ? "prazoProcesso" : "updatedAt");
  next.set("sortOrder", dueState === "overdue" ? "asc" : "desc");

  if (dueState) {
    next.set("dueState", dueState);
  } else {
    next.delete("dueState");
  }

  if (hasInteressados) {
    next.set("hasInteressados", hasInteressados);
  } else {
    next.delete("hasInteressados");
  }

  return `/pre-demandas?${next.toString()}`;
}

export function buildQueueSearch(current: URLSearchParams, overrides: Record<string, string | null>) {
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

export function getSectorRiskLevel(score: number) {
  if (score >= 8) {
    return "critical" as const;
  }

  if (score >= 4) {
    return "attention" as const;
  }

  return "normal" as const;
}

export function resolveSearchState(searchParams: URLSearchParams): ResolvedSearchState {
  const preset = getSavedView(searchParams.get("preset"));
  const hasExplicitView = searchParams.has("view");
  const isBlankSearch =
    !searchParams.get("preset") &&
    !searchParams.has("q") &&
    !searchParams.has("status") &&
    !searchParams.has("queueHealth") &&
    !searchParams.has("dateFrom") &&
    !searchParams.has("dateTo") &&
    !searchParams.has("hasSei") &&
    !searchParams.has("setorAtualId") &&
    !searchParams.has("withoutSetor") &&
    !searchParams.has("dueState") &&
    !searchParams.has("deadlineCampo") &&
    !searchParams.has("prazoRecorte") &&
    !searchParams.has("taskRecurrence") &&
    !searchParams.has("paymentInvolved") &&
    !searchParams.has("hasInteressados") &&
    !searchParams.has("closedWithinDays") &&
    !searchParams.has("reopenedWithinDays") &&
    !searchParams.has("sortBy") &&
    !searchParams.has("sortOrder") &&
    !searchParams.has("page");
  const defaultView: BoardView = "table";

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
    dueState: searchParams.has("dueState") ? ((searchParams.get("dueState") as "overdue" | "due_today" | "due_soon" | "none") ?? "") : preset?.defaults.dueState ?? "",
    deadlineCampo: (searchParams.get("deadlineCampo") as ResolvedSearchState["deadlineCampo"] | null) ?? "",
    prazoRecorte: (searchParams.get("prazoRecorte") as ResolvedSearchState["prazoRecorte"] | null) ?? "",
    taskRecurrence: (searchParams.get("taskRecurrence") as ResolvedSearchState["taskRecurrence"] | null) ?? "",
    paymentInvolved: searchParams.has("paymentInvolved") ? ((searchParams.get("paymentInvolved") as "true" | "false") ?? "") : preset?.defaults.paymentInvolved ?? "",
    hasInteressados: searchParams.has("hasInteressados") ? ((searchParams.get("hasInteressados") as "true" | "false") ?? "") : preset?.defaults.hasInteressados ?? "",
    closedWithinDays: searchParams.get("closedWithinDays") ?? preset?.defaults.closedWithinDays ?? "",
    reopenedWithinDays: searchParams.get("reopenedWithinDays") ?? preset?.defaults.reopenedWithinDays ?? "",
    sortBy: (searchParams.get("sortBy") as PreDemandaSortBy | null) ?? preset?.defaults.sortBy ?? "updatedAt",
    sortOrder: (searchParams.get("sortOrder") as SortOrder | null) ?? preset?.defaults.sortOrder ?? "desc",
    page: Number(searchParams.get("page") ?? "1"),
    view: "table",
  };
}
