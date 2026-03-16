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
  Assunto,
  AppUser,
  DemandaComentario,
  DemandaDocumento,
  DemandaInteressado,
  DemandaSetorFluxo,
  DemandaVinculo,
  Interessado,
  Norma,
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
  AddDemandaAssuntoInput,
  AddDemandaInteressadoInput,
  AddDemandaVinculoInput,
  AddNumeroJudicialInput,
  AssociateSeiInput,
  AssociateSeiResult,
  ConcluirTramitacaoSetorInput,
  ConcluirTarefaInput,
  CreateComentarioInput,
  CreateDocumentoInput,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  CreateInteressadoInput,
  CreateAssuntoInput,
  CreateNormaInput,
  CreateSetorInput,
  CreateTarefaInput,
  CreateUserInput,
  InteressadoRepository,
  AssuntoRepository,
  ListPreDemandasParams,
  ListPreDemandasResult,
  ListInteressadosParams,
  ListInteressadosResult,
  PreDemandaRepository,
  RemoveDocumentoInput,
  RemoveDemandaAssuntoInput,
  RemoveDemandaInteressadoInput,
  RemoveDemandaVinculoInput,
  RemoveAndamentoInput,
  RemoveNumeroJudicialInput,
  ResetUserPasswordInput,
  SetorRepository,
  NormaRepository,
  SettingsRepository,
  TramitarPreDemandaInput,
  UpdateComentarioInput,
  UpdateInteressadoInput,
  UpdateAssuntoInput,
  UpdateNormaInput,
  UpdatePreDemandaAnotacoesInput,
  UpdatePreDemandaCaseDataInput,
  UpdatePreDemandaStatusInput,
  UpdatePreDemandaStatusResult,
  UpdateAndamentoInput,
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
    frequenciaDiasSemana: metadata?.frequenciaDiasSemana ?? null,
    frequenciaDiaMes: metadata?.frequenciaDiaMes ?? null,
    pagamentoEnvolvido: metadata?.pagamentoEnvolvido ?? null,
    urgente: metadata?.urgente ?? null,
    audienciaData: metadata?.audienciaData ?? null,
    audienciaStatus: metadata?.audienciaStatus ?? null,
  };
}

