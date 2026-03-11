import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPermissionsForRole } from "../auth/permissions";
import { clearSessionCookie, setSessionCookie } from "../auth/session";
import type { AppConfig } from "../config";
import { AppError } from "../errors";
import type { OperationsStore } from "../observability/operations-store";
import { verifyPassword } from "../auth/password";
import type { UserRepository } from "../repositories/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function serializeUser(user: { id: number; email: string; name: string; role: "admin" | "operador" }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: getPermissionsForRole(user.role),
  };
}

export async function registerAuthRoutes(app: FastifyInstance, options: { userRepository: UserRepository; config: AppConfig; operationsStore: OperationsStore }) {
  const { userRepository, config, operationsStore } = options;

  app.post("/api/auth/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const user = await userRepository.findByEmail(payload.email);

    if (!user || !user.active) {
      request.log.warn({ email: payload.email }, "auth.login.invalid-user");
      throw new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    }

    const isValid = await verifyPassword(payload.password, user.passwordHash);

    if (!isValid) {
      request.log.warn({ userId: user.id }, "auth.login.invalid-password");
      throw new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    }

    const sessionUser = serializeUser(user);
    setSessionCookie(reply, sessionUser, config.isProduction);
    operationsStore.recordLoginSuccess();
    request.log.info({ userId: user.id, role: user.role }, "auth.login.success");

    return reply.send({
      ok: true,
      data: sessionUser,
      error: null,
    });
  });

  app.post("/api/auth/logout", { preHandler: app.authenticate }, async (request, reply) => {
    request.log.info({ userId: request.user?.id }, "auth.logout");
    clearSessionCookie(reply);

    return reply.send({
      ok: true,
      data: { loggedOut: true },
      error: null,
    });
  });

  app.get("/api/auth/me", { preHandler: app.authenticate }, async (request, reply) => {
    return reply.send({
      ok: true,
      data: request.user,
      error: null,
    });
  });
}
