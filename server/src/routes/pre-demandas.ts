import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PreDemandaSortBy, PreDemandaStatus, QueueHealthLevel, SortOrder } from "../domain/types";
import { AppError } from "../errors";
import type { PreDemandaRepository } from "../repositories/types";

const STATUSES: PreDemandaStatus[] = ["em_andamento", "aguardando_sei", "encerrada"];
const QUEUE_HEALTH_LEVELS: QueueHealthLevel[] = ["fresh", "attention", "critical"];
const SORT_FIELDS: PreDemandaSortBy[] = ["updatedAt", "createdAt", "dataReferencia", "solicitante", "status", "prazoProcesso", "proximoPrazoTarefa", "numeroJudicial"];
const SORT_ORDERS: SortOrder[] = ["asc", "desc"];
const DUE_STATES = ["overdue", "due_today", "due_soon", "none"] as const;
const DEADLINE_FIELDS = ["prazoProcesso", "proximoPrazoTarefa"] as const;
const PRAZO_RECORTES = ["overdue", "today", "soon"] as const;
const SEI_REGEX = /^(?:\d{6}\/\d{2}-\d{2}\.\d{3}|\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})$/;
const NUMERO_JUDICIAL_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

const metadataSchema = z
  .object({
    pagamento_envolvido: z.boolean().optional().nullable(),
    urgente: z.boolean().optional().nullable(),
    audiencia_data: z.string().date().optional().nullable(),
    audiencia_status: z.string().trim().max(120).optional().nullable(),
  })
  .partial()
  .optional()
  .nullable();

const numeroJudicialSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    return normalizeNumeroJudicialValue(value);
  },
  z.string().regex(NUMERO_JUDICIAL_REGEX, "Número judicial inválido.").nullable().optional(),
);

