// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { hashPassword } from "./auth/password";
import type { AppConfig } from "./config";
import type { DatabasePool } from "./db";
import type {
  AdminUserAuditRecord,
  AdminUserSummary,
  AppUser,
  PreDemandaAuditRecord,
  PreDemandaDashboardSummary,
  PreDemandaDetail,
  PreDemandaStatus,
  PreDemandaStatusAuditRecord,
  SeiAssociation,
  TimelineEvent,
} from "./domain/types";
import type {
  AssociateSeiInput,
  AssociateSeiResult,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  CreateUserInput,
  ListPreDemandasParams,
  ListPreDemandasResult,
  PreDemandaRepository,
  ResetUserPasswordInput,
  UpdatePreDemandaStatusInput,
  UpdatePreDemandaStatusResult,
  UpdateUserInput,
  UserRepository,
} from "./repositories/types";

class InMemoryUserRepository implements UserRepository {
  private users = new Map<number, AppUser>();
  private audit: AdminUserAuditRecord[] = [];
  private nextId = 1;
  private nextAuditId = 1;

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
    this.audit.unshift({
      id: this.nextAuditId++,
      action: "user_created",
      actor: input.changedByUserId ? this.toActor(input.changedByUserId) : null,
      targetUser: this.toAuditTarget(user),
      nameAnterior: null,
      nameNovo: user.name,
      roleAnterior: null,
      roleNovo: user.role,
      activeAnterior: null,
      activeNovo: user.active,
      registradoEm: new Date().toISOString(),
    });
    return user;
  }

  async findByEmail(email: string) {
    return Array.from(this.users.values()).find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findById(id: number) {
    return this.users.get(id) ?? null;
  }

  async list() {
    return Array.from(this.users.values()).map<AdminUserSummary>(({ passwordHash: _passwordHash, ...user }) => user);
  }

  async listAudit(limit = 12) {
    return this.audit.slice(0, limit);
  }

  async update(input: UpdateUserInput) {
    const current = this.users.get(input.id);

    if (!current) {
      throw new Error("not found");
    }

    const next: AppUser = {
      ...current,
      name: input.name ?? current.name,
      role: input.role ?? current.role,
      active: input.active ?? current.active,
      updatedAt: new Date().toISOString(),
    };

    this.users.set(next.id, next);
    const actor = input.changedByUserId ? this.toActor(input.changedByUserId) : null;

    if (input.name !== undefined && input.name !== current.name) {
      this.audit.unshift({
        id: this.nextAuditId++,
        action: "user_name_changed",
        actor,
        targetUser: this.toAuditTarget(next),
        nameAnterior: current.name,
        nameNovo: next.name,
        roleAnterior: null,
        roleNovo: null,
        activeAnterior: null,
        activeNovo: null,
        registradoEm: new Date().toISOString(),
      });
    }

    if (input.role !== undefined && input.role !== current.role) {
      this.audit.unshift({
        id: this.nextAuditId++,
        action: "user_role_changed",
        actor,
        targetUser: this.toAuditTarget(next),
        nameAnterior: null,
        nameNovo: null,
        roleAnterior: current.role,
        roleNovo: next.role,
        activeAnterior: null,
        activeNovo: null,
        registradoEm: new Date().toISOString(),
      });
    }

    if (input.active !== undefined && input.active !== current.active) {
      this.audit.unshift({
        id: this.nextAuditId++,
        action: input.active ? "user_activated" : "user_deactivated",
        actor,
        targetUser: this.toAuditTarget(next),
        nameAnterior: null,
        nameNovo: null,
        roleAnterior: null,
        roleNovo: null,
        activeAnterior: current.active,
        activeNovo: next.active,
        registradoEm: new Date().toISOString(),
      });
    }

    const { passwordHash: _passwordHash, ...summary } = next;
    return summary;
  }

  async resetPassword(input: ResetUserPasswordInput) {
    const current = this.users.get(input.id);

    if (!current) {
      throw new Error("not found");
    }

    const next: AppUser = {
      ...current,
      passwordHash: input.passwordHash,
      updatedAt: new Date().toISOString(),
    };

    this.users.set(next.id, next);
    this.audit.unshift({
      id: this.nextAuditId++,
      action: "user_password_reset",
      actor: input.changedByUserId ? this.toActor(input.changedByUserId) : null,
      targetUser: this.toAuditTarget(next),
      nameAnterior: null,
      nameNovo: null,
      roleAnterior: null,
      roleNovo: null,
      activeAnterior: null,
      activeNovo: null,
      registradoEm: new Date().toISOString(),
    });
    const { passwordHash: _passwordHash, ...summary } = next;
    return summary;
  }

  private toActor(id: number) {
    const user = this.users.get(id);
    return user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      : null;
  }

  private toSummary(user: AppUser): AdminUserSummary {
    const { passwordHash: _passwordHash, ...summary } = user;
    return summary;
  }

  private toAuditTarget(user: AppUser) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
    };
  }
}

