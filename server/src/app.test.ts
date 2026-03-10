// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./app";
import { hashPassword } from "./auth/password";
import type { AppConfig } from "./config";
import type { DatabasePool } from "./db";
import { buildQueueHealth, type QueueHealthThresholds } from "./domain/queue-health";
import { getAllowedNextStatuses } from "./domain/pre-demanda-status";
import type {
  AdminOpsSummary,
  AdminUserAuditRecord,
  AdminUserSummary,
  Andamento,
  AppUser,
  DemandaInteressado,
  DemandaVinculo,
  Interessado,
  PreDemandaAuditRecord,
  PreDemandaDashboardSummary,
  PreDemandaDetail,
  PreDemandaMetadata,
  PreDemandaStatus,
  PreDemandaStatusAuditRecord,
  QueueHealthConfig,
  Setor,
  SeiAssociation,
  TarefaPendente,
  TimelineEvent,
} from "./domain/types";
import type {
  AddAndamentoInput,
  AddDemandaInteressadoInput,
  AddDemandaVinculoInput,
  AssociateSeiInput,
  AssociateSeiResult,
  ConcluirTarefaInput,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  CreateInteressadoInput,
  CreateSetorInput,
  CreateTarefaInput,
  CreateUserInput,
  InteressadoRepository,
  ListPreDemandasParams,
  ListPreDemandasResult,
  ListInteressadosParams,
  ListInteressadosResult,
  PreDemandaRepository,
  RemoveDemandaInteressadoInput,
  RemoveDemandaVinculoInput,
  ResetUserPasswordInput,
  SetorRepository,
  SettingsRepository,
  TramitarPreDemandaInput,
  UpdateInteressadoInput,
  UpdatePreDemandaAnotacoesInput,
  UpdatePreDemandaCaseDataInput,
  UpdatePreDemandaStatusInput,
  UpdatePreDemandaStatusResult,
  UpdateQueueHealthConfigInput,
  UpdateSetorInput,
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

function defaultMetadata(metadata?: Partial<PreDemandaMetadata> | null): PreDemandaMetadata {
  return {
    frequencia: metadata?.frequencia ?? null,
    pagamentoEnvolvido: metadata?.pagamentoEnvolvido ?? null,
    audienciaData: metadata?.audienciaData ?? null,
    audienciaStatus: metadata?.audienciaStatus ?? null,
  };
}

class InMemoryPreDemandaRepository implements PreDemandaRepository {
  private records: PreDemandaDetail[] = [];
  private audit: PreDemandaAuditRecord[] = [];
  private statusAudit: PreDemandaStatusAuditRecord[] = [];
  private andamentos: Andamento[] = [];
  private nextId = 1;
  private nextAuditId = 1;
  private readonly queueHealthThresholds: QueueHealthThresholds = {
    attentionDays: 2,
    criticalDays: 5,
  };

  private touch(record: PreDemandaDetail) {
    record.updatedAt = new Date().toISOString();
    record.queueHealth = buildQueueHealth(record.status, record.updatedAt, record.dataReferencia, this.queueHealthThresholds);
    record.allowedNextStatuses = getAllowedNextStatuses({ currentStatus: record.status, hasAssociation: record.currentAssociation !== null });
    return record;
  }

  private addAndamentoRecord(
    record: PreDemandaDetail,
    descricao: string,
    tipo: Andamento["tipo"],
    occurredAt = new Date().toISOString(),
  ) {
    const andamento: Andamento = {
      id: `and-${record.id}-${this.nextAuditId++}`,
      preId: record.preId,
      dataHora: occurredAt,
      descricao,
      tipo,
      createdBy: null,
    };

    this.andamentos.unshift(andamento);
    record.recentAndamentos = this.andamentos.filter((item) => item.preId === record.preId).slice(0, 8);
    return andamento;
  }

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
      prazoFinal: input.prazoFinal ?? null,
      dataConclusao: null,
      numeroJudicial: input.numeroJudicial ?? null,
      anotacoes: null,
      setorAtual: null,
      metadata: defaultMetadata(input.metadata),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: null,
      currentAssociation: null,
      queueHealth: buildQueueHealth("aberta", new Date().toISOString(), input.dataReferencia, this.queueHealthThresholds),
      allowedNextStatuses: getAllowedNextStatuses({ currentStatus: "aberta", hasAssociation: false }),
      interessados: [],
      vinculos: [],
      tarefasPendentes: [],
      recentAndamentos: [],
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

    if (params.queueHealthLevels?.length) {
      items = items.filter((item) => params.queueHealthLevels?.includes(item.queueHealth.level));
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

  async updateCaseData(input: UpdatePreDemandaCaseDataInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    record.assunto = input.assunto ?? record.assunto;
    if (input.descricao !== undefined) record.descricao = input.descricao;
    if (input.fonte !== undefined) record.fonte = input.fonte;
    if (input.observacoes !== undefined) record.observacoes = input.observacoes;
    if (input.prazoFinal !== undefined) record.prazoFinal = input.prazoFinal;
    if (input.numeroJudicial !== undefined) record.numeroJudicial = input.numeroJudicial;
    if (input.metadata !== undefined) {
      record.metadata = {
        ...record.metadata,
        ...defaultMetadata(input.metadata),
      };
    }

    return this.touch(record);
  }

  async updateAnotacoes(input: UpdatePreDemandaAnotacoesInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    record.anotacoes = input.anotacoes;
    return this.touch(record);
  }

  async addInteressado(input: AddDemandaInteressadoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    if (record.interessados.some((item) => item.interessado.id === input.interessadoId)) {
      throw new Error("duplicate");
    }

    const interessado: Interessado = {
      id: input.interessadoId,
      nome: `Interessado ${input.interessadoId.slice(0, 4)}`,
      matricula: null,
      cpf: null,
      dataNascimento: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    record.interessados.unshift({
      interessado,
      papel: input.papel,
      linkedAt: new Date().toISOString(),
      linkedBy: null,
    });
    this.addAndamentoRecord(record, `Interessado ${interessado.nome} vinculado ao processo como ${input.papel}.`, "interessado_added");
    this.touch(record);
    return record.interessados;
  }

  async removeInteressado(input: RemoveDemandaInteressadoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    const current = record.interessados.find((item) => item.interessado.id === input.interessadoId);
    record.interessados = record.interessados.filter((item) => item.interessado.id !== input.interessadoId);
    if (current) {
      this.addAndamentoRecord(record, `Interessado ${current.interessado.nome} removido do processo.`, "interessado_removed");
    }
    this.touch(record);
    return record.interessados;
  }

  async addVinculo(input: AddDemandaVinculoInput) {
    const origem = this.records.find((item) => item.preId === input.preId);
    const destino = this.records.find((item) => item.preId === input.destinoPreId);
    if (!origem || !destino) {
      throw new Error("not found");
    }

    if (!origem.vinculos.some((item) => item.processo.preId === destino.preId)) {
      const vinculo: DemandaVinculo = {
        processo: {
          id: destino.id,
          preId: destino.preId,
          assunto: destino.assunto,
          status: destino.status,
          dataReferencia: destino.dataReferencia,
          createdAt: destino.createdAt,
          updatedAt: destino.updatedAt,
        },
        linkedAt: new Date().toISOString(),
        linkedBy: null,
      };

      origem.vinculos.unshift(vinculo);
      this.addAndamentoRecord(origem, `Processo vinculado a ${destino.preId}.`, "vinculo_added");
      this.touch(origem);
    }

    return origem.vinculos;
  }

  async removeVinculo(input: RemoveDemandaVinculoInput) {
    const origem = this.records.find((item) => item.preId === input.preId);
    if (!origem) {
      throw new Error("not found");
    }

    origem.vinculos = origem.vinculos.filter((item) => item.processo.preId !== input.destinoPreId);
    this.addAndamentoRecord(origem, `Vinculo com ${input.destinoPreId} removido.`, "vinculo_removed");
    this.touch(origem);
    return origem.vinculos;
  }

  async tramitar(input: TramitarPreDemandaInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    record.setorAtual = {
      id: input.setorDestinoId,
      sigla: "DIPES",
      nomeCompleto: "Diretoria de Pessoal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.addAndamentoRecord(record, `Processo remetido para ${record.setorAtual.sigla}.`, "tramitacao");
    return this.touch(record);
  }

  async addAndamento(input: AddAndamentoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    return this.addAndamentoRecord(record, input.descricao, "manual", input.dataHora ?? new Date().toISOString());
  }

  async listTarefas(preId: string) {
    return this.records.find((item) => item.preId === preId)?.tarefasPendentes ?? [];
  }

  async createTarefa(input: CreateTarefaInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    const tarefa: TarefaPendente = {
      id: `123e4567-e89b-42d3-a456-${String(record.tarefasPendentes.length + 1).padStart(12, "0")}`,
      preId: record.preId,
      descricao: input.descricao,
      tipo: input.tipo,
      concluida: false,
      concluidaEm: null,
      concluidaPor: null,
      createdAt: new Date().toISOString(),
      createdBy: null,
    };

    record.tarefasPendentes.unshift(tarefa);
    return tarefa;
  }

  async concluirTarefa(input: ConcluirTarefaInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    const tarefa = record.tarefasPendentes.find((item) => item.id === input.tarefaId);
    if (!tarefa) {
      throw new Error("not found");
    }

    if (tarefa.concluida) {
      throw new Error("already-done");
    }

    tarefa.concluida = true;
    tarefa.concluidaEm = new Date().toISOString();
    this.addAndamentoRecord(record, `Tarefa concluida: ${tarefa.descricao}.`, "tarefa_concluida");
    return tarefa;
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
    this.addAndamentoRecord(record, current ? `Numero SEI alterado de ${current.seiNumero} para ${input.seiNumero}.` : `Numero SEI associado: ${input.seiNumero}.`, "sei");
    this.touch(record);

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
    const previousStatus = record.status;
    this.statusAudit.unshift({
      id: this.nextAuditId++,
      preId: input.preId,
      statusAnterior: previousStatus,
      statusNovo: input.status,
      motivo: input.motivo ?? null,
      observacoes: input.observacoes ?? null,
      registradoEm: now,
      changedBy: null,
    });

    record.status = input.status;
    record.dataConclusao = input.status === "encerrada" ? now.slice(0, 10) : record.dataConclusao ? null : record.dataConclusao;
    this.addAndamentoRecord(
      record,
      input.status === "encerrada"
        ? `Processo encerrado. Motivo: ${input.motivo}.`
        : previousStatus === "encerrada"
          ? `Processo reaberto. Motivo: ${input.motivo}.`
          : `Status alterado para ${input.status}.`,
      "status",
    );
    this.touch(record);

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
      descricao: `Demanda criada: ${record.assunto}`,
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
        descricao: `Status alterado de ${item.statusAnterior} para ${item.statusNovo}.`,
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
        descricao: `Numero SEI alterado de ${item.seiNumeroAnterior} para ${item.seiNumeroNovo}.`,
        statusAnterior: null,
        statusNovo: null,
        seiNumeroAnterior: item.seiNumeroAnterior,
        seiNumeroNovo: item.seiNumeroNovo,
      }));

    const andamentoEvents = this.andamentos
      .filter((item) => item.preId === preId)
      .map<TimelineEvent>((item) => ({
        id: item.id,
        preId,
        type:
          item.tipo === "tramitacao"
            ? "tramitation"
            : item.tipo === "tarefa_concluida"
              ? "task_completed"
              : item.tipo === "interessado_added"
                ? "interessado_added"
                : item.tipo === "interessado_removed"
                  ? "interessado_removed"
                  : item.tipo === "vinculo_added"
                    ? "vinculo_added"
                    : item.tipo === "vinculo_removed"
                      ? "vinculo_removed"
                      : "andamento",
        occurredAt: item.dataHora,
        actor: item.createdBy,
        motivo: null,
        observacoes: null,
        descricao: item.descricao,
        statusAnterior: null,
        statusNovo: null,
        seiNumeroAnterior: null,
        seiNumeroNovo: null,
      }));

    return [created, ...statusEvents, ...seiEvents, ...andamentoEvents].sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
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
    const staleItems = this.records
      .filter((item) => item.queueHealth.level === "attention" || item.queueHealth.level === "critical")
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
      .slice(0, 5);

    return {
      counts,
      reopenedLast30Days: this.statusAudit.filter((item) => item.statusAnterior === "encerrada" && item.statusNovo !== "encerrada").length,
      closedLast30Days: this.statusAudit.filter((item) => item.statusNovo === "encerrada").length,
      agingAttentionTotal: this.records.filter((item) => item.queueHealth.level === "attention").length,
      agingCriticalTotal: this.records.filter((item) => item.queueHealth.level === "critical").length,
      dueSoonTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal !== null).length,
      overdueTotal: 0,
      withoutSetorTotal: this.records.filter((item) => item.status !== "encerrada" && item.setorAtual === null).length,
      withoutInteressadosTotal: this.records.filter((item) => item.status !== "encerrada" && item.interessados.length === 0).length,
      staleItems,
      awaitingSeiItems,
      dueSoonItems: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal !== null).slice(0, 5),
      withoutSetorItems: this.records.filter((item) => item.status !== "encerrada" && item.setorAtual === null).slice(0, 5),
      withoutInteressadosItems: this.records.filter((item) => item.status !== "encerrada" && item.interessados.length === 0).slice(0, 5),
      recentTimeline,
    };
  }
}

