import type { PreDemanda, PreDemandaStatus, QueueHealth } from "../types";

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

export function getQueueHealth(item: Pick<PreDemanda, "status" | "updatedAt" | "dataReferencia"> & { queueHealth?: QueueHealth }) {
  if (item.queueHealth) {
    return {
      ...item.queueHealth,
      label:
        item.queueHealth.level === "critical"
          ? "Critica"
          : item.queueHealth.level === "attention"
            ? "Atencao"
            : item.queueHealth.level === "closed"
              ? "Encerrado"
              : "No prazo",
      summary:
        item.queueHealth.level === "critical"
          ? `${item.queueHealth.staleDays}d sem movimentacao`
          : item.queueHealth.level === "attention"
            ? `${item.queueHealth.staleDays}d sem movimentacao`
            : item.queueHealth.level === "closed"
              ? "Processo encerrado"
              : item.queueHealth.staleDays === 0
                ? "Movimentada hoje"
                : `${item.queueHealth.staleDays}d desde a ultima acao`,
      detail: `Idade ${item.queueHealth.ageDays}d - ${item.queueHealth.staleDays}d sem movimentacao`,
      isAging: item.queueHealth.level === "attention" || item.queueHealth.level === "critical",
      isCritical: item.queueHealth.level === "critical",
    };
  }

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
            ? "Encerrado"
            : "No prazo",
    summary:
      level === "critical"
        ? `${staleDays}d sem movimentacao`
        : level === "attention"
          ? `${staleDays}d sem movimentacao`
          : level === "closed"
            ? "Processo encerrado"
            : staleDays === 0
              ? "Movimentada hoje"
              : `${staleDays}d desde a ultima acao`,
    detail: `Idade ${ageDays}d - ${staleDays}d sem movimentacao`,
    isAging: level === "attention" || level === "critical",
    isCritical: level === "critical",
  };
}
