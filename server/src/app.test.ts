// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { hashPassword } from "./auth/password";
import type { AppConfig } from "./config";
import type { AppUser, PreDemandaAuditRecord, PreDemandaDetail, PreDemandaStatus, SeiAssociation } from "./domain/types";
import type {
  AssociateSeiInput,
  AssociateSeiResult,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  CreateUserInput,
  ListPreDemandasParams,
  ListPreDemandasResult,
  PreDemandaRepository,
  UserRepository,
} from "./repositories/types";

class InMemoryUserRepository implements UserRepository {
  private users = new Map<number, AppUser>();
  private nextId = 1;

  async create(input: CreateUserInput) {
    const user: AppUser = {
      id: this.nextId++,
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      active: true,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string) {
    return Array.from(this.users.values()).find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findById(id: number) {
    return this.users.get(id) ?? null;
  }
}

class InMemoryPreDemandaRepository implements PreDemandaRepository {
  private records: PreDemandaDetail[] = [];
  private audit: PreDemandaAuditRecord[] = [];
  private nextId = 1;
  private nextAuditId = 1;

  async create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult> {
    const existing = this.records.find(
      (item) =>
        item.solicitante.trim().toLowerCase() === input.solicitante.trim().toLowerCase() &&
        item.assunto.trim().toLowerCase() === input.assunto.trim().toLowerCase() &&
        item.dataReferencia === input.dataReferencia,
    );

    if (existing) {
      return { record: existing, idempotent: true };
    }

    const record: PreDemandaDetail = {
      id: this.nextId,
      preId: `PRE-2026-${String(this.nextId).padStart(3, "0")}`,
      solicitante: input.solicitante,
      assunto: input.assunto,
      dataReferencia: input.dataReferencia,
      status: "aberta",
      descricao: input.descricao ?? null,
      fonte: input.fonte ?? null,
      observacoes: input.observacoes ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentAssociation: null,
    };

    this.nextId += 1;
    this.records.unshift(record);

    return { record, idempotent: false };
  }

  async list(params: ListPreDemandasParams): Promise<ListPreDemandasResult> {
    let items = [...this.records];

    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter((item) => [item.preId, item.solicitante, item.assunto].some((value) => value.toLowerCase().includes(q)));
    }

    if (params.statuses?.length) {
      items = items.filter((item) => params.statuses?.includes(item.status));
    }

    const start = (params.page - 1) * params.pageSize;
    const paged = items.slice(start, start + params.pageSize);

    return {
      items: paged,
      total: items.length,
    };
  }

  async getStatusCounts() {
    const counts = new Map<PreDemandaStatus, number>([
      ["aberta", 0],
      ["aguardando_sei", 0],
      ["associada", 0],
      ["encerrada", 0],
    ]);

    for (const item of this.records) {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([status, total]) => ({ status, total }));
  }

  async getByPreId(preId: string) {
    return this.records.find((item) => item.preId === preId) ?? null;
  }

  async associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult> {
    const record = this.records.find((item) => item.preId === input.preId);

    if (!record) {
      throw new Error("not found");
    }

    const current = record.currentAssociation;
    const now = new Date().toISOString();
    let audited = false;

    if (current && current.seiNumero !== input.seiNumero) {
      audited = true;
      this.audit.unshift({
        id: this.nextAuditId++,
        preId: input.preId,
        seiNumeroAnterior: current.seiNumero,
        seiNumeroNovo: input.seiNumero,
        motivo: input.motivo ?? null,
        registradoEm: now,
      });
    }

    const association: SeiAssociation = {
      preId: input.preId,
      seiNumero: input.seiNumero,
      linkedAt: current?.linkedAt ?? now,
      updatedAt: now,
      observacoes: input.observacoes ?? null,
    };

    record.currentAssociation = association;
    record.status = "associada";
    record.updatedAt = now;

    return { association, audited };
  }

  async listAudit(preId: string) {
    return this.audit.filter((item) => item.preId === preId);
  }
}

describe("Gestor JMU API", () => {
  const config: AppConfig = {
    PORT: 3000,
    DATABASE_URL: "postgres://local/test",
    SESSION_SECRET: "test-session-secret-123",
    CLIENT_ORIGIN: "http://localhost:5173",
    APP_BASE_URL: "http://localhost:3000",
    NODE_ENV: "test",
    isProduction: false,
  };

  const userRepository = new InMemoryUserRepository();
  const preDemandaRepository = new InMemoryPreDemandaRepository();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Senha1234");
    await userRepository.create({
      email: "operador@jmu.local",
      name: "Operador JMU",
      passwordHash,
      role: "operador",
    });

    app = await buildApp({
      config,
      userRepository,
      preDemandaRepository,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated access", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/pre-demandas",
    });

    expect(response.statusCode).toBe(401);
  });

  it("logs in with valid credentials and rejects invalid ones", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "operador@jmu.local",
        password: "senha-errada",
      },
    });

    expect(invalid.statusCode).toBe(401);

    const valid = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "operador@jmu.local",
        password: "Senha1234",
      },
    });

    expect(valid.statusCode).toBe(200);
    expect(valid.cookies[0]?.name).toBe("jmu_session");
  });

  it("creates a pre-demanda and returns idempotent on duplicate payload", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "operador@jmu.local",
        password: "Senha1234",
      },
    });

    const cookie = `${login.cookies[0]?.name}=${login.cookies[0]?.value}`;

    const created = await app.inject({
      method: "POST",
      url: "/api/pre-demandas",
      headers: { cookie },
      payload: {
        solicitante: "Maria Silva",
        assunto: "Abertura de procedimento",
        data_referencia: "2026-03-09",
        descricao: "Registro inicial",
        fonte: "whatsapp",
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().data.idempotent).toBe(false);

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/pre-demandas",
      headers: { cookie },
      payload: {
        solicitante: "Maria Silva",
        assunto: "Abertura de procedimento",
        data_referencia: "2026-03-09",
      },
    });

    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().data.idempotent).toBe(true);
  });

  it("filters list by status and records audit on reassociation", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "operador@jmu.local",
        password: "Senha1234",
      },
    });

    const cookie = `${login.cookies[0]?.name}=${login.cookies[0]?.value}`;

    await app.inject({
      method: "POST",
      url: "/api/pre-demandas/PRE-2026-001/associacoes-sei",
      headers: { cookie },
      payload: {
        sei_numero: "0000001-10.2026.4.00.0001",
        observacoes: "Primeiro vinculo",
      },
    });

    const reassociation = await app.inject({
      method: "POST",
      url: "/api/pre-demandas/PRE-2026-001/associacoes-sei",
      headers: { cookie },
      payload: {
        sei_numero: "0000001-10.2026.4.00.9999",
        motivo: "Processo corrigido",
      },
    });

    expect(reassociation.statusCode).toBe(200);
    expect(reassociation.json().data.audited).toBe(true);

    const filtered = await app.inject({
      method: "GET",
      url: "/api/pre-demandas?status=associada",
      headers: { cookie },
    });

    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().data.total).toBe(1);

    const audit = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/PRE-2026-001/auditoria",
      headers: { cookie },
    });

    expect(audit.statusCode).toBe(200);
    expect(audit.json().data).toHaveLength(1);
  });
});