function buildAssuntoStub(id: string, withSetor = false): Assunto {
  const now = new Date().toISOString();
  return {
    id,
    nome: `Assunto ${id.slice(0, 4)}`,
    descricao: null,
    createdAt: now,
    updatedAt: now,
    normas: [],
    procedimentos: [
      {
        id: `proc-${id}-1`,
        ordem: 1,
        descricao: "Passo padrao",
        setorDestino: withSetor
          ? {
              id: "123e4567-e89b-42d3-a456-000000000001",
              sigla: "DIPES",
              nomeCompleto: "Diretoria de Pessoal",
              createdAt: now,
              updatedAt: now,
            }
          : null,
        createdAt: now,
        updatedAt: now,
      },
    ],
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

  private buildDefaultPessoa(id: string, nome?: string): Interessado {
    return {
      id,
      nome: nome ?? `Pessoa ${id.slice(0, 4)}`,
      cargo: null,
      matricula: null,
      cpf: null,
      dataNascimento: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult> {
    const resolvedSolicitante = input.solicitante ?? (input.pessoaSolicitanteId ? `Pessoa ${input.pessoaSolicitanteId.slice(0, 4)}` : "");
    const existing = this.records.find(
      (item) =>
        item.solicitante.trim().toLowerCase() === resolvedSolicitante.trim().toLowerCase() &&
        item.assunto.trim().toLowerCase() === input.assunto.trim().toLowerCase() &&
        item.dataReferencia === input.dataReferencia,
    );

    if (existing) {
      return { record: existing, idempotent: true, existingPreId: existing.preId };
    }

    const hasContinuousFrequency = Boolean(
      input.metadata?.frequencia ||
        (input.metadata?.frequenciaDiasSemana && input.metadata.frequenciaDiasSemana.length) ||
        input.metadata?.frequenciaDiaMes,
    );
    if (!hasContinuousFrequency && !input.prazoFinal) {
      throw new Error("prazo required");
    }
    const initialStatus: PreDemandaStatus = "em_andamento";
    const now = new Date().toISOString();
    const preId = `PRE-2026-${String(this.nextId).padStart(3, "0")}`;
    const pessoaPrincipal = input.pessoaSolicitanteId ? this.buildDefaultPessoa(input.pessoaSolicitanteId, resolvedSolicitante) : null;
    const record: PreDemandaDetail = {
      id: this.nextId,
      preId,
      solicitante: resolvedSolicitante,
      pessoaPrincipal,
      principalNumero: input.seiNumero ?? preId,
      principalTipo: input.seiNumero ? "sei" : "demanda",
      assunto: input.assunto,
      dataReferencia: input.dataReferencia,
      status: initialStatus,
      descricao: input.descricao ?? null,
      fonte: input.fonte ?? null,
      observacoes: input.observacoes ?? null,
      prazoInicial: input.prazoInicial ?? null,
      prazoIntermediario: input.prazoIntermediario ?? null,
      prazoFinal: input.prazoFinal ?? null,
      dataConclusao: null,
      numeroJudicial: input.numeroJudicial ?? null,
      anotacoes: null,
      metadata: defaultMetadata(input.metadata),
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      currentAssociation: input.seiNumero
        ? {
            preId,
            seiNumero: input.seiNumero,
            principal: true,
            linkedAt: now,
            updatedAt: now,
            observacoes: "Processo registado ja com numeracao de origem.",
            linkedBy: null,
          }
        : null,
      seiAssociations: input.seiNumero
        ? [
            {
              preId,
              seiNumero: input.seiNumero,
              principal: true,
              linkedAt: now,
              updatedAt: now,
              observacoes: "Processo registado ja com numeracao de origem.",
              linkedBy: null,
            },
          ]
        : [],
      assuntos: (input.assuntoIds ?? []).map((assuntoId) => ({
        assunto: buildAssuntoStub(assuntoId),
        linkedAt: now,
        linkedBy: null,
      })),
      numerosJudiciais: input.numeroJudicial ? [{ numero: input.numeroJudicial, principal: true, createdAt: now }] : [],
      queueHealth: buildQueueHealth(initialStatus, now, input.dataReferencia, this.queueHealthThresholds),
      allowedNextStatuses: getAllowedNextStatuses({ currentStatus: initialStatus, hasAssociation: Boolean(input.seiNumero) }),
      interessados: pessoaPrincipal
        ? [
            {
              interessado: pessoaPrincipal,
              papel: "solicitante",
              linkedAt: now,
              linkedBy: null,
            },
          ]
        : [],
      vinculos: [],
      setorAtual: {
        id: "setad2a2cjm",
        sigla: "SETAD2A2CJM",
        nomeCompleto: "Setor Administrativo 2A2 CJM",
        createdAt: now,
        updatedAt: now,
      },
      setoresAtivos: [
        {
          id: `fluxo-${this.nextId}`,
          status: "ativo",
          observacoes: "Setor inicial da demanda.",
          createdAt: now,
          createdBy: null,
          concluidaEm: null,
          concluidaPor: null,
          setor: {
            id: "setad2a2cjm",
            sigla: "SETAD2A2CJM",
            nomeCompleto: "Setor Administrativo 2A2 CJM",
            createdAt: now,
            updatedAt: now,
          },
          origemSetor: null,
        },
      ],
      documentos: [],
      comentarios: [],
      tarefasPendentes: (input.assuntoIds ?? []).map((assuntoId, index) => ({
        id: `123e4567-e89b-42d3-a456-${String(index + 1).padStart(12, "0")}`,
        preId,
        ordem: index + 1,
        descricao: `[${buildAssuntoStub(assuntoId).nome}] 1. Passo padrao`,
        tipo: "fixa",
        assuntoId,
        procedimentoId: `proc-${assuntoId}-1`,
        prazoReferencia: null,
        prazoData: null,
        setorDestino: null,
        geradaAutomaticamente: true,
        concluida: false,
        concluidaEm: null,
        concluidaPor: null,
        createdAt: now,
        createdBy: null,
      })),
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
      items = items.filter((item) => [item.preId, item.principalNumero, item.solicitante, item.assunto].some((value) => value.toLowerCase().includes(q)));
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

    if (params.setorAtualId) {
      items = items.filter((item) => item.setorAtual?.id === params.setorAtualId);
    }

    if (params.withoutSetor === true) {
      items = items.filter((item) => item.setorAtual === null);
    }

    if (params.withoutSetor === false) {
      items = items.filter((item) => item.setorAtual !== null);
    }

    if (params.dueState === "overdue") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      items = items.filter((item) => item.prazoFinal && new Date(`${item.prazoFinal}T00:00:00`).getTime() < today.getTime());
    }

    if (params.dueState === "due_today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      items = items.filter((item) => item.prazoFinal && new Date(`${item.prazoFinal}T00:00:00`).getTime() === today.getTime());
    }

    if (params.dueState === "due_soon") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      items = items.filter((item) => {
        if (!item.prazoFinal) {
          return false;
        }

        const diffDays = Math.round((new Date(`${item.prazoFinal}T00:00:00`).getTime() - today.getTime()) / 86400000);
        return diffDays >= 0 && diffDays <= 7;
      });
    }

    if (params.dueState === "none") {
      items = items.filter((item) => item.prazoFinal === null);
    }

    if (params.prazoCampo && params.prazoRecorte) {
      const getPrazo = (item: PreDemandaDetail) =>
        params.prazoCampo === "prazoInicial" ? item.prazoInicial : params.prazoCampo === "prazoIntermediario" ? item.prazoIntermediario : item.prazoFinal;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      items = items.filter((item) => {
        const prazo = getPrazo(item);
        if (!prazo) {
          return false;
        }

        const value = new Date(`${prazo}T00:00:00`).getTime();
        if (params.prazoRecorte === "overdue") return value < today.getTime();
        if (params.prazoRecorte === "today") return value === today.getTime();
        return value >= today.getTime() && value <= today.getTime() + 7 * 86400000;
      });
    }

    if (params.paymentInvolved === true) {
      items = items.filter((item) => item.metadata.pagamentoEnvolvido === true);
    }

    if (params.paymentInvolved === false) {
      items = items.filter((item) => item.metadata.pagamentoEnvolvido !== true);
    }

    if (params.hasInteressados === true) {
      items = items.filter((item) => item.interessados.length > 0);
    }

    if (params.hasInteressados === false) {
      items = items.filter((item) => item.interessados.length === 0);
    }

    if (params.closedWithinDays) {
      const threshold = Date.now() - params.closedWithinDays * 86400000;
      const preIds = new Set(
        this.statusAudit
          .filter((item) => item.statusNovo === "encerrada" && new Date(item.registradoEm).getTime() >= threshold)
          .map((item) => item.preId),
      );
      items = items.filter((item) => preIds.has(item.preId));
    }

    if (params.reopenedWithinDays) {
      const threshold = Date.now() - params.reopenedWithinDays * 86400000;
      const preIds = new Set(
        this.statusAudit
          .filter((item) => item.statusAnterior === "encerrada" && item.statusNovo !== "encerrada" && new Date(item.registradoEm).getTime() >= threshold)
          .map((item) => item.preId),
      );
      items = items.filter((item) => preIds.has(item.preId));
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
      ["em_andamento", 0],
      ["aguardando_sei", 0],
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
    if (input.prazoInicial !== undefined) record.prazoInicial = input.prazoInicial;
    if (input.prazoIntermediario !== undefined) record.prazoIntermediario = input.prazoIntermediario;
    if (input.prazoFinal !== undefined) record.prazoFinal = input.prazoFinal;
    if (input.numeroJudicial !== undefined) record.numeroJudicial = input.numeroJudicial;
    if (input.numeroJudicial) {
      record.numerosJudiciais = [
        { numero: input.numeroJudicial, principal: true, createdAt: new Date().toISOString() },
        ...record.numerosJudiciais.filter((item) => item.numero !== input.numeroJudicial).map((item) => ({ ...item, principal: false })),
      ];
    }
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

  async addAssunto(input: AddDemandaAssuntoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }
    if (record.assuntos.some((item) => item.assunto.id === input.assuntoId)) {
      throw new Error("duplicate");
    }
    const assunto = buildAssuntoStub(input.assuntoId, true);
    const procedimento = assunto.procedimentos[0]!;
    record.assuntos.unshift({
      assunto,
      linkedAt: new Date().toISOString(),
      linkedBy: null,
    });
    record.tarefasPendentes.push({
      id: `123e4567-e89b-42d3-a456-${String(record.tarefasPendentes.length + 1).padStart(12, "0")}`,
      preId: record.preId,
      ordem: record.tarefasPendentes.length + 1,
      descricao: `[${assunto.nome}] 1. ${procedimento.descricao}`,
      tipo: "fixa",
      assuntoId: assunto.id,
      procedimentoId: procedimento.id,
      prazoReferencia: null,
      prazoData: null,
      setorDestino: procedimento.setorDestino,
      geradaAutomaticamente: true,
      concluida: false,
      concluidaEm: null,
      concluidaPor: null,
      createdAt: new Date().toISOString(),
      createdBy: null,
    });
    this.addAndamentoRecord(record, `Assunto vinculado ao processo: ${assunto.nome}.`, "sistema");
    return this.touch(record);
  }

  async removeAssunto(input: RemoveDemandaAssuntoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }
    const current = record.assuntos.find((item) => item.assunto.id === input.assuntoId);
    if (!current) {
      throw new Error("not found");
    }
    record.assuntos = record.assuntos.filter((item) => item.assunto.id !== input.assuntoId);
    record.tarefasPendentes = record.tarefasPendentes.filter((item) => item.assuntoId !== input.assuntoId || item.concluida);
    this.addAndamentoRecord(record, `Assunto removido do processo: ${current.assunto.nome}.`, "sistema");
    return this.touch(record);
  }

  async addNumeroJudicial(input: AddNumeroJudicialInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }
    const now = new Date().toISOString();
    record.numerosJudiciais = [
      { numero: input.numeroJudicial, principal: true, createdAt: now },
      ...record.numerosJudiciais.filter((item) => item.numero !== input.numeroJudicial).map((item) => ({ ...item, principal: false })),
    ];
    record.numeroJudicial = input.numeroJudicial;
    this.touch(record);
    return record.numerosJudiciais;
  }

  async removeNumeroJudicial(input: RemoveNumeroJudicialInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }
    record.numerosJudiciais = record.numerosJudiciais.filter((item) => item.numero !== input.numeroJudicial);
    if (record.numerosJudiciais[0]) {
      record.numerosJudiciais[0].principal = true;
      record.numeroJudicial = record.numerosJudiciais[0].numero;
    } else {
      record.numeroJudicial = null;
    }
    this.touch(record);
    return record.numerosJudiciais;
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
      cargo: null,
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
    if (input.papel === "solicitante") {
      record.pessoaPrincipal = interessado;
      record.solicitante = interessado.nome;
    }
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
          principalNumero: destino.principalNumero,
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

    const setores = input.setorDestinoIds.map<DemandaSetorFluxo>((setorId, index) => ({
      id: `fluxo-${record.id}-${index + 1}-${Date.now()}`,
      status: "ativo",
      observacoes: input.observacoes ?? null,
      createdAt: new Date().toISOString(),
      createdBy: null,
      concluidaEm: null,
      concluidaPor: null,
      setor: {
        id: setorId,
        sigla: setorId === "123e4567-e89b-42d3-a456-000000000002" ? "GJMU" : `SET-${index + 1}`,
        nomeCompleto: setorId === "123e4567-e89b-42d3-a456-000000000002" ? "Gabinete JMU" : `Setor ${index + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      origemSetor: record.setorAtual,
    }));
    record.setoresAtivos = [
      ...setores.filter((item) => !record.setoresAtivos.some((current) => current.setor.id === item.setor.id)),
      ...record.setoresAtivos,
    ];
    record.setorAtual = record.setoresAtivos[0]?.setor ?? null;
    this.addAndamentoRecord(record, `Processo remetido para ${record.setoresAtivos.map((item) => item.setor.sigla).join(", ")}.`, "tramitacao");
    return this.touch(record);
  }

  async concluirTramitacaoSetor(input: ConcluirTramitacaoSetorInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    record.setoresAtivos = record.setoresAtivos.filter((item) => item.setor.id !== input.setorId);
    record.setorAtual = record.setoresAtivos[0]?.setor ?? null;
    this.addAndamentoRecord(record, `Tramitacao concluida no setor ${input.setorId}.`, "tramitacao");
    return this.touch(record);
  }

  async addAndamento(input: AddAndamentoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    return this.addAndamentoRecord(record, input.descricao, "manual", input.dataHora ?? new Date().toISOString());
  }

  async updateAndamento(input: UpdateAndamentoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    const andamento = this.andamentos.find((item) => item.id === input.andamentoId && item.preId === input.preId);
    if (!record || !andamento) {
      throw new Error("not found");
    }

    if (andamento.tipo !== "manual") {
      throw new Error("not editable");
    }

    const previousDescription = andamento.descricao;
    andamento.descricao = input.descricao;
    andamento.dataHora = input.dataHora ?? andamento.dataHora;
    this.addAndamentoRecord(record, `Andamento manual atualizado. Antes: ${previousDescription}.`, "sistema");
    this.touch(record);
    return andamento;
  }

  async removeAndamento(input: RemoveAndamentoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    const andamento = this.andamentos.find((item) => item.id === input.andamentoId && item.preId === input.preId);
    if (!record || !andamento) {
      throw new Error("not found");
    }

    if (andamento.tipo !== "manual") {
      throw new Error("not deletable");
    }

    this.andamentos = this.andamentos.filter((item) => item.id !== input.andamentoId);
    record.recentAndamentos = this.andamentos.filter((item) => item.preId === record.preId).slice(0, 20);
    this.addAndamentoRecord(record, `Andamento manual removido. Conteudo anterior: ${andamento.descricao}.`, "sistema");
    this.touch(record);
    return { removedId: input.andamentoId };
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
      ordem: record.tarefasPendentes.length + 1,
      descricao: input.descricao,
      tipo: input.tipo,
      assuntoId: input.assuntoId ?? null,
      procedimentoId: input.procedimentoId ?? null,
      prazoReferencia: input.prazoReferencia ?? null,
      prazoData:
        input.prazoReferencia === "prazoInicial"
          ? record.prazoInicial
          : input.prazoReferencia === "prazoIntermediario"
            ? record.prazoIntermediario
            : input.prazoReferencia === "prazoFinal"
              ? record.prazoFinal
              : null,
      setorDestino: input.setorDestinoId
        ? {
            id: input.setorDestinoId,
            sigla: "DIPES",
            nomeCompleto: "Diretoria de Pessoal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : null,
      geradaAutomaticamente: input.geradaAutomaticamente ?? false,
      concluida: false,
      concluidaEm: null,
      concluidaPor: null,
      createdAt: new Date().toISOString(),
      createdBy: null,
    };

    record.tarefasPendentes.push(tarefa);
    return tarefa;
  }

  async updateTarefa(input: { preId: string; tarefaId: string; descricao: string; tipo: "fixa" | "livre"; prazoReferencia?: "prazoInicial" | "prazoIntermediario" | "prazoFinal" | null }) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    const tarefa = record.tarefasPendentes.find((item) => item.id === input.tarefaId);
    if (!tarefa) {
      throw new Error("not found");
    }

    if (tarefa.concluida) {
      throw new Error("not editable");
    }

    tarefa.descricao = input.descricao;
    tarefa.tipo = input.tipo;
    tarefa.prazoReferencia = input.prazoReferencia ?? null;
    tarefa.prazoData =
      input.prazoReferencia === "prazoInicial"
        ? record.prazoInicial
        : input.prazoReferencia === "prazoIntermediario"
          ? record.prazoIntermediario
          : input.prazoReferencia === "prazoFinal"
            ? record.prazoFinal
            : null;
    this.addAndamentoRecord(record, `Tarefa atualizada: ${tarefa.descricao}.`, "sistema");
    return tarefa;
  }

  async reorderTarefas(input: { preId: string; tarefaIds: string[] }) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    const pending = record.tarefasPendentes.filter((item) => !item.concluida);
    const completed = record.tarefasPendentes.filter((item) => item.concluida);
    const reorderedPending = input.tarefaIds.map((id, index) => {
      const tarefa = pending.find((item) => item.id === id);
      if (!tarefa) {
        throw new Error("invalid order");
      }
      tarefa.ordem = index + 1;
      return tarefa;
    });

    record.tarefasPendentes = [...reorderedPending, ...completed];
    this.addAndamentoRecord(record, "Checklist reorganizada manualmente.", "sistema");
    return record.tarefasPendentes;
  }

  async removeTarefa(input: { preId: string; tarefaId: string }) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    const tarefa = record.tarefasPendentes.find((item) => item.id === input.tarefaId);
    if (!tarefa) {
      throw new Error("not found");
    }

    if (tarefa.concluida) {
      throw new Error("not deletable");
    }

    record.tarefasPendentes = record.tarefasPendentes.filter((item) => item.id !== input.tarefaId);
    this.addAndamentoRecord(record, `Tarefa removida: ${tarefa.descricao}.`, "sistema");
    return { removedId: input.tarefaId };
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
    if (tarefa.setorDestino) {
      record.setorAtual = tarefa.setorDestino;
      if (!record.setoresAtivos.some((item) => item.setor.id === tarefa.setorDestino!.id)) {
        record.setoresAtivos.unshift({
          id: `fluxo-${record.id}-${Date.now()}`,
          status: "ativo",
          observacoes: "Tramitacao gerada automaticamente por conclusao de procedimento.",
          createdAt: new Date().toISOString(),
          createdBy: null,
          concluidaEm: null,
          concluidaPor: null,
          setor: tarefa.setorDestino,
          origemSetor: record.setorAtual,
        });
      }
      this.addAndamentoRecord(record, `Processo remetido para ${tarefa.setorDestino.sigla}.`, "tramitacao");
    }
    this.addAndamentoRecord(record, `Tarefa concluida: ${tarefa.descricao}.`, "tarefa_concluida");
    return tarefa;
  }

  async listComentarios(preId: string) {
    return this.records.find((item) => item.preId === preId)?.comentarios ?? [];
  }

  async createComentario(input: CreateComentarioInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }

    const comentario: DemandaComentario = {
      id: `coment-${record.id}-${record.comentarios.length + 1}`,
      preId: record.preId,
      conteudo: input.conteudo,
      formato: input.formato,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: null,
      editedBy: null,
    };
    record.comentarios.unshift(comentario);
    return comentario;
  }

  async updateComentario(input: UpdateComentarioInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    const comentario = record?.comentarios.find((item) => item.id === input.comentarioId);
    if (!comentario) {
      throw new Error("not found");
    }
    comentario.conteudo = input.conteudo;
    comentario.updatedAt = new Date().toISOString();
    return comentario;
  }

  async listDocumentos(preId: string) {
    return this.records.find((item) => item.preId === preId)?.documentos ?? [];
  }

  async createDocumento(input: CreateDocumentoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }
    const documento: DemandaDocumento = {
      id: `doc-${record.id}-${record.documentos.length + 1}`,
      preId: record.preId,
      nomeArquivo: input.nomeArquivo,
      mimeType: input.mimeType,
      tamanhoBytes: input.tamanhoBytes,
      descricao: input.descricao ?? null,
      createdAt: new Date().toISOString(),
      createdBy: null,
    };
    record.documentos.unshift(documento);
    this.addAndamentoRecord(record, `Documento anexado: ${documento.nomeArquivo}.`, "sistema");
    return documento;
  }

  async removeDocumento(input: RemoveDocumentoInput) {
    const record = this.records.find((item) => item.preId === input.preId);
    if (!record) {
      throw new Error("not found");
    }
    const removed = record.documentos.find((item) => item.id === input.documentoId);
    record.documentos = record.documentos.filter((item) => item.id !== input.documentoId);
    if (removed) {
      this.addAndamentoRecord(record, `Documento removido: ${removed.nomeArquivo}.`, "sistema");
    }
    return record.documentos;
  }

  async downloadDocumento(preId: string, documentoId: string) {
    const record = this.records.find((item) => item.preId === preId);
    const documento = record?.documentos.find((item) => item.id === documentoId);
    if (!documento) {
      throw new Error("not found");
    }
    return {
      documento,
      conteudo: Buffer.from("conteudo"),
    };
  }

  async listSetoresAtivos(preId: string) {
    return this.records.find((item) => item.preId === preId)?.setoresAtivos ?? [];
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
      principal: true,
      linkedAt: current?.linkedAt ?? now,
      updatedAt: now,
      observacoes: input.observacoes ?? null,
      linkedBy: null,
    };

    record.currentAssociation = association;
    record.seiAssociations = [
      association,
      ...record.seiAssociations.filter((item) => item.seiNumero !== input.seiNumero).map((item) => ({ ...item, principal: false })),
    ];
    record.principalNumero = input.seiNumero;
    record.principalTipo = "sei";
    if (record.status !== "em_andamento") {
      this.statusAudit.unshift({
        id: this.nextAuditId++,
        preId: input.preId,
        statusAnterior: record.status,
        statusNovo: "em_andamento",
        motivo: input.motivo ?? "Associacao de numero SEI.",
        observacoes: input.observacoes ?? null,
        registradoEm: now,
        changedBy: null,
      });
    }
    record.status = "em_andamento";
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
      principalNumero: record.principalNumero,
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
        principalNumero: record.principalNumero,
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
        principalNumero: record.principalNumero,
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
        principalNumero: record.principalNumero,
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
      deadlines: {
        prazoInicial: {
          overdueTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoInicial && new Date(`${item.prazoInicial}T00:00:00`).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
          dueTodayTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoInicial && new Date(`${item.prazoInicial}T00:00:00`).getTime() === new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
          dueSoonTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoInicial).filter((item) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const value = new Date(`${item.prazoInicial}T00:00:00`).getTime();
            return value >= today.getTime() && value <= today.getTime() + 7 * 86400000;
          }).length,
          totalDefined: this.records.filter((item) => item.status !== "encerrada" && item.prazoInicial).length,
        },
        prazoIntermediario: {
          overdueTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoIntermediario && new Date(`${item.prazoIntermediario}T00:00:00`).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
          dueTodayTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoIntermediario && new Date(`${item.prazoIntermediario}T00:00:00`).getTime() === new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
          dueSoonTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoIntermediario).filter((item) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const value = new Date(`${item.prazoIntermediario}T00:00:00`).getTime();
            return value >= today.getTime() && value <= today.getTime() + 7 * 86400000;
          }).length,
          totalDefined: this.records.filter((item) => item.status !== "encerrada" && item.prazoIntermediario).length,
        },
        prazoFinal: {
          overdueTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal && new Date(`${item.prazoFinal}T00:00:00`).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
          dueTodayTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal && new Date(`${item.prazoFinal}T00:00:00`).getTime() === new Date(new Date().setHours(0, 0, 0, 0)).getTime()).length,
          dueSoonTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal).filter((item) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const value = new Date(`${item.prazoFinal}T00:00:00`).getTime();
            return value >= today.getTime() && value <= today.getTime() + 7 * 86400000;
          }).length,
          totalDefined: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal).length,
        },
      },
      reopenedLast30Days: this.statusAudit.filter((item) => item.statusAnterior === "encerrada" && item.statusNovo !== "encerrada").length,
      closedLast30Days: this.statusAudit.filter((item) => item.statusNovo === "encerrada").length,
      agingAttentionTotal: this.records.filter((item) => item.queueHealth.level === "attention").length,
      agingCriticalTotal: this.records.filter((item) => item.queueHealth.level === "critical").length,
      dueTodayTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal === new Date().toISOString().slice(0, 10)).length,
      dueSoonTotal: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal !== null).length,
      overdueTotal: 0,
      paymentMarkedTotal: this.records.filter((item) => item.status !== "encerrada" && item.metadata.pagamentoEnvolvido === true).length,
      urgentTotal: this.records.filter((item) => item.status !== "encerrada" && item.metadata.urgente === true).length,
      withoutSetorTotal: this.records.filter((item) => item.status !== "encerrada" && item.setorAtual === null).length,
      withoutInteressadosTotal: this.records.filter((item) => item.status !== "encerrada" && item.interessados.length === 0).length,
      staleItems,
      awaitingSeiItems,
      dueSoonItems: this.records.filter((item) => item.status !== "encerrada" && item.prazoFinal !== null).slice(0, 5),
      paymentMarkedItems: this.records.filter((item) => item.status !== "encerrada" && item.metadata.pagamentoEnvolvido === true).slice(0, 5),
      urgentItems: this.records.filter((item) => item.status !== "encerrada" && item.metadata.urgente === true).slice(0, 5),
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
      items = items.filter((item) => [item.nome, item.cargo ?? "", item.matricula ?? "", item.cpf ?? ""].some((value) => value.toLowerCase().includes(q)));
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
      cargo: input.cargo ?? null,
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
      cargo: input.cargo ?? null,
      matricula: input.matricula ?? null,
      cpf: input.cpf ?? null,
      dataNascimento: input.dataNascimento ?? null,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(record.id, record);
    return record;
  }
}

class InMemoryNormaRepository implements NormaRepository {
  private items = new Map<string, Norma>();
  private nextId = 1;

  async list() {
    return Array.from(this.items.values()).sort((left, right) => right.dataNorma.localeCompare(left.dataNorma) || left.numero.localeCompare(right.numero));
  }

  async getById(id: string) {
    return this.items.get(id) ?? null;
  }

  async create(input: CreateNormaInput) {
    const id = `323e4567-e89b-42d3-a456-${String(this.nextId++).padStart(12, "0")}`;
    const now = new Date().toISOString();
    const record: Norma = {
      id,
      numero: input.numero,
      dataNorma: input.dataNorma,
      origem: input.origem,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(id, record);
    return record;
  }

  async update(input: UpdateNormaInput) {
    const current = this.items.get(input.id);
    if (!current) {
      throw new Error("not found");
    }
    const next: Norma = {
      ...current,
      numero: input.numero,
      dataNorma: input.dataNorma,
      origem: input.origem,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(input.id, next);
    return next;
  }
}

class InMemoryAssuntoRepository implements AssuntoRepository {
  private items = new Map<string, Assunto>();
  private nextId = 1;

  async list() {
    return Array.from(this.items.values()).sort((left, right) => left.nome.localeCompare(right.nome));
  }

  async getById(id: string) {
    return this.items.get(id) ?? null;
  }

  async create(input: CreateAssuntoInput) {
    const id = `123e4567-e89b-42d3-a456-${String(this.nextId++).padStart(12, "0")}`;
    const now = new Date().toISOString();
    const record: Assunto = {
      id,
      nome: input.nome,
      descricao: input.descricao ?? null,
      createdAt: now,
      updatedAt: now,
      normas: (input.normaIds ?? []).map((normaId, index) => ({
        id: normaId,
        numero: `NORMA-${index + 1}`,
        dataNorma: "2026-03-11",
        origem: "Teste",
        createdAt: now,
        updatedAt: now,
      })),
      procedimentos: (input.procedimentos ?? []).map((item, index) => ({
        id: `proc-${this.nextId}-${index + 1}`,
        ordem: item.ordem ?? index + 1,
        descricao: item.descricao,
        setorDestino: item.setorDestinoId
          ? {
              id: item.setorDestinoId,
              sigla: "DIPES",
              nomeCompleto: "Diretoria de Pessoal",
              createdAt: now,
              updatedAt: now,
            }
          : null,
        createdAt: now,
        updatedAt: now,
      })),
    };
    this.items.set(id, record);
    return record;
  }

  async update(input: UpdateAssuntoInput) {
    const current = this.items.get(input.id);
    if (!current) {
      throw new Error("not found");
    }
    const now = new Date().toISOString();
    const next: Assunto = {
      ...current,
      nome: input.nome,
      descricao: input.descricao ?? null,
      updatedAt: now,
      normas: (input.normaIds ?? []).map((normaId, index) => ({
        id: normaId,
        numero: `NORMA-${index + 1}`,
        dataNorma: "2026-03-11",
        origem: "Teste",
        createdAt: now,
        updatedAt: now,
      })),
      procedimentos: (input.procedimentos ?? []).map((item, index) => ({
        id: `proc-${input.id}-${index + 1}`,
        ordem: item.ordem ?? index + 1,
        descricao: item.descricao,
        setorDestino: item.setorDestinoId
          ? {
              id: item.setorDestinoId,
              sigla: "DIPES",
              nomeCompleto: "Diretoria de Pessoal",
              createdAt: now,
              updatedAt: now,
            }
          : null,
        createdAt: now,
        updatedAt: now,
      })),
    };
    this.items.set(input.id, next);
    return next;
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
  const normaRepository = new InMemoryNormaRepository();
  const assuntoRepository = new InMemoryAssuntoRepository();
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
      assuntoRepository,
      setorRepository,
      normaRepository,
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
        prazo_final: "2026-03-20",
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
        prazo_final: "2026-03-20",
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
      url: "/api/pre-demandas?status=em_andamento",
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
    expect(updated.json().data.allowedNextStatuses).toContain("em_andamento");

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
    expect(detail.json().data.allowedNextStatuses).toContain("em_andamento");
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

    const withoutSetor = await app.inject({
      method: "GET",
      url: "/api/pre-demandas?withoutSetor=true",
      headers: { cookie: adminCookie },
    });

    expect(withoutSetor.statusCode).toBe(200);
    expect(withoutSetor.json().data.total).toBe(0);

    const withSetor = await app.inject({
      method: "GET",
      url: "/api/pre-demandas?withoutSetor=false",
      headers: { cookie: adminCookie },
    });

    expect(withSetor.statusCode).toBe(200);
    expect(withSetor.json().data.total).toBeGreaterThanOrEqual(1);

    const detail = await app.inject({
      method: "GET",
      url: "/api/pre-demandas/PRE-2026-001",
      headers: { cookie: adminCookie },
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.interessados.length).toBeGreaterThanOrEqual(1);
    expect(detail.json().data.tarefasPendentes.length).toBeGreaterThanOrEqual(1);
  });

  it("supports normas base repository CRUD", async () => {
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "admin@jmu.local",
        password: "Senha1234",
      },
    });

    const adminCookie = `${adminLogin.cookies[0]?.name}=${adminLogin.cookies[0]?.value}`;

    const createdNorma = await app.inject({
      method: "POST",
      url: "/api/normas",
      headers: { cookie: adminCookie },
      payload: {
        numero: "IN-12/2026",
        data_norma: "2026-03-11",
        origem: "STM",
      },
    });

    expect(createdNorma.statusCode).toBe(201);
    const normaId = createdNorma.json().data.id as string;

    const listedNormas = await app.inject({
      method: "GET",
      url: "/api/normas",
      headers: { cookie: adminCookie },
    });

    expect(listedNormas.statusCode).toBe(200);
    expect(listedNormas.json().data.length).toBeGreaterThanOrEqual(1);

    const updatedNorma = await app.inject({
      method: "PATCH",
      url: `/api/normas/${normaId}`,
      headers: { cookie: adminCookie },
      payload: {
        numero: "IN-12/2026-RET",
        data_norma: "2026-03-11",
        origem: "STM/SG",
      },
    });

    expect(updatedNorma.statusCode).toBe(200);
    expect(updatedNorma.json().data.numero).toBe("IN-12/2026-RET");
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
      url: "/api/admin/ops/resumo?limit=5&days=30",
      headers: { cookie: adminCookie },
    });

    expect(ops.statusCode).toBe(200);
    expect(ops.json().data.runtime.database.status).toBe("ready");
    expect(typeof (ops.json().data as AdminOpsSummary).counters.requestsTotal).toBe("number");
    expect(Array.isArray((ops.json().data as AdminOpsSummary).incidents)).toBe(true);
    expect(typeof (ops.json().data as AdminOpsSummary).incidentSummary.total).toBe("number");
    expect(Array.isArray((ops.json().data as AdminOpsSummary).incidentSummary.byKind)).toBe(true);
    expect(Array.isArray((ops.json().data as AdminOpsSummary).incidentSummary.topPaths)).toBe(true);
    expect(Array.isArray((ops.json().data as AdminOpsSummary).incidentSummary.clusters)).toBe(true);
    expect((ops.json().data as AdminOpsSummary).migrations?.totalFiles).toBeGreaterThanOrEqual(2);
    expect((ops.json().data as AdminOpsSummary).backupStatus.visible).toBe(true);
    expect((ops.json().data as AdminOpsSummary).backupStatus.lastBackup?.fileName).toContain("gestor-adminlog-");
    expect((ops.json().data as AdminOpsSummary).operationalEvents[0]?.kind).toBe("backup");
    expect(typeof (ops.json().data as AdminOpsSummary).operationalSummary.backupFreshness).toBe("string");
    expect((ops.json().data as AdminOpsSummary).operationalSummary.lastSuccessfulBackupAt).not.toBeUndefined();
    expect((ops.json().data as AdminOpsSummary).operationalSummary.lastSuccessfulDeployAt).not.toBeUndefined();
    expect(typeof (ops.json().data as AdminOpsSummary).operationalSummary.failureCount24h).toBe("number");
    expect(Array.isArray((ops.json().data as AdminOpsSummary).operationalSummary.failuresByKind24h)).toBe(true);
    expect(Array.isArray((ops.json().data as AdminOpsSummary).operationalSummary.failureClusters24h)).toBe(true);
    expect((ops.json().data as AdminOpsSummary).caseManagementReport.periodDays).toBe(30);
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.createdInPeriod).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.closedInPeriod).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.previousPeriod.createdInPeriod).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.deltas.createdInPeriod).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.previousPeriod.overdueTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.previousPeriod.dueSoonTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.previousPeriod.withoutSetorTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.previousPeriod.withoutInteressadosTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.deltas.overdueTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.deltas.dueSoonTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.deltas.withoutSetorTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.deltas.withoutInteressadosTotal).toBe("number");
    expect(Array.isArray((ops.json().data as AdminOpsSummary).caseManagementReport.bySetor)).toBe(true);
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.bySetor[0]?.previousActiveTotal).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.bySetor[0]?.activeDelta).toBe("number");
    expect(typeof (ops.json().data as AdminOpsSummary).caseManagementReport.bySetor[0]?.riskScore).toBe("number");
    expect(Array.isArray((ops.json().data as AdminOpsSummary).caseManagementReport.prioritySetores)).toBe(true);

    const caseReportCsv = await app.inject({
      method: "GET",
      url: "/api/admin/ops/case-report.csv?days=30",
      headers: { cookie: adminCookie },
    });

    expect(caseReportCsv.statusCode).toBe(200);
    expect(caseReportCsv.headers["content-type"]).toContain("text/csv");
    expect(caseReportCsv.headers["content-disposition"]).toContain("gestor-case-report-30d.csv");
    expect(caseReportCsv.body).toContain("secao;campo;valor");
    expect(caseReportCsv.body).toContain("resumo;periodo_dias;30");
    expect(caseReportCsv.body).toContain("resumo;casos_criados_janela_anterior;");
    expect(caseReportCsv.body).toContain("resumo;casos_criados_delta;");
    expect(caseReportCsv.body).toContain("resumo;vencidos_janela_anterior;");
    expect(caseReportCsv.body).toContain("resumo;sem_setor_delta;");
    expect(caseReportCsv.body).toContain("setores;sigla;nome;risco;score_risco;ativos;ativos_janela_anterior;ativos_delta;vencidos;vencem_em_7_dias;aguardando_sei");

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
      url: "/api/admin/ops/resumo?limit=5&days=7",
      headers: { cookie: adminCookie },
    });

    expect(opsAfterUpdate.statusCode).toBe(200);
    expect(opsAfterUpdate.json().data.queueHealthConfig.attentionDays).toBe(3);
    expect(opsAfterUpdate.json().data.queueHealthConfig.criticalDays).toBe(7);
    expect(opsAfterUpdate.json().data.caseManagementReport.periodDays).toBe(7);
  });
});
