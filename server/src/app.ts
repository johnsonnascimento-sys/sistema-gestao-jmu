import { existsSync } from "node:fs";
import { join } from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { getPermissionsForRole, hasPermission } from "./auth/permissions";
import { readSession } from "./auth/session";
import { loadConfig, type AppConfig } from "./config";
import { createPool, type DatabasePool } from "./db";
import type { AppPermission } from "./domain/types";
import type { SessionUser } from "./domain/types";
import { AppError, isAppError } from "./errors";
import { OperationsStore } from "./observability/operations-store";
import { PostgresInteressadoRepository } from "./repositories/postgres-interessado-repository";
import { PostgresAssuntoRepository } from "./repositories/postgres-assunto-repository";
import { PostgresNormaRepository } from "./repositories/postgres-norma-repository";
import { PostgresPreDemandaRepository } from "./repositories/postgres-pre-demanda-repository";
import { PostgresSetorRepository } from "./repositories/postgres-setor-repository";
import { PostgresSettingsRepository } from "./repositories/postgres-settings-repository";
import { PostgresUserRepository } from "./repositories/postgres-user-repository";
import type { AssuntoRepository, InteressadoRepository, NormaRepository, PreDemandaRepository, SetorRepository, SettingsRepository, UserRepository } from "./repositories/types";
import { registerAssuntoRoutes } from "./routes/assuntos";
import { registerAdminOperationsRoutes } from "./routes/admin-operations";
import { registerAdminUserRoutes } from "./routes/admin-users";
import { registerAuthRoutes } from "./routes/auth";
import { registerInteressadoRoutes } from "./routes/interessados";
import { registerNormaRoutes } from "./routes/normas";
import { registerPreDemandaRoutes } from "./routes/pre-demandas";
import { registerSetorRoutes } from "./routes/setores";
import { createRuntimeStatus } from "./runtime";

export interface AppDependencies {
  config: AppConfig;
  userRepository: UserRepository;
  settingsRepository: SettingsRepository;
  preDemandaRepository: PreDemandaRepository;
  interessadoRepository: InteressadoRepository;
  assuntoRepository: AssuntoRepository;
  setorRepository: SetorRepository;
  normaRepository: NormaRepository;
  pool?: DatabasePool;
  operationsStore?: OperationsStore;
}

export async function buildApp(partialDependencies?: Partial<AppDependencies>) {
  const config = partialDependencies?.config ?? loadConfig();
  const pool = partialDependencies?.pool ?? createPool(config.DATABASE_URL);
  const userRepository = partialDependencies?.userRepository ?? new PostgresUserRepository(pool);
  const settingsRepository =
    partialDependencies?.settingsRepository ??
    new PostgresSettingsRepository(pool, {
      attentionDays: config.QUEUE_ATTENTION_DAYS,
      criticalDays: config.QUEUE_CRITICAL_DAYS,
    });
  const interessadoRepository = partialDependencies?.interessadoRepository ?? new PostgresInteressadoRepository(pool);
  const assuntoRepository = partialDependencies?.assuntoRepository ?? new PostgresAssuntoRepository(pool);
  const setorRepository = partialDependencies?.setorRepository ?? new PostgresSetorRepository(pool);
  const normaRepository = partialDependencies?.normaRepository ?? new PostgresNormaRepository(pool);
  const preDemandaRepository =
    partialDependencies?.preDemandaRepository ??
    new PostgresPreDemandaRepository(pool, settingsRepository);
  const operationsStore = partialDependencies?.operationsStore ?? new OperationsStore();

  const app = fastify({ logger: true });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  await app.register(cors, {
    origin: config.isProduction ? config.APP_BASE_URL : [config.APP_BASE_URL, config.CLIENT_ORIGIN],
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: config.isProduction,
  });

  app.addHook("onRequest", async (request) => {
    request.user = null;
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.addHook("onResponse", async (_request, reply) => {
    operationsStore.recordResponse(reply.statusCode);
  });

  app.decorate("authenticate", async (request) => {
    const session = readSession(request);

    if (!session) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida ou expirada.");
    }

    const user = await userRepository.findById(session.id);

    if (!user || !user.active) {
      throw new AppError(401, "UNAUTHENTICATED", "Usuario nao encontrado ou inativo.");
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: getPermissionsForRole(user.role),
    } satisfies SessionUser;
  });

  app.decorate("authorize", (permission: AppPermission) => {
    return async (request) => {
      if (!request.user) {
        throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida ou expirada.");
      }

      if (!hasPermission(request.user.role, permission)) {
        throw new AppError(403, "FORBIDDEN", "Voce nao possui permissao para esta operacao.");
      }
    };
  });

  await registerAuthRoutes(app, { userRepository, config, operationsStore });
  await registerInteressadoRoutes(app, { interessadoRepository });
  await registerAssuntoRoutes(app, { assuntoRepository });
  await registerSetorRoutes(app, { setorRepository });
  await registerNormaRoutes(app, { normaRepository });
  await registerPreDemandaRoutes(app, { preDemandaRepository });
  await registerAdminOperationsRoutes(app, { config, pool, operationsStore, settingsRepository });
  await registerAdminUserRoutes(app, { userRepository });

  app.get("/api/health", async () => ({
    ok: true,
    data: createRuntimeStatus(config, "up"),
    error: null,
  }));

  app.get("/api/ready", async (_request, reply) => {
    const startedAt = process.hrtime.bigint();
    await pool.query("select 1");
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    return reply.send({
      ok: true,
      data: createRuntimeStatus(config, "ready", {
        database: {
          status: "ready",
          checkedAt: new Date().toISOString(),
          latencyMs: Number(latencyMs.toFixed(2)),
          message: null,
        },
      }),
      error: null,
    });
  });

  const clientRoot = join(process.cwd(), "dist", "client");

  if (existsSync(clientRoot)) {
    await app.register(fastifyStatic, {
      root: clientRoot,
      wildcard: false,
    });

    app.get("/*", async (request, reply) => {
      if (request.url.startsWith("/api")) {
        return reply.status(404).send({
          ok: false,
          data: null,
          error: {
            code: "NOT_FOUND",
            message: "Rota nao encontrada.",
          },
        });
      }

      return reply.sendFile("index.html");
    });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn({ issues: error.issues }, "request.validation");

      return reply.status(400).send({
        ok: false,
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Payload invalido.",
          details: error.flatten(),
        },
      });
    }

    if (isAppError(error)) {
      request.log.warn({ code: error.code, details: error.details }, "request.app-error");

      if (error.code === "INVALID_CREDENTIALS" || error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN") {
        operationsStore.recordAuthFailure(error.message, {
          requestId: request.id,
          userId: request.user?.id ?? null,
          method: request.method,
          path: request.url,
          statusCode: error.statusCode,
          isLoginFailure: error.code === "INVALID_CREDENTIALS",
        });
      }

      return reply.status(error.statusCode).send({
        ok: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      });
    }

    request.log.error(error, "request.unhandled-error");
    operationsStore.recordUnhandledError(error instanceof Error ? error.message : "Falha interna do servidor.", {
      requestId: request.id,
      userId: request.user?.id ?? null,
      method: request.method,
      path: request.url,
      statusCode: 500,
    });

    return reply.status(500).send({
      ok: false,
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha interna do servidor.",
      },
    });
  });

  app.addHook("onClose", async () => {
    if (!partialDependencies?.pool) {
      await pool.end();
    }
  });

  return app;
}
