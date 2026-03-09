import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword } from "../auth/password";
import type { UserRepository } from "../repositories/types";

const roleSchema = z.enum(["admin", "operador"]);

const createUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(3).max(120),
  password: z.string().min(8).max(200),
  role: roleSchema.default("operador"),
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    role: roleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.role !== undefined || value.active !== undefined, {
    message: "Informe ao menos um campo para atualizar.",
  });

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

const listAuditSchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export async function registerAdminUserRoutes(app: FastifyInstance, options: { userRepository: UserRepository }) {
  const { userRepository } = options;

  app.get("/api/admin/users", { preHandler: [app.authenticate, app.authorize("admin.user.read")] }, async (_request, reply) => {
    const users = await userRepository.list();

    return reply.send({
      ok: true,
      data: users,
      error: null,
    });
  });

  app.get("/api/admin/users/auditoria", { preHandler: [app.authenticate, app.authorize("admin.user.read")] }, async (request, reply) => {
    const query = listAuditSchema.parse(request.query);
    const audit = await userRepository.listAudit(query.limit ?? 12);

    request.log.info(
      {
        userId: request.user?.id,
        limit: query.limit ?? 12,
      },
      "admin.user.list-audit",
    );

    return reply.send({
      ok: true,
      data: audit,
      error: null,
    });
  });

  app.post("/api/admin/users", { preHandler: [app.authenticate, app.authorize("admin.user.create")] }, async (request, reply) => {
    const payload = createUserSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);
    const user = await userRepository.create({
      email: payload.email,
      name: payload.name,
      passwordHash,
      role: payload.role,
      changedByUserId: request.user!.id,
    });

    request.log.info(
      {
        userId: request.user?.id,
        targetUserId: user.id,
        targetEmail: user.email,
        role: user.role,
      },
      "admin.user.create",
    );

    return reply.status(201).send({
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      error: null,
    });
  });

  app.patch("/api/admin/users/:id", { preHandler: [app.authenticate, app.authorize("admin.user.update")] }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const payload = updateUserSchema.parse(request.body);
    const user = await userRepository.update({
      id: params.id,
      name: payload.name,
      role: payload.role,
      active: payload.active,
      changedByUserId: request.user!.id,
    });

    request.log.info(
      {
        userId: request.user?.id,
        targetUserId: user.id,
        role: user.role,
        active: user.active,
      },
      "admin.user.update",
    );

    return reply.send({
      ok: true,
      data: user,
      error: null,
    });
  });

  app.post(
    "/api/admin/users/:id/reset-password",
    { preHandler: [app.authenticate, app.authorize("admin.user.reset_password")] },
    async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const payload = resetPasswordSchema.parse(request.body);
      const passwordHash = await hashPassword(payload.password);
      const user = await userRepository.resetPassword({
        id: params.id,
        passwordHash,
        changedByUserId: request.user!.id,
      });

      request.log.info(
        {
          userId: request.user?.id,
          targetUserId: user.id,
        },
        "admin.user.reset-password",
      );

      return reply.send({
        ok: true,
        data: user,
        error: null,
      });
    },
  );
}
