import type { PreDemanda } from "../types";
import { getQueueHealth } from "../lib/queue-health";
import { Badge } from "./ui/badge";

export function QueueHealthPill({ item }: { item: Pick<PreDemanda, "status" | "updatedAt" | "dataReferencia"> }) {
  const health = getQueueHealth(item);

  const variant =
    health.level === "critical"
      ? "destructive"
      : health.level === "attention"
        ? "warning"
        : health.level === "closed"
          ? "outline"
          : "neutral";

  return <Badge variant={variant}>{health.label}</Badge>;
}
