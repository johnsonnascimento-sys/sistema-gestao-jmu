import { afterEach, describe, expect, it, vi } from "vitest";
import { getTaskReport } from "./api";

describe("getTaskReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializa os filtros suportados pelo endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [],
            summary: { total: 0, pendentes: 0, concluidas: 0, urgentes: 0, atrasadas: 0 },
            generatedAt: "2026-08-06T12:00:00.000Z",
            total: 0,
            truncated: false,
          },
          error: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getTaskReport({
      status: "concluidas",
      dueFrom: "2026-07-01",
      dueTo: "2026-07-31",
      urgency: "nao_urgentes",
      recurrence: "sem_recorrencia",
      q: "  setor SEC  ",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pre-demandas/relatorios/tarefas?status=concluidas&urgency=nao_urgentes&dueFrom=2026-07-01&dueTo=2026-07-31&recurrence=sem_recorrencia&q=setor+SEC",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
