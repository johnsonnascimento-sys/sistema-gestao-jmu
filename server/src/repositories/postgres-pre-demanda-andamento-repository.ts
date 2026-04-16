import type { DatabasePool } from "../db";
import { AppError } from "../errors";
import {
  type Queryable,
  getResolvedPreDemanda,
  inTransaction,
  insertAndamento,
  loadAndamentos,
  mapAndamento,
} from "./postgres-pre-demanda-utils";
import type {
  AddAndamentoInput,
  AddAndamentosLoteInput,
  PreDemandaAndamentoRepository,
  RemoveAndamentoInput,
  UpdateAndamentoInput,
} from "./types";

export class PostgresPreDemandaAndamentoRepository implements PreDemandaAndamentoRepository {
  constructor(private readonly pool: DatabasePool) {}

  async listAndamentos(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    return loadAndamentos(this.pool, demanda.id, demanda.preId);
  }

  async addAndamento(input: AddAndamentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      return insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: input.descricao,
        tipo: "manual",
        createdByUserId: input.changedByUserId,
        dataHora: input.dataHora,
      });
    });
  }

  async addAndamentosLote(input: AddAndamentosLoteInput) {
    const uniquePreIds = [...new Set(input.preIds.map((item) => item.trim()).filter(Boolean))];
    const results = await Promise.all(
      uniquePreIds.map(async (preId) => {
        try {
          const andamento = await this.addAndamento({
            preId,
            descricao: input.descricao,
            dataHora: input.dataHora,
            changedByUserId: input.changedByUserId,
          });

          return {
            preId,
            ok: true,
            message: "Andamento registrado.",
            andamento,
          };
        } catch (error) {
          return {
            preId,
            ok: false,
            message:
              error instanceof AppError
                ? error.message
                : "Falha ao registrar andamento neste processo.",
          };
        }
      }),
    );

    const successCount = results.filter((item) => item.ok).length;
    return {
      total: uniquePreIds.length,
      successCount,
      failureCount: uniquePreIds.length - successCount,
      results,
    };
  }

  async updateAndamento(input: UpdateAndamentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);

      const current = await client.query(
        `
          select id, descricao
          from adminlog.andamentos
          where id = $1::uuid and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.andamentoId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "ANDAMENTO_NOT_FOUND", "Andamento não encontrado.");
      }

      const updates: string[] = [];
      const values: unknown[] = [input.andamentoId, demanda.id];

      if (input.descricao !== undefined) {
        values.push(input.descricao);
        updates.push(`descricao = $${values.length}`);
      }

      if (input.dataHora !== undefined) {
        values.push(input.dataHora);
        updates.push(`data_hora = coalesce($${values.length}::timestamptz, now())`);
      }

      if (!updates.length) {
        throw new AppError(400, "ANDAMENTO_UPDATE_EMPTY", "Nenhum campo para atualizar.");
      }

      await client.query(
        `
          update adminlog.andamentos
          set ${updates.join(", ")}
          where id = $1::uuid and pre_demanda_id = $2
        `,
        values,
      );

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Andamento manual atualizado: de "${String(current.rows[0].descricao)}" para "${input.descricao ?? String(current.rows[0].descricao)}".`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      const updated = await client.query(
        `
          select
            andamento.id,
            $2::text as pre_id,
            andamento.data_hora,
            andamento.descricao,
            andamento.tipo,
            created_by.id as created_by_id,
            created_by.email as created_by_email,
            created_by.name as created_by_name,
            created_by.role as created_by_role
          from adminlog.andamentos andamento
          left join adminlog.app_user created_by on created_by.id = andamento.created_by_user_id
          where andamento.id = $1::uuid
          limit 1
        `,
        [input.andamentoId, input.preId],
      );

      return mapAndamento(updated.rows[0]);
    });
  }

  async removeAndamento(input: RemoveAndamentoInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);

      const current = await client.query(
        `
          select id, descricao, tipo
          from adminlog.andamentos
          where id = $1::uuid and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.andamentoId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "ANDAMENTO_NOT_FOUND", "Andamento nao encontrado.");
      }

      if (current.rows[0].tipo !== "manual") {
        throw new AppError(409, "ANDAMENTO_SYSTEM_READONLY", "Apenas andamentos manuais podem ser excluidos.");
      }

      await client.query(
        `
          delete from adminlog.andamentos
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [input.andamentoId, demanda.id],
      );

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Andamento manual removido: "${String(current.rows[0].descricao)}".`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return { removedId: input.andamentoId };
    });
  }
}
