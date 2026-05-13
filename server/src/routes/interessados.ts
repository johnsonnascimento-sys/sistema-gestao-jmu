import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { InteressadoRepository } from "../repositories/types";
import { AppError } from "../errors";

function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

function isValidCpf(value: string) {
  if (value.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(value)) return false;

  const digits = value.split("").map((item) => Number(item));
  if (digits.some((item) => Number.isNaN(item))) return false;

  const calc = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += (digits[index] ?? 0) * (length + 1 - index);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(9);
  const d2 = calc(10);
  return d1 === digits[9] && d2 === digits[10];
}

const cpfSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = normalizeCpf(value);
    return normalized.length === 0 ? null : normalized;
  },
  z
    .string()
    .length(11, "CPF deve ter 11 digitos.")
    .refine((value) => isValidCpf(value), "CPF invalido.")
    .optional()
    .nullable(),
);

const interessadoSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  cargo: z.string().trim().max(255).optional().nullable(),
  matricula: z.string().trim().max(50).optional().nullable(),
  cpf: cpfSchema,
  rg: z.string().trim().max(30).optional().nullable(),
  pai: z.string().trim().max(255).optional().nullable(),
  mae: z.string().trim().max(255).optional().nullable(),
  endereco: z.string().trim().max(4000).optional().nullable(),
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

  const listHandler = async (request: { query: unknown }, reply: { send: (payload: unknown) => unknown }) => {
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
  };

  const createHandler = async (
    request: { body: unknown },
    reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
  ) => {
    const payload = interessadoSchema.safeParse(request.body);
    if (!payload.success) {
      throw new AppError(400, "INTERESSADO_INVALID", payload.error.issues[0]?.message ?? "Dados invalidos.");
    }
    const record = await interessadoRepository.create({
      nome: payload.data.nome,
      cargo: emptyToNull(payload.data.cargo),
      matricula: emptyToNull(payload.data.matricula),
      cpf: emptyToNull(payload.data.cpf),
      rg: emptyToNull(payload.data.rg),
      pai: emptyToNull(payload.data.pai),
      mae: emptyToNull(payload.data.mae),
      endereco: emptyToNull(payload.data.endereco),
      dataNascimento: payload.data.data_nascimento ?? null,
    });

    return reply.status(201).send({
      ok: true,
      data: record,
      error: null,
    });
  };

  const updateHandler = async (request: { params: unknown; body: unknown }, reply: { send: (payload: unknown) => unknown }) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = interessadoSchema.safeParse(request.body);
    if (!payload.success) {
      throw new AppError(400, "INTERESSADO_INVALID", payload.error.issues[0]?.message ?? "Dados invalidos.");
    }
    const record = await interessadoRepository.update({
      id: params.id,
      nome: payload.data.nome,
      cargo: emptyToNull(payload.data.cargo),
      matricula: emptyToNull(payload.data.matricula),
      cpf: emptyToNull(payload.data.cpf),
      rg: emptyToNull(payload.data.rg),
      pai: emptyToNull(payload.data.pai),
      mae: emptyToNull(payload.data.mae),
      endereco: emptyToNull(payload.data.endereco),
      dataNascimento: payload.data.data_nascimento ?? null,
    });

    return reply.send({
      ok: true,
      data: record,
      error: null,
    });
  };

  app.get("/api/interessados", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.read")] }, listHandler);
  app.get("/api/pessoas", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.read")] }, listHandler);
  app.post("/api/interessados", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.write")] }, createHandler);
  app.post("/api/pessoas", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.write")] }, createHandler);
  app.patch("/api/interessados/:id", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.write")] }, updateHandler);
  app.patch("/api/pessoas/:id", { preHandler: [app.authenticate, app.authorize("cadastro.interessado.write")] }, updateHandler);
}
