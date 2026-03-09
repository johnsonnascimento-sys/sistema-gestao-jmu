import { existsSync } from "node:fs";
import { join } from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { readSession } from "./auth/session";
import { loadConfig, type AppConfig } from "./config";
import { createPool, type DatabasePool } from "./db";
import type { SessionUser } from "./domain/types";
import { AppError, isAppError } from "./errors";
import { PostgresPreDemandaRepository } from "./repositories/postgres-pre-demanda-repository";
import { PostgresUserRepository } from "./repositories/postgres-user-repository";
import type { PreDemandaRepository, UserRepository } from "./repositories/types";
import { registerAuthRoutes } from "./routes/auth";
import { registerPreDemandaRoutes } from "./routes/pre-demandas";

export interface AppDependencies {
  config: AppConfig;
  userRepository: UserRepository;
  preDemandaRepository: PreDemandaRepository;
  pool?: DatabasePool;
}

export async function buildApp(partialDependencies?: Partial<AppDependencies>) {
  const config = partialDependencies?.config ?? loadConfig();
  const pool = partialDependencies?.pool ?? createPool(config.DATABASE_URL);
  const userRepository = partialDependencies?.userRepository ?? new PostgresUserRepository(pool);
  const preDemandaRepository = partialDependencies?.preDemandaRepository ?? new PostgresPreDemandaRepository(pool);

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
    } satisfies SessionUser;
  });

  await registerAuthRoutes(app, { userRepository, config });
  await registerPreDemandaRoutes(app, { preDemandaRepository });

  app.get("/api/health", async () => ({
    ok: true,
    data: { status: "up" },
    error: null,
  }));

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
