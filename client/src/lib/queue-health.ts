import type { PreDemanda, PreDemandaStatus } from "../types";

export type QueueHealthLevel = "fresh" | "attention" | "critical" | "closed";

export const QUEUE_ATTENTION_DAYS = 2;
export const QUEUE_CRITICAL_DAYS = 5;

function diffInDays(dateLike: string) {
  const parsed = new Date(dateLike);
  const diffMs = Date.now() - parsed.getTime();

  if (!Number.isFinite(diffMs)) {
    return 0;
  }

  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function resolveQueueLevel(status: PreDemandaStatus, staleDays: number): QueueHealthLevel {
  if (status === "encerrada") {
    return "closed";
  }

  if (staleDays >= QUEUE_CRITICAL_DAYS) {
    return "critical";
  }

  if (staleDays >= QUEUE_ATTENTION_DAYS) {
    return "attention";
  }

  return "fresh";
}

export function getQueueHealth(item: Pick<PreDemanda, "status" | "updatedAt" | "dataReferencia">) {
  const staleDays = diffInDays(item.updatedAt);
  const ageDays = diffInDays(item.dataReferencia);
  const level = resolveQueueLevel(item.status, staleDays);

  return {
    level,
    staleDays,
    ageDays,
    label:
      level === "critical"
        ? "Critica"
        : level === "attention"
          ? "Atencao"
          : level === "closed"
            ? "Encerrada"
            : "No prazo",
    summary:
      level === "critical"
        ? `${staleDays}d sem movimentacao`
        : level === "attention"
          ? `${staleDays}d sem movimentacao`
          : level === "closed"
            ? "Demanda encerrada"
            : staleDays === 0
              ? "Movimentada hoje"
              : `${staleDays}d desde a ultima acao`,
    detail: `Idade ${ageDays}d - ${staleDays}d sem movimentacao`,
    isAging: level === "attention" || level === "critical",
    isCritical: level === "critical",
  };
}
