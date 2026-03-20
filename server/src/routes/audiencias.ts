import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { emitPreDemandaUpdate } from "../lib/events";
import type { PreDemandaAudienciaRepository } from "../repositories/types";

const AUDIENCIA_SITUACOES = ["agendada", "redesignada", "realizada", "cancelada", "suspensa"] as const;

const datetimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Data/hora invalida.");

const audienciaFieldsSchema = z.object({
  data_hora_inicio: datetimeSchema,
  data_hora_fim: datetimeSchema.optional().nullable(),
  descricao: z.string().trim().max(4000).optional().nullable(),
  sala: z.string().trim().max(120).optional().nullable(),
  situacao: z.enum(AUDIENCIA_SITUACOES).optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
});

const audienciaCreateSchema = audienciaFieldsSchema.extend({
  situacao: z.enum(AUDIENCIA_SITUACOES).optional().default("agendada"),
});

const audienciaUpdateSchema = audienciaFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function registerPreDemandaAudienciaRoutes(
  app: FastifyInstance,
  options: { preDemandaAudienciaRepository: PreDemandaAudienciaRepository },
) {
  const { preDemandaAudienciaRepository } = options;

  app.get("/api/pre-demandas/:preId/audiencias", { preHandler: [app.authenticate, app.authorize("pre_demanda.read")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const audiencias = await preDemandaAudienciaRepository.listAudiencias(params.preId);
    return reply.send({
      ok: true,
      data: audiencias,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/audiencias", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_audiencias")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = audienciaCreateSchema.parse(request.body);
    const audiencia = await preDemandaAudienciaRepository.createAudiencia({
      preId: params.preId,
      dataHoraInicio: payload.data_hora_inicio,
      dataHoraFim: payload.data_hora_fim ?? null,
      descricao: payload.descricao ?? null,
      sala: emptyToNull(payload.sala),
      situacao: payload.situacao ?? "agendada",
      observacoes: emptyToNull(payload.observacoes),
      changedByUserId: request.user!.id,
    });

    emitPreDemandaUpdate({ preId: params.preId, type: "andamento", action: "create" });

    return reply.status(201).send({
      ok: true,
      data: audiencia,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/audiencias/:audienciaId", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_audiencias")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), audienciaId: z.string().uuid() }).parse(request.params);
    const payload = audienciaUpdateSchema.parse(request.body);
    const audiencia = await preDemandaAudienciaRepository.updateAudiencia({
      preId: params.preId,
      audienciaId: params.audienciaId,
      dataHoraInicio: payload.data_hora_inicio,
      dataHoraFim: payload.data_hora_fim === undefined ? undefined : payload.data_hora_fim,
      descricao: payload.descricao === undefined ? undefined : payload.descricao ?? null,
      sala: payload.sala === undefined ? undefined : emptyToNull(payload.sala),
      situacao: payload.situacao,
      observacoes: payload.observacoes === undefined ? undefined : emptyToNull(payload.observacoes),
      changedByUserId: request.user!.id,
    });

    emitPreDemandaUpdate({ preId: params.preId, type: "andamento", action: "update" });

    return reply.send({
      ok: true,
      data: audiencia,
      error: null,
    });
  });

  app.delete("/api/pre-demandas/:preId/audiencias/:audienciaId", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_audiencias")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), audienciaId: z.string().uuid() }).parse(request.params);
    const result = await preDemandaAudienciaRepository.removeAudiencia({
      preId: params.preId,
      audienciaId: params.audienciaId,
      changedByUserId: request.user!.id,
    });

    emitPreDemandaUpdate({ preId: params.preId, type: "andamento", action: "delete" });

    return reply.send({
      ok: true,
      data: result,
      error: null,
    });
  });
}
