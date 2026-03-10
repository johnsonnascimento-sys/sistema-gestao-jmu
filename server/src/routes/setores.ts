import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SetorRepository } from "../repositories/types";

const setorSchema = z.object({
  sigla: z.string().trim().min(2).max(30),
  nome_completo: z.string().trim().min(3).max(255),
});

export async function registerSetorRoutes(app: FastifyInstance, options: { setorRepository: SetorRepository }) {
  const { setorRepository } = options;

  app.get("/api/setores", { preHandler: [app.authenticate, app.authorize("cadastro.setor.read")] }, async (_request, reply) => {
    const items = await setorRepository.list();
    return reply.send({
      ok: true,
      data: items,
      error: null,
    });
  });

  app.post("/api/setores", { preHandler: [app.authenticate, app.authorize("cadastro.setor.write")] }, async (request, reply) => {
    const payload = setorSchema.parse(request.body);
    const record = await setorRepository.create({
      sigla: payload.sigla,
      nomeCompleto: payload.nome_completo,
    });

    return reply.status(201).send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.patch("/api/setores/:id", { preHandler: [app.authenticate, app.authorize("cadastro.setor.write")] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = setorSchema.parse(request.body);
    const record = await setorRepository.update({
      id: params.id,
      sigla: payload.sigla,
      nomeCompleto: payload.nome_completo,
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });
}
