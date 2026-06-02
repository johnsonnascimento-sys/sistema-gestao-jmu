// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import type { AppConfig } from "../config";
import type { DatabasePool } from "../db";
import type { Interessado, Setor } from "../domain/types";

describe("Escala Plantao public routes", () => {
  const config: AppConfig = {
    PORT: 3000,
    DATABASE_URL: "postgres://local/test",
    SESSION_SECRET: "test-session-secret-123",
    CLIENT_ORIGIN: "http://localhost:5173",
    APP_BASE_URL: "http://localhost:3000",
    QUEUE_ATTENTION_DAYS: 2,
    QUEUE_CRITICAL_DAYS: 5,
    OPS_BACKUP_DIR: "/tmp",
    OPS_BACKUP_SCHEMA: "adminlog",
    OPS_EVENT_LOG_PATH: "/tmp/events.jsonl",
    NODE_ENV: "test",
    isProduction: false,
  };

  const pool = {
    query: async () => ({ rows: [{ "?column?": 1 }] }),
    end: async () => undefined,
  } as unknown as DatabasePool;

  const pessoas: Interessado[] = [
    {
      id: "123e4567-e89b-42d3-a456-000000000001",
      nome: "Maria da Escala",
      cargo: "Analista",
      matricula: "MAT-007",
      cpf: "12345678909",
      rg: "MG-123456",
      pai: "Pai Secreto",
      mae: "Mae Secreta",
      endereco: "Rua Alfa, 100",
      dataNascimento: "1985-06-10",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    },
  ];

  const setores: Setor[] = [
    {
      id: "123e4567-e89b-42d3-a456-000000000010",
      sigla: "DIPES",
      nomeCompleto: "Diretoria de Pessoal",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    },
  ];

  const userRepository = {
    findByEmail: async () => null,
    findById: async () => null,
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    listAudit: async () => [],
    update: async () => {
      throw new Error("not used");
    },
    resetPassword: async () => {
      throw new Error("not used");
    },
  } as any;

  const settingsRepository = {
    getQueueHealthConfig: async () => ({
      attentionDays: 2,
      criticalDays: 5,
      updatedAt: null,
      updatedBy: null,
      source: "fallback" as const,
    }),
    updateQueueHealthConfig: async () => {
      throw new Error("not used");
    },
  } as any;

  const preDemandaRepository = {
    processScheduledReopens: async () => 0,
  } as any;

  const noopRepository = {
    create: async () => {
      throw new Error("not used");
    },
    update: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    getById: async () => null,
  } as any;

  const interessadoRepository = {
    list: async () => ({
      items: pessoas,
      total: pessoas.length,
    }),
    listByIds: async (ids: string[]) => pessoas.filter((item) => ids.includes(item.id)),
    getById: async (id: string) => pessoas.find((item) => item.id === id) ?? null,
    create: async () => {
      throw new Error("not used");
    },
    update: async () => {
      throw new Error("not used");
    },
  } as any;

  const setorRepository = {
    list: async () => setores,
    getById: async (id: string) => setores.find((item) => item.id === id) ?? null,
    create: async () => {
      throw new Error("not used");
    },
    update: async () => {
      throw new Error("not used");
    },
  } as any;

  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      config,
      pool,
      userRepository,
      settingsRepository,
      preDemandaRepository,
      preDemandaTarefaRepository: noopRepository,
      preDemandaAndamentoRepository: noopRepository,
      preDemandaAudienciaRepository: noopRepository,
      interessadoRepository,
      assuntoRepository: noopRepository,
      setorRepository,
      normaRepository: noopRepository,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns public pessoas and setores without sensitive fields", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/public/escala/dados",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBeTruthy();

    const data = response.json().data as {
      pessoas: Array<Record<string, unknown>>;
      setores: Array<Record<string, unknown>>;
    };

    expect(data.pessoas).toHaveLength(1);
    const firstPessoa = data.pessoas[0];
    expect(firstPessoa).toBeDefined();
    expect(firstPessoa).toMatchObject({
      nome: "Maria da Escala",
      cargo: "Analista",
      matricula: "MAT-007",
    });
    expect(Object.keys(firstPessoa ?? {}).sort()).toEqual(["cargo", "id", "matricula", "nome"]);
    expect(firstPessoa).not.toHaveProperty("cpf");
    expect(firstPessoa).not.toHaveProperty("rg");
    expect(firstPessoa).not.toHaveProperty("endereco");

    expect(data.setores).toHaveLength(1);
    const firstSetor = data.setores[0];
    expect(firstSetor).toBeDefined();
    expect(firstSetor).toMatchObject({
      sigla: "DIPES",
      nomeCompleto: "Diretoria de Pessoal",
    });
    expect(Object.keys(firstSetor ?? {}).sort()).toEqual(["id", "nomeCompleto", "sigla"]);

    const peopleResponse = await app.inject({
      method: "GET",
      url: "/api/public/escala/pessoas?q=Maria",
    });

    expect(peopleResponse.statusCode).toBe(200);
    expect(peopleResponse.json().data).toHaveLength(1);

    const sectorsResponse = await app.inject({
      method: "GET",
      url: "/api/public/escala/setores",
    });

    expect(sectorsResponse.statusCode).toBe(200);
    expect(sectorsResponse.json().data).toHaveLength(1);
  });
});
