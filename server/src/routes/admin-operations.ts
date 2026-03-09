import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config";
import type { DatabasePool } from "../db";
import { describeMigrations } from "../migrations/describe-migrations";
import type { OperationsStore } from "../observability/operations-store";
import { describeBackupStatus } from "../operations/backup-status";
import { listOperationalEvents } from "../operations/operational-events";
import type { SettingsRepository } from "../repositories/types";
import { createRuntimeStatus } from "../runtime";

const listOpsSchema = z.object({
  limit: z.coerce.number().int().positive().max(30).optional(),
});

const updateQueueHealthConfigSchema = z
  .object({
    attentionDays: z.coerce.number().int().positive(),
    criticalDays: z.coerce.number().int().positive(),
  })
  .refine((value) => value.criticalDays >= value.attentionDays, {
    message: "O limite critico deve ser maior ou igual ao limite de atencao.",
    path: ["criticalDays"],
  });

export async function registerAdminOperationsRoutes(
  app: FastifyInstance,
  options: {
    config: AppConfig;
    pool: DatabasePool;
    operationsStore: OperationsStore;
    settingsRepository: SettingsRepository;
  },
) {
  const { config, pool, operationsStore, settingsRepository } = options;

  app.get("/api/admin/ops/resumo", { preHandler: [app.authenticate, app.authorize("admin.ops.read")] }, async (request, reply) => {
    const query = listOpsSchema.parse(request.query);
    const startedAt = process.hrtime.bigint();
    let runtime;
    let migrations = null;

    try {
      await pool.query("select 1");
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      migrations = await describeMigrations(pool);

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
        migrations,
        queueHealthConfig: await settingsRepository.getQueueHealthConfig(),
        backupStatus: await describeBackupStatus(config),
        operationalEvents: await listOperationalEvents(config, query.limit ?? 12),
      },
      error: null,
    });
  });

  app.get("/api/admin/ops/queue-health-config", { preHandler: [app.authenticate, app.authorize("admin.ops.read")] }, async (_request, reply) => {
    return reply.send({
      ok: true,
      data: await settingsRepository.getQueueHealthConfig(),
      error: null,
    });
  });

  app.patch("/api/admin/ops/queue-health-config", { preHandler: [app.authenticate, app.authorize("admin.ops.update")] }, async (request, reply) => {
    const payload = updateQueueHealthConfigSchema.parse(request.body);
    const configResult = await settingsRepository.updateQueueHealthConfig({
      attentionDays: payload.attentionDays,
      criticalDays: payload.criticalDays,
      updatedByUserId: request.user!.id,
    });

    request.log.info(
      {
        userId: request.user?.id,
        attentionDays: payload.attentionDays,
        criticalDays: payload.criticalDays,
      },
      "admin.ops.update-queue-health-config",
    );

    return reply.send({
      ok: true,
      data: configResult,
      error: null,
    });
  });
}
