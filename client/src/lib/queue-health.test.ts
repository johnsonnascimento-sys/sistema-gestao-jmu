import { describe, expect, it, vi } from "vitest";
import { getQueueHealth } from "./queue-health";

describe("queue-health", () => {
  it("marks active items as critical after five days without movement", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00Z"));

    const result = getQueueHealth({
      status: "em_andamento",
      dataReferencia: "2026-03-01",
      updatedAt: "2026-03-03T10:00:00Z",
    });

    expect(result.level).toBe("critical");
    expect(result.staleDays).toBeGreaterThanOrEqual(5);

    vi.useRealTimers();
  });

  it("does not mark closed items as aging", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00Z"));

    const result = getQueueHealth({
      status: "encerrada",
      dataReferencia: "2026-03-01",
      updatedAt: "2026-03-01T08:00:00Z",
    });

    expect(result.level).toBe("closed");
    expect(result.isAging).toBe(false);

    vi.useRealTimers();
  });
});