class InMemoryInteressadoRepository implements InteressadoRepository {
  private items = new Map<string, Interessado>();
  private nextId = 1;

  async list(params: ListInteressadosParams): Promise<ListInteressadosResult> {
    let items = Array.from(this.items.values());
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter((item) => [item.nome, item.matricula ?? "", item.cpf ?? ""].some((value) => value.toLowerCase().includes(q)));
    }

    const start = (params.page - 1) * params.pageSize;
    return {
      items: items.slice(start, start + params.pageSize),
      total: items.length,
    };
  }

  async getById(id: string) {
    return this.items.get(id) ?? null;
  }

  async create(input: CreateInteressadoInput) {
    const id = `123e4567-e89b-42d3-a456-${String(this.nextId++).padStart(12, "0")}`;
    const record: Interessado = {
      id,
      nome: input.nome,
      matricula: input.matricula ?? null,
      cpf: input.cpf ?? null,
      dataNascimento: input.dataNascimento ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.items.set(id, record);
    return record;
  }

  async update(input: UpdateInteressadoInput) {
    const current = this.items.get(input.id);
    if (!current) {
      throw new Error("not found");
    }

    const record: Interessado = {
      ...current,
      nome: input.nome,
      matricula: input.matricula ?? null,
      cpf: input.cpf ?? null,
      dataNascimento: input.dataNascimento ?? null,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(record.id, record);
    return record;
  }
}

class InMemorySetorRepository implements SetorRepository {
  private items = new Map<string, Setor>([
    [
      "123e4567-e89b-42d3-a456-000000000001",
      {
        id: "123e4567-e89b-42d3-a456-000000000001",
        sigla: "DIPES",
        nomeCompleto: "Diretoria de Pessoal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);
  private nextId = 2;

  async list() {
    return Array.from(this.items.values()).sort((left, right) => left.sigla.localeCompare(right.sigla));
  }

  async getById(id: string) {
    return this.items.get(id) ?? null;
  }

  async create(input: CreateSetorInput) {
    const id = `123e4567-e89b-42d3-a456-${String(this.nextId++).padStart(12, "0")}`;
    const record: Setor = {
      id,
      sigla: input.sigla.toUpperCase(),
      nomeCompleto: input.nomeCompleto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, record);
    return record;
  }

  async update(input: UpdateSetorInput) {
    const current = this.items.get(input.id);
    if (!current) {
      throw new Error("not found");
    }

    const record: Setor = {
      ...current,
      sigla: input.sigla.toUpperCase(),
      nomeCompleto: input.nomeCompleto,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(record.id, record);
    return record;
  }
}

class InMemorySettingsRepository implements SettingsRepository {
  private config: QueueHealthConfig = {
    attentionDays: 2,
    criticalDays: 5,
    updatedAt: null,
    updatedBy: null,
    source: "fallback",
  };

  async getQueueHealthConfig() {
    return this.config;
  }

  async updateQueueHealthConfig(input: UpdateQueueHealthConfigInput) {
    this.config = {
      attentionDays: input.attentionDays,
      criticalDays: input.criticalDays,
      updatedAt: new Date().toISOString(),
      updatedBy: {
        id: input.updatedByUserId,
        email: input.updatedByUserId === 2 ? "admin@jmu.local" : "operador@jmu.local",
        name: input.updatedByUserId === 2 ? "Admin JMU" : "Operador JMU",
        role: input.updatedByUserId === 2 ? "admin" : "operador",
      },
      source: "database",
    };

    return this.config;
  }
}

describe("Gestor JMU API", () => {
  const backupDir = mkdtempSync(join(tmpdir(), "gestor-backup-test-"));
  const eventLogPath = join(backupDir, "operations-events.jsonl");
  const config: AppConfig = {
    PORT: 3000,
    DATABASE_URL: "postgres://local/test",
    SESSION_SECRET: "test-session-secret-123",
    CLIENT_ORIGIN: "http://localhost:5173",
    APP_BASE_URL: "http://localhost:3000",
    QUEUE_ATTENTION_DAYS: 2,
    QUEUE_CRITICAL_DAYS: 5,
    OPS_BACKUP_DIR: backupDir,
    OPS_BACKUP_SCHEMA: "adminlog",
    OPS_EVENT_LOG_PATH: eventLogPath,
    NODE_ENV: "test",
    isProduction: false,
  };

  const userRepository = new InMemoryUserRepository();
  const settingsRepository = new InMemorySettingsRepository();
  const preDemandaRepository = new InMemoryPreDemandaRepository();
  const interessadoRepository = new InMemoryInteressadoRepository();
  const setorRepository = new InMemorySetorRepository();
  const migration001Checksum = createHash("sha256").update(readFileSync(join(process.cwd(), "sql", "migrations", "001_gestor_bootstrap.sql"), "utf8")).digest("hex");
  const migration002Checksum = createHash("sha256").update(readFileSync(join(process.cwd(), "sql", "migrations", "002_admin_user_audit.sql"), "utf8")).digest("hex");
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("schema_migration")) {
        return {
          rows: [
            {
              version: "002_admin_user_audit.sql",
              checksum: migration002Checksum,
              applied_at: "2026-03-09T00:00:00.000Z",
            },
            {
              version: "001_gestor_bootstrap.sql",
              checksum: migration001Checksum,
              applied_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [{ "?column?": 1 }] };
    },
    end: async () => undefined,
  } as unknown as DatabasePool;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    writeFileSync(join(backupDir, "gestor-adminlog-20260309T223439Z-test.sql.gz"), gzipSync("-- test backup --\n"));
    writeFileSync(
      eventLogPath,
      `${JSON.stringify({
        id: "evt-1",
        kind: "backup",
        status: "success",
        source: "backup-cron",
        message: "Backup concluido.",
        reference: "gestor-adminlog-20260309T223439Z-test.sql.gz",
        occurredAt: "2026-03-09T22:34:39.000Z",
      })}\n`,
    );

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
      settingsRepository,
      preDemandaRepository,
      interessadoRepository,
      setorRepository,
    });
  });

  afterAll(async () => {
    await app.close();
    rmSync(backupDir, { recursive: true, force: true });
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

    const agedRecord = (preDemandaRepository as unknown as { records: PreDemandaDetail[] }).records.find((item) => item.preId === "PRE-2026-001");

    if (agedRecord) {
      agedRecord.updatedAt = new Date(Date.now() - 6 * 86_400_000).toISOString();
      agedRecord.queueHealth = buildQueueHealth(agedRecord.status, agedRecord.updatedAt, agedRecord.dataReferencia, {
        attentionDays: 2,
        criticalDays: 5,
      });
    }

    const filtered = await app.inject({
      method: "GET",
      url: "/api/pre-demandas?status=associada",
      headers: { cookie },
    });

    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().data.total).toBe(1);

    const filteredByQueueHealth = await app.inject({
      method: "GET",
      url: "/api/pre-demandas?queueHealth=critical",
      headers: { cookie },
    });

    expect(filteredByQueueHealth.statusCode).toBe(200);
    expect(filteredByQueueHealth.json().data.total).toBeGreaterThanOrEqual(1);

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
    expect(updated.json().data.allowedNextStatuses).toContain("aberta");

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
    expect(typeof dashboardSummary.json().data.agingAttentionTotal).toBe("number");
    expect(typeof dashboardSummary.json().data.agingCriticalTotal).toBe("number");
    expect(typeof dashboardSummary.json().data.dueSoonTotal).toBe("number");
    expect(typeof dashboardSummary.json().data.overdueTotal).toBe("number");
    expect(typeof dashboardSummary.json().data.withoutSetorTotal).toBe("number");
    expect(typeof dashboardSummary.json().data.withoutInteressadosTotal).toBe("number");
    expect(Array.isArray(dashboardSummary.json().data.staleItems)).toBe(true);
    expect(Array.isArray(dashboardSummary.json().data.dueSoonItems)).toBe(true);
    expect(Array.isArray(dashboardSummary.json().data.withoutSetorItems)).toBe(true);
    expect(Array.isArray(dashboardSummary.json().data.withoutInteressadosItems)).toBe(true);

    const detail = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/PRE-2026-001",
      headers: { cookie },
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.allowedNextStatuses).toContain("aberta");
  });

  it("supports cadastros base and nested case-management routes", async () => {
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "admin@jmu.local",
        password: "Senha1234",
      },
    });

    const adminCookie = `${adminLogin.cookies[0]?.name}=${adminLogin.cookies[0]?.value}`;

    const createdInteressado = await app.inject({
      method: "POST",
      url: "/api/interessados",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Jose da Silva",
        cpf: "12345678900",
      },
    });

    expect(createdInteressado.statusCode).toBe(201);
    const interessadoId = createdInteressado.json().data.id as string;

    const listedInteressados = await app.inject({
      method: "GET",
      url: "/api/interessados?q=Jose&page=1&pageSize=10",
      headers: { cookie: adminCookie },
    });

    expect(listedInteressados.statusCode).toBe(200);
    expect(listedInteressados.json().data.total).toBeGreaterThanOrEqual(1);

    const linkedInteressado = await app.inject({
      method: "POST",
      url: "/api/pre-demandas/PRE-2026-001/interessados",
      headers: { cookie: adminCookie },
      payload: {
        interessado_id: interessadoId,
        papel: "interessado",
      },
    });

    expect(linkedInteressado.statusCode).toBe(201);
    expect(linkedInteressado.json().data[0].interessado.id).toBe(interessadoId);

    const createdSetor = await app.inject({
      method: "POST",
      url: "/api/setores",
      headers: { cookie: adminCookie },
      payload: {
        sigla: "GJMU",
        nome_completo: "Gabinete JMU",
      },
    });

    expect(createdSetor.statusCode).toBe(201);
    const setorId = createdSetor.json().data.id as string;

    const tramited = await app.inject({
      method: "POST",
      url: "/api/pre-demandas/PRE-2026-001/tramitar",
      headers: { cookie: adminCookie },
      payload: {
        setor_destino_id: setorId,
      },
    });

    expect(tramited.statusCode).toBe(200);
    expect(tramited.json().data.setorAtual.id).toBe(setorId);

    const casePatch = await app.inject({
      method: "PATCH",
      url: "/api/pre-demandas/PRE-2026-001",
      headers: { cookie: adminCookie },
      payload: {
        prazo_final: "2026-03-20",
        numero_judicial: "0001234-56.2026.9.99.9999",
        metadata: {
          frequencia: "mensal",
          pagamento_envolvido: true,
        },
      },
    });

    expect(casePatch.statusCode).toBe(200);
    expect(casePatch.json().data.prazoFinal).toBe("2026-03-20");
    expect(casePatch.json().data.metadata.pagamentoEnvolvido).toBe(true);

    const tarefa = await app.inject({
      method: "POST",
      url: "/api/pre-demandas/PRE-2026-001/tarefas",
      headers: { cookie: adminCookie },
      payload: {
        descricao: "Aguardar assinatura",
        tipo: "fixa",
      },
    });

    expect(tarefa.statusCode).toBe(201);
    const tarefaId = tarefa.json().data.id as string;

    const concluida = await app.inject({
      method: "PATCH",
      url: `/api/pre-demandas/PRE-2026-001/tarefas/${tarefaId}/concluir`,
      headers: { cookie: adminCookie },
    });

    expect(concluida.statusCode).toBe(200);
    expect(concluida.json().data.concluida).toBe(true);

    const timeline = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/PRE-2026-001/timeline",
      headers: { cookie: adminCookie },
    });

    expect(timeline.statusCode).toBe(200);
    expect(timeline.json().data.some((item: TimelineEvent) => item.type === "tramitation")).toBe(true);
    expect(timeline.json().data.some((item: TimelineEvent) => item.type === "task_completed")).toBe(true);
    expect(timeline.json().data.some((item: TimelineEvent) => item.type === "interessado_added")).toBe(true);

    const detail = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/PRE-2026-001",
      headers: { cookie: adminCookie },
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.interessados.length).toBeGreaterThanOrEqual(1);
    expect(detail.json().data.tarefasPendentes.length).toBeGreaterThanOrEqual(1);
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

    const forbiddenOps = await app.inject({
      method: "GET",
      url: "/api/admin/ops/resumo",
      headers: { cookie: operatorCookie },
    });

    expect(forbiddenOps.statusCode).toBe(403);

    const forbiddenOpsUpdate = await app.inject({
      method: "PATCH",
      url: "/api/admin/ops/queue-health-config",
      headers: { cookie: operatorCookie },
      payload: {
        attentionDays: 3,
        criticalDays: 7,
      },
    });

    expect(forbiddenOpsUpdate.statusCode).toBe(403);

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

    const ops = await app.inject({
      method: "GET",
      url: "/api/admin/ops/resumo?limit=5",
      headers: { cookie: adminCookie },
    });

    expect(ops.statusCode).toBe(200);
    expect(ops.json().data.runtime.database.status).toBe("ready");
    expect(typeof (ops.json().data as AdminOpsSummary).counters.requestsTotal).toBe("number");
    expect(Array.isArray((ops.json().data as AdminOpsSummary).incidents)).toBe(true);
    expect((ops.json().data as AdminOpsSummary).migrations?.totalFiles).toBeGreaterThanOrEqual(2);
    expect((ops.json().data as AdminOpsSummary).backupStatus.visible).toBe(true);
    expect((ops.json().data as AdminOpsSummary).backupStatus.lastBackup?.fileName).toContain("gestor-adminlog-");
    expect((ops.json().data as AdminOpsSummary).operationalEvents[0]?.kind).toBe("backup");

    const updatedQueueConfig = await app.inject({
      method: "PATCH",
      url: "/api/admin/ops/queue-health-config",
      headers: { cookie: adminCookie },
      payload: {
        attentionDays: 3,
        criticalDays: 7,
      },
    });

    expect(updatedQueueConfig.statusCode).toBe(200);
    expect(updatedQueueConfig.json().data.attentionDays).toBe(3);
    expect(updatedQueueConfig.json().data.criticalDays).toBe(7);

    const opsAfterUpdate = await app.inject({
      method: "GET",
      url: "/api/admin/ops/resumo?limit=5",
      headers: { cookie: adminCookie },
    });

    expect(opsAfterUpdate.statusCode).toBe(200);
    expect(opsAfterUpdate.json().data.queueHealthConfig.attentionDays).toBe(3);
    expect(opsAfterUpdate.json().data.queueHealthConfig.criticalDays).toBe(7);
  });
});
