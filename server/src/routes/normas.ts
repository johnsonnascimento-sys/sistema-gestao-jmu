import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { NormaRepository } from "../repositories/types";

const normaSchema = z.object({
  numero: z.string().trim().min(1).max(120),
  data_norma: z.string().date(),
  origem: z.string().trim().min(2).max(255),
});

export async function registerNormaRoutes(app: FastifyInstance, options: { normaRepository: NormaRepository }) {
  const { normaRepository } = options;

  app.get("/api/normas", { preHandler: [app.authenticate, app.authorize("cadastro.norma.read")] }, async (_request, reply) => {
    const items = await normaRepository.list();
    return reply.send({
      ok: true,
      data: items,
      error: null,
    });
  });

  app.post("/api/normas", { preHandler: [app.authenticate, app.authorize("cadastro.norma.write")] }, async (request, reply) => {
    const payload = normaSchema.parse(request.body);
    const record = await normaRepository.create({
      numero: payload.numero,
      dataNorma: payload.data_norma,
      origem: payload.origem,
    });

    return reply.status(201).send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.patch("/api/normas/:id", { preHandler: [app.authenticate, app.authorize("cadastro.norma.write")] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = normaSchema.parse(request.body);
    const record = await normaRepository.update({
      id: params.id,
      numero: payload.numero,
      dataNorma: payload.data_norma,
      origem: payload.origem,
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });
}
