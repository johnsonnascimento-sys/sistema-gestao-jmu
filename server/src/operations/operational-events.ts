import { promises as fs } from "node:fs";
import type { AppConfig } from "../config";
import type { OperationalEvent, OperationalEventKind, OperationalEventStatus } from "../domain/types";

type RawOperationalEvent = {
  id?: unknown;
  kind?: unknown;
  status?: unknown;
  source?: unknown;
  message?: unknown;
  reference?: unknown;
  occurredAt?: unknown;
};

const KINDS = new Set<OperationalEventKind>(["backup", "restore", "restore_drill", "deploy", "rollback", "monitor", "bootstrap_audit"]);
const STATUSES = new Set<OperationalEventStatus>(["success", "failure"]);

function parseEvent(line: string): OperationalEvent | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const raw = JSON.parse(trimmed) as RawOperationalEvent;

    if (typeof raw.id !== "string" || typeof raw.kind !== "string" || typeof raw.status !== "string" || typeof raw.source !== "string" || typeof raw.message !== "string" || typeof raw.occurredAt !== "string") {
      return null;
    }

    if (!KINDS.has(raw.kind as OperationalEventKind) || !STATUSES.has(raw.status as OperationalEventStatus)) {
      return null;
    }

    return {
      id: raw.id,
      kind: raw.kind as OperationalEventKind,
      status: raw.status as OperationalEventStatus,
      source: raw.source,
      message: raw.message,
      reference: typeof raw.reference === "string" && raw.reference.length > 0 ? raw.reference : null,
      occurredAt: new Date(raw.occurredAt).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function listOperationalEvents(config: AppConfig, limit = 12): Promise<OperationalEvent[]> {
  try {
    const content = await fs.readFile(config.OPS_EVENT_LOG_PATH, "utf8");

    return content
      .split(/\r?\n/)
      .map((line) => parseEvent(line))
      .filter((event): event is OperationalEvent => event !== null)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}
