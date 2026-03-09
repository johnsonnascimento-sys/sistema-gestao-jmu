import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PreDemandaSortBy, PreDemandaStatus, SortOrder } from "../domain/types";
import { AppError } from "../errors";
import type { PreDemandaRepository } from "../repositories/types";

const STATUSES: PreDemandaStatus[] = ["aberta", "aguardando_sei", "associada", "encerrada"];
const SORT_FIELDS: PreDemandaSortBy[] = ["updatedAt", "createdAt", "dataReferencia", "solicitante", "status"];
const SORT_ORDERS: SortOrder[] = ["asc", "desc"];
const SEI_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

const createSchema = z.object({
  solicitante: z.string().trim().min(3),
  assunto: z.string().trim().min(3),
  data_referencia: z.string().date(),
  descricao: z.string().trim().max(4000).optional().nullable(),
  fonte: z.string().trim().max(120).optional().nullable(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
});

const listSchema = z.object({
  q: z.string().trim().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  hasSei: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(SORT_FIELDS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const listRecentTimelineSchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const associateSchema = z.object({
  sei_numero: z.string().trim().regex(SEI_REGEX, "Numero SEI invalido."),
  motivo: z.string().trim().max(2000).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

const statusSchema = z.object({
  status: z.enum(STATUSES),
  motivo: z.string().trim().max(2000).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

function emptyToNull(value: string | null | undefined) {
  return value && value.length > 0 ? value : null;
}

function parseStatuses(input: string | string[] | undefined) {
  if (!input) {
    return [];
  }

  const values = Array.isArray(input) ? input : input.split(",");
  const normalized = values.map((value) => value.trim()).filter(Boolean);

  for (const value of normalized) {
    if (!STATUSES.includes(value as PreDemandaStatus)) {
      throw new AppError(400, "INVALID_STATUS_FILTER", `Status invalido: ${value}`);
    }
  }

  return normalized as PreDemandaStatus[];
}

export async function registerPreDemandaRoutes(app: FastifyInstance, options: { preDemandaRepository: PreDemandaRepository }) {
  const { preDemandaRepository } = options;

  app.post("/api/pre-demandas", { preHandler: [app.authenticate, app.authorize("pre_demanda.create")] }, async (request, reply) => {
    const payload = createSchema.parse(request.body);
    const result = await preDemandaRepository.create({
      solicitante: payload.solicitante,
      assunto: payload.assunto,
      dataReferencia: payload.data_referencia,
      descricao: emptyToNull(payload.descricao),
      fonte: emptyToNull(payload.fonte),
      observacoes: emptyToNull(payload.observacoes),
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
    const [listResult, counts] = await Promise.all([
      preDemandaRepository.list({
        q: query.q,
        statuses,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        hasSei: query.hasSei ? query.hasSei === "true" : undefined,
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

  app.get(
    "/api/pre-demandas/dashboard/resumo",
    { preHandler: [app.authenticate, app.authorize("dashboard.read")] },
    async (_request, reply) => {
      const summary = await preDemandaRepository.getDashboardSummary();

      return reply.send({
        ok: true,
        data: summary,
        error: null,
      });
    },
  );

  app.get(
    "/api/pre-demandas/timeline/recentes",
    { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] },
    async (request, reply) => {
      const query = listRecentTimelineSchema.parse(request.query);
      const items = await preDemandaRepository.listRecentTimeline(query.limit ?? 8);

      return reply.send({
        ok: true,
        data: items,
        error: null,
      });
    },
  );

  app.get("/api/pre-demandas/:preId", { preHandler: [app.authenticate, app.authorize("pre_demanda.read")] }, async (request, reply) => {
    const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
    const record = await preDemandaRepository.getByPreId(params.preId);

    if (!record) {
      throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
    }

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  });

  app.patch(
    "/api/pre-demandas/:preId/status",
    { preHandler: [app.authenticate, app.authorize("pre_demanda.update_status")] },
    async (request, reply) => {
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
    },
  );

  app.post(
    "/api/pre-demandas/:preId/associacoes-sei",
    { preHandler: [app.authenticate, app.authorize("pre_demanda.associate_sei")] },
    async (request, reply) => {
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
    },
  );

  app.get(
    "/api/pre-demandas/:preId/auditoria",
    { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] },
    async (request, reply) => {
      const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
      const audit = await preDemandaRepository.listAudit(params.preId);

      return reply.send({
        ok: true,
        data: audit,
        error: null,
      });
    },
  );

  app.get(
    "/api/pre-demandas/:preId/timeline",
    { preHandler: [app.authenticate, app.authorize("pre_demanda.read_timeline")] },
    async (request, reply) => {
      const params = z.object({ preId: z.string().trim().min(1) }).parse(request.params);
      const timeline = await preDemandaRepository.listTimeline(params.preId);

      return reply.send({
        ok: true,
        data: timeline,
        error: null,
      });
    },
  );
}
