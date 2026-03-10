import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { InteressadoRepository } from "../repositories/types";

const interessadoSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  matricula: z.string().trim().max(50).optional().nullable(),
  cpf: z.string().trim().max(14).optional().nullable(),
  data_nascimento: z.string().date().optional().nullable(),
});

const listSchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function emptyToNull(value: string | null | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function registerInteressadoRoutes(app: FastifyInstance, options: { interessadoRepository: InteressadoRepository }) {
  const { interessadoRepository } = options;

  app.get("/api/interessados", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.read")] }, async (request, reply) => {
    const query = listSchema.parse(request.query);
    const result = await interessadoRepository.list({
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });

    return reply.send({
      ok: true,
      data: {
        ...result,
        page: query.page,
        pageSize: query.pageSize,
      },
      error: null,
    });
  });

  app.post("/api/interessados", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.write")] }, async (request, reply) => {
    const payload = interessadoSchema.parse(request.body);
    const record = await interessadoRepository.create({
      nome: payload.nome,
      matricula: emptyToNull(payload.matricula),
      cpf: emptyToNull(payload.cpf),
      dataNascimento: payload.data_nascimento ?? null,
    });

    return reply.status(201).send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.patch("/api/interessados/:id", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.write")] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = interessadoSchema.parse(request.body);
    const record = await interessadoRepository.update({
      id: params.id,
      nome: payload.nome,
      matricula: emptyToNull(payload.matricula),
      cpf: emptyToNull(payload.cpf),
      dataNascimento: payload.data_nascimento ?? null,
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });
}
