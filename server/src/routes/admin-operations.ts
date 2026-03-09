import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config";
import type { DatabasePool } from "../db";
import type { OperationsStore } from "../observability/operations-store";
import { createRuntimeStatus } from "../runtime";

const listOpsSchema = z.object({
  limit: z.coerce.number().int().positive().max(30).optional(),
});

export async function registerAdminOperationsRoutes(
  app: FastifyInstance,
  options: {
    config: AppConfig;
    pool: DatabasePool;
    operationsStore: OperationsStore;
  },
) {
  const { config, pool, operationsStore } = options;

  app.get("/api/admin/ops/resumo", { preHandler: [app.authenticate, app.authorize("admin.ops.read")] }, async (request, reply) => {
    const query = listOpsSchema.parse(request.query);
    const startedAt = process.hrtime.bigint();
    let runtime;

    try {
      await pool.query("select 1");
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      runtime = createRuntimeStatus(config, "ready", {
        database: {
          status: "ready",
          checkedAt: new Date().toISOString(),
          latencyMs: Number(latencyMs.toFixed(2)),
          message: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao validar conectividade com o banco.";

      operationsStore.recordReadyCheckFailure(message, {
        requestId: request.id,
        userId: request.user?.id ?? null,
        method: request.method,
        path: request.url,
        statusCode: 503,
      });

      runtime = createRuntimeStatus(config, "up", {
        database: {
          status: "error",
          checkedAt: new Date().toISOString(),
          message,
        },
      });
    }

    request.log.info(
      {
        userId: request.user?.id,
        limit: query.limit ?? 12,
        databaseStatus: runtime.database?.status ?? "unknown",
      },
      "admin.ops.summary",
    );

    return reply.send({
      ok: true,
      data: {
        runtime,
        ...operationsStore.getSnapshot(query.limit ?? 12),
      },
      error: null,
    });
  });
}
