import type { OperationalEvent, OperationsIncident } from "../types";

export function formatUptime(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

export function describeIncident(incident: OperationsIncident) {
  switch (incident.kind) {
    case "auth_failure":
      return "Falha de autenticacao ou autorizacao.";
    case "database_readiness_failure":
      return "Falha na verificacao de prontidao do banco.";
    case "server_error":
      return "Erro interno registrado pela aplicacao.";
    default:
      return "Incidente operacional.";
  }
}

export function describeOperationalEvent(event: OperationalEvent) {
  switch (event.kind) {
    case "backup":
      return "Backup";
    case "restore":
      return "Restore";
    case "restore_drill":
      return "Drill de restore";
    case "deploy":
      return "Deploy";
    case "rollback":
      return "Rollback";
    case "monitor":
      return "Monitoracao";
    case "bootstrap_audit":
      return "Auditoria de bootstrap";
    default:
      return "Operacao";
  }
}

export function describeOperationalEventKind(kind: OperationalEvent["kind"]) {
  return describeOperationalEvent({
    id: kind,
    kind,
    status: "success",
    source: "",
    message: "",
    reference: null,
    occurredAt: new Date().toISOString(),
  });
}

export function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

export function deltaTone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-500";
}

export function riskTone(level: "normal" | "attention" | "critical") {
  if (level === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (level === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function freshnessTone(level: "fresh" | "attention" | "critical" | "unknown") {
  if (level === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (level === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (level === "fresh") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function sectionCardClass(active: boolean) {
  return active ? "border-sky-300 bg-sky-50/70 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]" : undefined;
}

export function formatEventMoment(value: string | null) {
  if (!value) {
    return "Nao registrado";
  }

  return new Date(value).toLocaleString("pt-BR");
}

export function buildSetorQueueHref(setorId: string, dueState: "" | "overdue" | "due_soon") {
  const search = new URLSearchParams({
    view: "table",
    status: "em_andamento,aguardando_sei",
    setorAtualId: setorId,
    sortBy: "updatedAt",
    sortOrder: "asc",
    page: "1",
  });

  if (dueState) {
    search.set("dueState", dueState);
  }

  return `/pre-demandas?${search.toString()}`;
}

export function buildWithoutSetorQueueHref(dueState: "" | "overdue" | "due_soon", hasInteressados: "" | "true" | "false" = "") {
  const search = new URLSearchParams({
    preset: "sem-setor",
    view: "table",
    sortBy: dueState ? "prazoProcesso" : "updatedAt",
    sortOrder: dueState === "overdue" ? "asc" : "desc",
    page: "1",
  });

  if (dueState) {
    search.set("dueState", dueState);
  }

  if (hasInteressados) {
    search.set("hasInteressados", hasInteressados);
  }

  return `/pre-demandas?${search.toString()}`;
}

export function buildPriorityQueueHref(setorId: string | null, dueState: "" | "overdue" | "due_soon", riskLevel: "normal" | "attention" | "critical") {
  if (!setorId) {
    if (riskLevel === "critical") {
      return buildWithoutSetorQueueHref(dueState, "");
    }

    if (dueState === "overdue") {
      return buildWithoutSetorQueueHref("overdue", "");
    }

    if (dueState === "due_soon") {
      return buildWithoutSetorQueueHref("due_soon", "");
    }

    return buildWithoutSetorQueueHref("", "");
  }

  return buildSetorQueueHref(setorId, dueState);
}