const createSchema = z.object({
  solicitante: z.string().trim().min(3).optional(),
  assunto: z.string().trim().min(3),
  data_referencia: z.string().date(),
  descricao: z.string().trim().max(4000).optional().nullable(),
  fonte: z.string().trim().max(120).optional().nullable(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  prazo_processo: z.string().date(),
  sei_numero: z.string().trim().regex(SEI_REGEX, "Número SEI inválido.").optional().nullable(),
  numero_judicial: numeroJudicialSchema,
  assunto_ids: z.array(z.string().uuid()).max(24).optional().default([]),
  metadata: metadataSchema,
})
  .refine((value) => {
    return Boolean(value.prazo_processo);
  }, {
    message: "Prazo final é obrigatório quando a demanda não possui frequência contínua.",
    path: ["prazo_processo"],
  });

const listSchema = z.object({
  q: z.string().trim().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  queueHealth: z.union([z.string(), z.array(z.string())]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  hasSei: z.enum(["true", "false"]).optional(),
  setorAtualId: z.string().uuid().optional(),
  withoutSetor: z.enum(["true", "false"]).optional(),
  dueState: z.enum(DUE_STATES).optional(),
  deadlineCampo: z.enum(DEADLINE_FIELDS).optional(),
  prazoRecorte: z.enum(PRAZO_RECORTES).optional(),
  paymentInvolved: z.enum(["true", "false"]).optional(),
  hasInteressados: z.enum(["true", "false"]).optional(),
  closedWithinDays: z.coerce.number().int().positive().max(365).optional(),
  reopenedWithinDays: z.coerce.number().int().positive().max(365).optional(),
  sortBy: z.enum(SORT_FIELDS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const listRecentTimelineSchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const associateSchema = z.object({
  sei_numero: z.string().trim().regex(SEI_REGEX, "Número SEI inválido."),
  motivo: z.string().trim().max(2000).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

const statusSchema = z.object({
  status: z.enum(STATUSES),
  motivo: z.string().trim().max(2000).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

const patchCaseSchema = z
  .object({
    assunto: z.string().trim().min(3).optional(),
    descricao: z.string().trim().max(4000).optional().nullable(),
    fonte: z.string().trim().max(120).optional().nullable(),
    observacoes: z.string().trim().max(4000).optional().nullable(),
    prazo_processo: z.string().date().optional().nullable(),
    numero_judicial: numeroJudicialSchema,
    metadata: metadataSchema,
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

const anotacoesSchema = z.object({
  anotacoes: z.string().trim().max(4000).optional().nullable(),
});

const interessadoSchema = z.object({
  interessado_id: z.string().uuid(),
  papel: z.literal("interessado").default("interessado"),
});

const assuntoLinkSchema = z.object({
  assunto_id: z.string().uuid(),
});

const vinculoSchema = z.object({
  destino_pre_id: z.string().trim().min(1),
});

const tramitarSchema = z.object({
  setor_destino_id: z.string().uuid().optional(),
  setores_destino_ids: z.array(z.string().uuid()).min(1).max(12).optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
}).refine((value) => Boolean(value.setor_destino_id) || Boolean(value.setores_destino_ids?.length), {
  message: "Informe ao menos um setor destino.",
});

const concluirTramitacaoSchema = z.object({
  observacoes: z.string().trim().max(4000).optional().nullable(),
});

const andamentoSchema = z.object({
  descricao: z.string().trim().min(3).max(4000),
  data_hora: z.string().datetime().optional().nullable(),
});

const andamentoDeleteSchema = z.object({
  confirmacao: z.literal("EXCLUIR"),
});

const tarefaSchema = z.object({
  descricao: z.string().trim().min(3).max(4000),
  tipo: z.enum(["fixa", "livre"]),
  prazo_conclusao: z.string().date(),
  recorrencia_tipo: z.enum(["diaria", "semanal", "mensal"]).optional().nullable(),
  recorrencia_dias_semana: z.array(z.string().trim().min(3).max(16)).max(7).optional().nullable(),
  recorrencia_dia_mes: z.number().int().min(1).max(31).optional().nullable(),
  setor_destino_id: z.string().uuid().optional().nullable(),
});

const tarefaOrderSchema = z.object({
  tarefa_ids: z.array(z.string().uuid()).min(1),
});

const comentarioSchema = z.object({
  conteudo: z.string().trim().min(1).max(20000),
  formato: z.literal("markdown").optional().default("markdown"),
});

const documentoSchema = z.object({
  nome_arquivo: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(160),
  descricao: z.string().trim().max(4000).optional().nullable(),
  conteudo_base64: z.string().trim().min(1),
});

function emptyToNull(value: string | null | undefined) {
  return value && value.length > 0 ? value : null;
}

function normalizeNumeroJudicialValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 20) {
    return trimmed;
  }

  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function normalizeMetadata(payload: z.infer<typeof metadataSchema>) {
  if (!payload) {
    return undefined;
  }

  return {
    pagamentoEnvolvido: payload.pagamento_envolvido ?? null,
    urgente: payload.urgente ?? null,
    audienciaData: payload.audiencia_data ?? null,
    audienciaStatus: emptyToNull(payload.audiencia_status),
  };
}

function parseStatuses(input: string | string[] | undefined) {
  if (!input) {
    return [];
  }

  const values = Array.isArray(input) ? input : input.split(",");
  const normalized = values.map((value) => value.trim()).filter(Boolean);

  for (const value of normalized) {
    if (!STATUSES.includes(value as PreDemandaStatus)) {
      throw new AppError(400, "INVALID_STATUS_FILTER", `Status inválido: ${value}`);
    }
  }

  return normalized as PreDemandaStatus[];
}

function parseQueueHealthLevels(input: string | string[] | undefined) {
  if (!input) {
    return [];
  }

  const values = Array.isArray(input) ? input : input.split(",");
  const normalized = values.map((value) => value.trim()).filter(Boolean);

  for (const value of normalized) {
    if (!QUEUE_HEALTH_LEVELS.includes(value as QueueHealthLevel)) {
      throw new AppError(400, "INVALID_QUEUE_HEALTH_FILTER", `Filtro de fila inválido: ${value}`);
    }
  }

  return normalized as QueueHealthLevel[];
}

export async function registerPreDemandaRoutes(app: FastifyInstance, options: { preDemandaRepository: PreDemandaRepository }) {
  const { preDemandaRepository } = options;

  app.post("/api/pre-demandas", { preHandler: [app.authenticate, app.authorize("pre_demanda.create")] }, async (request, reply) => {
    const payload = createSchema.parse(request.body);
    const result = await preDemandaRepository.create({
      solicitante: emptyToNull(payload.solicitante) ?? undefined,
      assunto: payload.assunto,
      dataReferencia: payload.data_referencia,
      descricao: emptyToNull(payload.descricao),
      fonte: emptyToNull(payload.fonte),
      observacoes: emptyToNull(payload.observacoes),
      prazoProcesso: payload.prazo_processo,
      seiNumero: emptyToNull(payload.sei_numero),
      numeroJudicial: emptyToNull(payload.numero_judicial),
      assuntoIds: payload.assunto_ids,
      metadata: normalizeMetadata(payload.metadata) ?? null,
      createdByUserId: request.user!.id,
    });

    request.log.info(
      {
        userId: request.user?.id,
        preId: result.record.preId,
        idempotent: result.idempotent,
        existingPreId: result.existingPreId,
      },
      "pre-demanda.create",
    );

    return reply.status(result.idempotent ? 200 : 201).send({
      ok: true,
      data: {
        ...result.record,
        idempotent: result.idempotent,
        existingPreId: result.existingPreId,
      },
      error: null,
    });
  });

  app.get("/api/pre-demandas", { preHandler: [app.authenticate, app.authorize("pre_demanda.read")] }, async (request, reply) => {
    const query = listSchema.parse(request.query);
    const statuses = parseStatuses(query.status);
    const queueHealthLevels = parseQueueHealthLevels(query.queueHealth);
    const [listResult, counts] = await Promise.all([
      preDemandaRepository.list({
        q: query.q,
        statuses,
        queueHealthLevels,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        hasSei: query.hasSei ? query.hasSei === "true" : undefined,
        setorAtualId: query.setorAtualId,
        withoutSetor: query.withoutSetor ? query.withoutSetor === "true" : undefined,
        dueState: query.dueState,
        deadlineCampo: query.deadlineCampo,
        prazoRecorte: query.prazoRecorte,
        paymentInvolved: query.paymentInvolved ? query.paymentInvolved === "true" : undefined,
        hasInteressados: query.hasInteressados ? query.hasInteressados === "true" : undefined,
        closedWithinDays: query.closedWithinDays,
        reopenedWithinDays: query.reopenedWithinDays,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page,
        pageSize: query.pageSize,
      }),
      preDemandaRepository.getStatusCounts(),
    ]);

    return reply.send({
      ok: true,
      data: {
        items: listResult.items,
        total: listResult.total,
        page: query.page,
        pageSize: query.pageSize,
        counts,
      },
      error: null,
    });
  });

  app.get("/api/pre-demandas/dashboard/resumo", { preHandler: [app.authenticate, app.authorize("dashboard.read")] }, async (_request, reply) => {
    const summary = await preDemandaRepository.getDashboardSummary();
    return reply.send({
      ok: true,
      data: summary,
      error: null,
    });
  });

  app.get("/api/pre-demandas/timeline/recentes", { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] }, async (request, reply) => {
    const query = listRecentTimelineSchema.parse(request.query);
    const items = await preDemandaRepository.listRecentTimeline(query.limit ?? 8);
    return reply.send({
      ok: true,
      data: items,
      error: null,
    });
  });

  app.get("/api/pre-demandas/:preId", { preHandler: [app.authenticate, app.authorize("pre_demanda.read")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const record = await preDemandaRepository.getByPreId(params.preId);

    if (!record) {
      throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Demanda não encontrada.");
    }

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = patchCaseSchema.parse(request.body);
    const record = await preDemandaRepository.updateCaseData({
      preId: params.preId,
      assunto: payload.assunto,
      descricao: payload.descricao === undefined ? undefined : emptyToNull(payload.descricao),
      fonte: payload.fonte === undefined ? undefined : emptyToNull(payload.fonte),
      observacoes: payload.observacoes === undefined ? undefined : emptyToNull(payload.observacoes),
      prazoProcesso: payload.prazo_processo === undefined ? undefined : payload.prazo_processo,
      numeroJudicial: payload.numero_judicial === undefined ? undefined : emptyToNull(payload.numero_judicial),
      metadata: normalizeMetadata(payload.metadata),
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/anotacoes", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = anotacoesSchema.parse(request.body);
    const record = await preDemandaRepository.updateAnotacoes({
      preId: params.preId,
      anotacoes: payload.anotacoes === undefined ? null : emptyToNull(payload.anotacoes),
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/assuntos", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = assuntoLinkSchema.parse(request.body);
    const data = await preDemandaRepository.addAssunto({
      preId: params.preId,
      assuntoId: payload.assunto_id,
      changedByUserId: request.user!.id,
    });

    return reply.status(201).send({ ok: true, data, error: null });
  });

  app.delete("/api/pre-demandas/:preId/assuntos/:assuntoId", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), assuntoId: z.string().uuid() }).parse(request.params);
    const data = await preDemandaRepository.removeAssunto({
      preId: params.preId,
      assuntoId: params.assuntoId,
      changedByUserId: request.user!.id,
    });

    return reply.send({ ok: true, data, error: null });
  });

  app.post("/api/pre-demandas/:preId/interessados", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_interessados")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = interessadoSchema.parse(request.body);
    const items = await preDemandaRepository.addInteressado({
      preId: params.preId,
      interessadoId: payload.interessado_id,
      papel: payload.papel,
      changedByUserId: request.user!.id,
    });

    return reply.status(201).send({
      ok: true,
      data: items,
      error: null,
    });
  });

  app.delete("/api/pre-demandas/:preId/interessados/:interessadoId", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_interessados")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), interessadoId: z.string().uuid() }).parse(request.params);
    const items = await preDemandaRepository.removeInteressado({
      preId: params.preId,
      interessadoId: params.interessadoId,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: items,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/vinculos", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_vinculos")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = vinculoSchema.parse(request.body);
    const items = await preDemandaRepository.addVinculo({
      preId: params.preId,
      destinoPreId: payload.destino_pre_id,
      changedByUserId: request.user!.id,
    });

    return reply.status(201).send({
      ok: true,
      data: items,
      error: null,
    });
  });

  app.delete("/api/pre-demandas/:preId/vinculos/:destinoPreId", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_vinculos")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), destinoPreId: z.string().trim().min(1) }).parse(request.params);
    const items = await preDemandaRepository.removeVinculo({
      preId: params.preId,
      destinoPreId: params.destinoPreId,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: items,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/tramitar", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tramitacao")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = tramitarSchema.parse(request.body);
    const record = await preDemandaRepository.tramitar({
      preId: params.preId,
      setorDestinoIds: payload.setores_destino_ids?.length ? payload.setores_destino_ids : [payload.setor_destino_id!],
      observacoes: emptyToNull(payload.observacoes),
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/setores/:setorId/concluir-tramitacao", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tramitacao")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), setorId: z.string().uuid() }).parse(request.params);
    const payload = concluirTramitacaoSchema.parse(request.body);
    const record = await preDemandaRepository.concluirTramitacaoSetor({
      preId: params.preId,
      setorId: params.setorId,
      observacoes: emptyToNull(payload.observacoes),
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/andamentos", { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = andamentoSchema.parse(request.body);
    const andamento = await preDemandaRepository.addAndamento({
      preId: params.preId,
      descricao: payload.descricao,
      dataHora: payload.data_hora ?? null,
      changedByUserId: request.user!.id,
    });

    return reply.status(201).send({
      ok: true,
      data: andamento,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/andamentos/:andamentoId", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), andamentoId: z.string().uuid() }).parse(request.params);
    const payload = andamentoSchema.parse(request.body);
    const andamento = await preDemandaRepository.updateAndamento({
      preId: params.preId,
      andamentoId: params.andamentoId,
      descricao: payload.descricao,
      dataHora: payload.data_hora ?? null,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: andamento,
      error: null,
    });
  });

  app.delete("/api/pre-demandas/:preId/andamentos/:andamentoId", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), andamentoId: z.string().uuid() }).parse(request.params);
    andamentoDeleteSchema.parse(request.body ?? {});
    const result = await preDemandaRepository.removeAndamento({
      preId: params.preId,
      andamentoId: params.andamentoId,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: result,
      error: null,
    });
  });

  app.get("/api/pre-demandas/:preId/tarefas", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tarefas")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const tarefas = await preDemandaRepository.listTarefas(params.preId);
    return reply.send({
      ok: true,
      data: tarefas,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/tarefas", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tarefas")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = tarefaSchema.parse(request.body);
    const tarefa = await preDemandaRepository.createTarefa({
      preId: params.preId,
      descricao: payload.descricao,
      tipo: payload.tipo,
      prazoConclusao: payload.prazo_conclusao,
      recorrenciaTipo: payload.recorrencia_tipo ?? null,
      recorrenciaDiasSemana: payload.recorrencia_dias_semana ?? null,
      recorrenciaDiaMes: payload.recorrencia_dia_mes ?? null,
      setorDestinoId: payload.setor_destino_id ?? null,
      changedByUserId: request.user!.id,
    });

    return reply.status(201).send({
      ok: true,
      data: tarefa,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/tarefas/:tarefaId", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tarefas")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), tarefaId: z.string().uuid() }).parse(request.params);
    const payload = tarefaSchema.parse(request.body);
    const tarefa = await preDemandaRepository.updateTarefa({
      preId: params.preId,
      tarefaId: params.tarefaId,
      descricao: payload.descricao,
      tipo: payload.tipo,
      prazoConclusao: payload.prazo_conclusao,
      recorrenciaTipo: payload.recorrencia_tipo ?? null,
      recorrenciaDiasSemana: payload.recorrencia_dias_semana ?? null,
      recorrenciaDiaMes: payload.recorrencia_dia_mes ?? null,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: tarefa,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/tarefas/ordem", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tarefas")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = tarefaOrderSchema.parse(request.body);
    const tarefas = await preDemandaRepository.reorderTarefas({
      preId: params.preId,
      tarefaIds: payload.tarefa_ids,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: tarefas,
      error: null,
    });
  });

  app.delete("/api/pre-demandas/:preId/tarefas/:tarefaId", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tarefas")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), tarefaId: z.string().uuid() }).parse(request.params);
    const result = await preDemandaRepository.removeTarefa({
      preId: params.preId,
      tarefaId: params.tarefaId,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: result,
      error: null,
    });
  });

  app.get("/api/pre-demandas/:preId/comentarios", { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const comentarios = await preDemandaRepository.listComentarios(params.preId);
    return reply.send({
      ok: true,
      data: comentarios,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/comentarios", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = comentarioSchema.parse(request.body);
    const comentario = await preDemandaRepository.createComentario({
      preId: params.preId,
      conteudo: payload.conteudo,
      formato: payload.formato,
      changedByUserId: request.user!.id,
    });

    return reply.status(201).send({
      ok: true,
      data: comentario,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/comentarios/:comentarioId", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), comentarioId: z.string().uuid() }).parse(request.params);
    const payload = comentarioSchema.parse(request.body);
    const comentario = await preDemandaRepository.updateComentario({
      preId: params.preId,
      comentarioId: params.comentarioId,
      conteudo: payload.conteudo,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: comentario,
      error: null,
    });
  });

  app.get("/api/pre-demandas/:preId/documentos", { preHandler: [app.authenticate, app.authorize("pre_demanda.read")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const documentos = await preDemandaRepository.listDocumentos(params.preId);
    return reply.send({
      ok: true,
      data: documentos,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/documentos", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = documentoSchema.parse(request.body);
    const documento = await preDemandaRepository.createDocumento({
      preId: params.preId,
      nomeArquivo: payload.nome_arquivo,
      mimeType: payload.mime_type,
      tamanhoBytes: Buffer.from(payload.conteudo_base64, "base64").byteLength,
      descricao: emptyToNull(payload.descricao),
      conteudo: Buffer.from(payload.conteudo_base64, "base64"),
      changedByUserId: request.user!.id,
    });

    return reply.status(201).send({
      ok: true,
      data: documento,
      error: null,
    });
  });

  app.get("/api/pre-demandas/:preId/documentos/:documentoId/download", { preHandler: [app.authenticate, app.authorize("pre_demanda.read")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), documentoId: z.string().uuid() }).parse(request.params);
    const result = await preDemandaRepository.downloadDocumento(params.preId, params.documentoId);
    reply.header("content-type", result.documento.mimeType);
    reply.header("content-disposition", `attachment; filename="${encodeURIComponent(result.documento.nomeArquivo)}"`);
    return reply.send(result.conteudo);
  });

  app.delete("/api/pre-demandas/:preId/documentos/:documentoId", { preHandler: [app.authenticate, app.authorize("pre_demanda.update")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), documentoId: z.string().uuid() }).parse(request.params);
    const documentos = await preDemandaRepository.removeDocumento({
      preId: params.preId,
      documentoId: params.documentoId,
      changedByUserId: request.user!.id,
    });
    return reply.send({
      ok: true,
      data: documentos,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/tarefas/:tarefaId/concluir", { preHandler: [app.authenticate, app.authorize("pre_demanda.manage_tarefas")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1), tarefaId: z.string().uuid() }).parse(request.params);
    const tarefa = await preDemandaRepository.concluirTarefa({
      preId: params.preId,
      tarefaId: params.tarefaId,
      changedByUserId: request.user!.id,
    });

    return reply.send({
      ok: true,
      data: tarefa,
      error: null,
    });
  });

  app.patch("/api/pre-demandas/:preId/status", { preHandler: [app.authenticate, app.authorize("pre_demanda.update_status")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = statusSchema.parse(request.body);
    const result = await preDemandaRepository.updateStatus({
      preId: params.preId,
      status: payload.status,
      motivo: emptyToNull(payload.motivo),
      observacoes: emptyToNull(payload.observacoes),
      changedByUserId: request.user!.id,
    });

    request.log.info(
      {
        userId: request.user?.id,
        preId: params.preId,
        status: payload.status,
      },
      "pre-demanda.update-status",
    );

    return reply.send({
      ok: true,
      data: result.record,
      error: null,
    });
  });

  app.post("/api/pre-demandas/:preId/associacoes-sei", { preHandler: [app.authenticate, app.authorize("pre_demanda.associate_sei")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const payload = associateSchema.parse(request.body);
    const result = await preDemandaRepository.associateSei({
      preId: params.preId,
      seiNumero: payload.sei_numero,
      motivo: emptyToNull(payload.motivo),
      observacoes: emptyToNull(payload.observacoes),
      changedByUserId: request.user!.id,
    });

    request.log.info(
      {
        userId: request.user?.id,
        preId: params.preId,
        audited: result.audited,
      },
      "pre-demanda.associate-sei",
    );

    return reply.send({
      ok: true,
      data: result,
      error: null,
    });
  });

  app.get("/api/pre-demandas/:preId/auditoria", { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const audit = await preDemandaRepository.listAudit(params.preId);
    return reply.send({
      ok: true,
      data: audit,
      error: null,
    });
  });

  app.get("/api/pre-demandas/:preId/timeline", { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const timeline = await preDemandaRepository.listTimeline(params.preId);
    return reply.send({
      ok: true,
      data: timeline,
      error: null,
    });
  });
}