class InMemoryPreDemandaRepository implements PreDemandaRepository {
  private records: PreDemandaDetail[] = [];
  private audit: PreDemandaAuditRecord[] = [];
  private statusAudit: PreDemandaStatusAuditRecord[] = [];
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
      return { record: existing, idempotent: true, existingPreId: existing.preId };
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
      createdBy: null,
      currentAssociation: null,
    };

    this.nextId += 1;
    this.records.unshift(record);

    return { record, idempotent: false, existingPreId: null };
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

    if (params.dateFrom) {
      items = items.filter((item) => item.dataReferencia >= params.dateFrom!);
    }

    if (params.dateTo) {
      items = items.filter((item) => item.dataReferencia <= params.dateTo!);
    }

    if (params.hasSei === true) {
      items = items.filter((item) => item.currentAssociation !== null);
    }

    if (params.hasSei === false) {
      items = items.filter((item) => item.currentAssociation === null);
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
        observacoes: input.observacoes ?? null,
        registradoEm: now,
        changedBy: null,
      });
    }

    const association: SeiAssociation = {
      preId: input.preId,
      seiNumero: input.seiNumero,
      linkedAt: current?.linkedAt ?? now,
      updatedAt: now,
      observacoes: input.observacoes ?? null,
      linkedBy: null,
    };

    record.currentAssociation = association;
    if (record.status !== "associada") {
      this.statusAudit.unshift({
        id: this.nextAuditId++,
        preId: input.preId,
        statusAnterior: record.status,
        statusNovo: "associada",
        motivo: input.motivo ?? "Associacao de numero SEI.",
        observacoes: input.observacoes ?? null,
        registradoEm: now,
        changedBy: null,
      });
    }
    record.status = "associada";
    record.updatedAt = now;

    return { association, audited };
  }

  async listAudit(preId: string) {
    return this.audit.filter((item) => item.preId === preId);
  }

  async updateStatus(input: UpdatePreDemandaStatusInput): Promise<UpdatePreDemandaStatusResult> {
    const record = this.records.find((item) => item.preId === input.preId);

    if (!record) {
      throw new Error("not found");
    }

    const now = new Date().toISOString();
    this.statusAudit.unshift({
      id: this.nextAuditId++,
      preId: input.preId,
      statusAnterior: record.status,
      statusNovo: input.status,
      motivo: input.motivo ?? null,
      observacoes: input.observacoes ?? null,
      registradoEm: now,
      changedBy: null,
    });

    record.status = input.status;
    record.updatedAt = now;

    return { record };
  }

  async listStatusAudit(preId: string) {
    return this.statusAudit.filter((item) => item.preId === preId);
  }

  async listTimeline(preId: string): Promise<TimelineEvent[]> {
    const record = this.records.find((item) => item.preId === preId);

    if (!record) {
      return [];
    }

    const created: TimelineEvent = {
      id: `created-${record.id}`,
      preId,
      type: "created",
      occurredAt: record.createdAt,
      actor: null,
      motivo: null,
      observacoes: record.observacoes,
      statusAnterior: null,
      statusNovo: record.status,
      seiNumeroAnterior: null,
      seiNumeroNovo: null,
    };

    const statusEvents = this.statusAudit
      .filter((item) => item.preId === preId)
      .map<TimelineEvent>((item) => ({
        id: `status-${item.id}`,
        preId,
        type: "status_changed",
        occurredAt: item.registradoEm,
        actor: item.changedBy,
        motivo: item.motivo,
        observacoes: item.observacoes,
        statusAnterior: item.statusAnterior,
        statusNovo: item.statusNovo,
        seiNumeroAnterior: null,
        seiNumeroNovo: null,
      }));

    const seiEvents = this.audit
      .filter((item) => item.preId === preId)
      .map<TimelineEvent>((item) => ({
        id: `sei-${item.id}`,
        preId,
        type: "sei_reassociated",
        occurredAt: item.registradoEm,
        actor: item.changedBy,
        motivo: item.motivo,
        observacoes: item.observacoes,
        statusAnterior: null,
        statusNovo: null,
        seiNumeroAnterior: item.seiNumeroAnterior,
        seiNumeroNovo: item.seiNumeroNovo,
      }));

    return [created, ...statusEvents, ...seiEvents];
  }

  async listRecentTimeline(limit = 8): Promise<TimelineEvent[]> {
    const events = this.records.flatMap((record) => this.listTimeline(record.preId));
    return (await Promise.all(events))
      .flat()
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, limit);
  }

  async getDashboardSummary(): Promise<PreDemandaDashboardSummary> {
    const counts = await this.getStatusCounts();
    const recentTimeline = await this.listRecentTimeline(8);
    const awaitingSeiItems = this.records
      .filter((item) => item.status === "aguardando_sei")
      .sort((left, right) => left.dataReferencia.localeCompare(right.dataReferencia))
      .slice(0, 5);

    return {
      counts,
      reopenedLast30Days: this.statusAudit.filter((item) => item.statusAnterior === "encerrada" && item.statusNovo !== "encerrada").length,
      closedLast30Days: this.statusAudit.filter((item) => item.statusNovo === "encerrada").length,
      awaitingSeiItems,
      recentTimeline,
    };
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
  const pool = {
    query: async () => ({ rows: [{ "?column?": 1 }] }),
    end: async () => undefined,
  } as unknown as DatabasePool;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Senha1234");
    await userRepository.create({
      email: "operador@jmu.local",
      name: "Operador JMU",
      passwordHash,
      role: "operador",
    });

    await userRepository.create({
      email: "admin@jmu.local",
      name: "Admin JMU",
      passwordHash,
      role: "admin",
    });

    app = await buildApp({
      config,
      pool,
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

  it("exposes runtime metadata on health and ready endpoints", async () => {
    const health = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(health.statusCode).toBe(200);
    expect(health.headers["x-request-id"]).toBeTruthy();
    expect(health.json().data.status).toBe("up");
    expect(typeof health.json().data.version).toBe("string");
    expect(typeof health.json().data.uptimeSeconds).toBe("number");

    const ready = await app.inject({
      method: "GET",
      url: "/api/ready",
    });

    expect(ready.statusCode).toBe(200);
    expect(ready.json().data.status).toBe("ready");
    expect(ready.json().data.database.status).toBe("ready");
    expect(typeof ready.json().data.database.latencyMs).toBe("number");
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
    expect(created.json().data.existingPreId).toBeNull();

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
    expect(duplicate.json().data.existingPreId).toBe("PRE-2026-001");
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

  it("updates status and returns unified timeline", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "operador@jmu.local",
        password: "Senha1234",
      },
    });

    const cookie = `${login.cookies[0]?.name}=${login.cookies[0]?.value}`;

    const updated = await app.inject({
      method: "PATCH",
      url: "/api/pre-demandas/PRE-2026-001/status",
      headers: { cookie },
      payload: {
        status: "encerrada",
        motivo: "Encerramento de teste",
      },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.status).toBe("encerrada");

    const timeline = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/PRE-2026-001/timeline",
      headers: { cookie },
    });

    expect(timeline.statusCode).toBe(200);
    expect(timeline.json().data.length).toBeGreaterThan(0);

    const recentTimeline = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/timeline/recentes?limit=5",
      headers: { cookie },
    });

    expect(recentTimeline.statusCode).toBe(200);
    expect(recentTimeline.json().data.length).toBeGreaterThan(0);

    const dashboardSummary = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/dashboard/resumo",
      headers: { cookie },
    });

    expect(dashboardSummary.statusCode).toBe(200);
    expect(dashboardSummary.json().data.recentTimeline.length).toBeGreaterThan(0);
    expect(typeof dashboardSummary.json().data.closedLast30Days).toBe("number");
  });

  it("forbids operator admin access and allows admin user management", async () => {
    const operatorLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "operador@jmu.local",
        password: "Senha1234",
      },
    });

    const operatorCookie = `${operatorLogin.cookies[0]?.name}=${operatorLogin.cookies[0]?.value}`;

    const forbidden = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { cookie: operatorCookie },
    });

    expect(forbidden.statusCode).toBe(403);

    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "admin@jmu.local",
        password: "Senha1234",
      },
    });

    const adminCookie = `${adminLogin.cookies[0]?.name}=${adminLogin.cookies[0]?.value}`;

    const listed = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { cookie: adminCookie },
    });

    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.length).toBeGreaterThanOrEqual(2);

    const created = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { cookie: adminCookie },
      payload: {
        email: "novo@jmu.local",
        name: "Novo Usuario",
        password: "Senha1234",
        role: "operador",
      },
    });

    expect(created.statusCode).toBe(201);

    const createdId = created.json().data.id as number;

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${createdId}`,
      headers: { cookie: adminCookie },
      payload: {
        role: "admin",
        active: false,
      },
    });

    expect(updated.statusCode).toBe(200);

    const reset = await app.inject({
      method: "POST",
      url: `/api/admin/users/${createdId}/reset-password`,
      headers: { cookie: adminCookie },
      payload: {
        password: "SenhaNova1234",
      },
    });

    expect(reset.statusCode).toBe(200);

    const audit = await app.inject({
      method: "GET",
      url: "/api/admin/users/auditoria?limit=10",
      headers: { cookie: adminCookie },
    });

    expect(audit.statusCode).toBe(200);
    expect(audit.json().data.some((item: AdminUserAuditRecord) => item.action === "user_created")).toBe(true);
    expect(audit.json().data.some((item: AdminUserAuditRecord) => item.action === "user_role_changed")).toBe(true);
    expect(audit.json().data.some((item: AdminUserAuditRecord) => item.action === "user_deactivated")).toBe(true);
    expect(audit.json().data.some((item: AdminUserAuditRecord) => item.action === "user_password_reset")).toBe(true);
  });
});
