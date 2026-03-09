import type { PreDemandaStatus, QueueHealth, QueueHealthLevel } from "./types";

export interface QueueHealthThresholds {
  attentionDays: number;
  criticalDays: number;
}

function diffInDays(dateLike: string | Date) {
  const parsed = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const diffMs = Date.now() - parsed.getTime();

  if (!Number.isFinite(diffMs)) {
    return 0;
  }

  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function resolveQueueHealthLevel(status: PreDemandaStatus, staleDays: number, thresholds: QueueHealthThresholds): QueueHealthLevel {
  if (status === "encerrada") {
    return "closed";
  }

  if (staleDays >= thresholds.criticalDays) {
    return "critical";
  }

  if (staleDays >= thresholds.attentionDays) {
    return "attention";
  }

  return "fresh";
}

export function buildQueueHealth(
  status: PreDemandaStatus,
  updatedAt: string | Date,
  dataReferencia: string | Date,
  thresholds: QueueHealthThresholds,
): QueueHealth {
  const staleDays = diffInDays(updatedAt);
  const ageDays = diffInDays(dataReferencia);

  return {
    level: resolveQueueHealthLevel(status, staleDays, thresholds),
    staleDays,
    ageDays,
    attentionDays: thresholds.attentionDays,
    criticalDays: thresholds.criticalDays,
  };
}
