import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AssuntoRepository } from "../repositories/types";

const procedimentoSchema = z.object({
  ordem: z.number().int().positive().optional(),
  descricao: z.string().trim().min(3).max(4000),
  setor_destino_id: z.string().uuid().optional().nullable(),
});

const assuntoSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  descricao: z.string().trim().max(4000).optional().nullable(),
  norma_ids: z.array(z.string().uuid()).max(50).optional().default([]),
  procedimentos: z.array(procedimentoSchema).max(50).optional().default([]),
});

export async function registerAssuntoRoutes(app: FastifyInstance, options: { assuntoRepository: AssuntoRepository }) {
  const { assuntoRepository } = options;

  app.get("/api/assuntos", { preHandler: [app.authenticate, app.authorize("cadastro.assunto.read")] }, async (_request, reply) => {
    const data = await assuntoRepository.list();
    return reply.send({ ok: true, data, error: null });
  });

  app.post("/api/assuntos", { preHandler: [app.authenticate, app.authorize("cadastro.assunto.write")] }, async (request, reply) => {
    const payload = assuntoSchema.parse(request.body);
    const data = await assuntoRepository.create({
      nome: payload.nome,
      descricao: payload.descricao ?? null,
      normaIds: payload.norma_ids,
      procedimentos: payload.procedimentos.map((item) => ({
        ordem: item.ordem,
        descricao: item.descricao,
        setorDestinoId: item.setor_destino_id ?? null,
      })),
    });

    return reply.status(201).send({ ok: true, data, error: null });
  });

  app.patch("/api/assuntos/:id", { preHandler: [app.authenticate, app.authorize("cadastro.assunto.write")] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = assuntoSchema.parse(request.body);
    const data = await assuntoRepository.update({
      id: params.id,
      nome: payload.nome,
      descricao: payload.descricao ?? null,
      normaIds: payload.norma_ids,
      procedimentos: payload.procedimentos.map((item) => ({
        ordem: item.ordem,
        descricao: item.descricao,
        setorDestinoId: item.setor_destino_id ?? null,
      })),
    });

    return reply.send({ ok: true, data, error: null });
  });
}
