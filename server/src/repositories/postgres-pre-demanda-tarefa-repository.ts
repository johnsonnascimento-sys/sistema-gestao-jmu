import type { DatabasePool } from "../db";
import { AppError } from "../errors";
import {
  type Queryable,
  getResolvedPreDemanda,
  inTransaction,
  insertAndamento,
  loadTarefas,
  activateSetorFromTarefa,
} from "./postgres-pre-demanda-utils";
import type {
  ConcluirTarefaInput,
  CreateTarefaInput,
  PreDemandaTarefaRepository,
  RemoveTarefaInput,
  ReorderTarefasInput,
  UpdateTarefaInput,
} from "./types";
import type { TaskScheduleSuggestion, TarefaRecorrenciaTipo } from "../domain/types";

const TASK_SUGGESTION_SLOTS = [
  { inicio: "09:00", fim: "10:00" },
  { inicio: "11:00", fim: "12:00" },
  { inicio: "14:00", fim: "15:00" },
  { inicio: "16:00", fim: "17:00" },
] as const;

const RECORRENCIA_MESES: Record<Exclude<TarefaRecorrenciaTipo, "diaria" | "semanal">, number> = {
  mensal: 1,
  trimestral: 3,
  quadrimestral: 4,
  semestral: 6,
  anual: 12,
};

export class PostgresPreDemandaTarefaRepository implements PreDemandaTarefaRepository {
  constructor(private readonly pool: DatabasePool) {}

  private formatLocalDate(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private addDays(value: string, amount: number) {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + amount);
    return this.formatLocalDate(date);
  }

  private addMonthsKeepingDay(value: string, amount: number, desiredDay?: number | null) {
    const current = new Date(`${value}T00:00:00`);
    const day = desiredDay ?? current.getUTCDate();
    const nextMonthDate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1));
    const lastDay = new Date(Date.UTC(nextMonthDate.getUTCFullYear(), nextMonthDate.getUTCMonth() + 1, 0)).getUTCDate();
    nextMonthDate.setUTCDate(Math.min(day, lastDay));
    return nextMonthDate.toISOString().slice(0, 10);
  }

  private buildCandidateDates(start: string, end: string, selectedDate?: string | null) {
    if (selectedDate) {
      return selectedDate >= start && selectedDate <= end ? [selectedDate] : [];
    }

    const dates: string[] = [];
    let cursor = start;
    let guard = 0;
    while (cursor <= end && guard < 21) {
      dates.push(cursor);
      cursor = this.addDays(cursor, 1);
      guard += 1;
    }
    return dates;
  }

  private validatePrazoConclusaoTarefa(demanda: { prazoProcesso: string }, prazoConclusao: string) {
    if (!prazoConclusao) {
      throw new AppError(400, "TAREFA_PRAZO_REQUIRED", "Toda tarefa precisa ter prazo de conclusao.");
    }

    if (new Date(`${prazoConclusao}T00:00:00`).getTime() > new Date(`${demanda.prazoProcesso}T00:00:00`).getTime()) {
      throw new AppError(400, "TAREFA_PRAZO_FORA_DO_PROCESSO", "O prazo da tarefa nao pode ser maior que o prazo do processo.");
    }
  }

  private getProximaDataRecorrente(input: {
    prazoConclusao: string;
    recorrenciaTipo: TarefaRecorrenciaTipo | null;
    recorrenciaDiasSemana: string[] | null;
    recorrenciaDiaMes: number | null;
  }) {
    if (!input.recorrenciaTipo) {
      return null;
    }

    const current = new Date(`${input.prazoConclusao}T00:00:00`);

    if (input.recorrenciaTipo === "diaria") {
      current.setDate(current.getDate() + 1);
      return current.toISOString().slice(0, 10);
    }

    if (input.recorrenciaTipo === "semanal") {
      const weekdayMap = new Map<string, number>([
        ["dom", 0],
        ["seg", 1],
        ["ter", 2],
        ["qua", 3],
        ["qui", 4],
        ["sex", 5],
        ["sab", 6],
      ]);
      const targets = (input.recorrenciaDiasSemana ?? [])
        .map((value) => weekdayMap.get(String(value).slice(0, 3).toLowerCase()))
        .filter((value): value is number => value !== undefined)
        .sort((left, right) => left - right);

      if (!targets.length) {
        current.setDate(current.getDate() + 7);
        return current.toISOString().slice(0, 10);
      }

      for (let offset = 1; offset <= 7; offset += 1) {
        const candidate = new Date(current);
        candidate.setDate(candidate.getDate() + offset);
        if (targets.includes(candidate.getDay())) {
          return candidate.toISOString().slice(0, 10);
        }
      }
    }

    if (input.recorrenciaTipo in RECORRENCIA_MESES) {
      return this.addMonthsKeepingDay(
        input.prazoConclusao,
        RECORRENCIA_MESES[input.recorrenciaTipo as Exclude<TarefaRecorrenciaTipo, "diaria" | "semanal">],
        input.recorrenciaDiaMes,
      );
    }

    return null;
  }

  async listTarefas(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    return loadTarefas(this.pool, demanda.id, demanda.preId);
  }

  async listSchedulingSuggestions(params: { preId: string; prazoConclusao?: string | null; limit?: number }) {
    const demanda = await getResolvedPreDemanda(this.pool, params.preId);
    const now = new Date();
    const today = this.formatLocalDate(now);
    const endDate = params.prazoConclusao
      ? params.prazoConclusao <= demanda.prazoProcesso
        ? params.prazoConclusao
        : demanda.prazoProcesso
      : [this.addDays(today, 13), demanda.prazoProcesso].sort()[0] ?? demanda.prazoProcesso;
    const candidateDates = this.buildCandidateDates(today, endDate, params.prazoConclusao);

    if (!candidateDates.length) {
      return [];
    }

    const rangeStart = candidateDates[0]!;
    const rangeEnd = candidateDates[candidateDates.length - 1]!;

    const loadRows = await this.pool.query(
      `
        select
          tarefa.prazo_conclusao::text as data,
          count(*)::int as total_dia,
          count(*) filter (where tarefa.horario_inicio >= time '09:00' and tarefa.horario_inicio < time '10:00')::int as slot_0900,
          count(*) filter (where tarefa.horario_inicio >= time '11:00' and tarefa.horario_inicio < time '12:00')::int as slot_1100,
          count(*) filter (where tarefa.horario_inicio >= time '14:00' and tarefa.horario_inicio < time '15:00')::int as slot_1400,
          count(*) filter (where tarefa.horario_inicio >= time '16:00' and tarefa.horario_inicio < time '17:00')::int as slot_1600
        from adminlog.tarefas_pendentes tarefa
        where tarefa.concluida = false
          and tarefa.prazo_conclusao between $1::date and $2::date
        group by tarefa.prazo_conclusao
      `,
      [rangeStart, rangeEnd],
    );

    const loadMap = new Map<string, {
      totalDia: number;
      slot0900: number;
      slot1100: number;
      slot1400: number;
      slot1600: number;
    }>();
    for (const row of loadRows.rows) {
      loadMap.set(String(row.data), {
        totalDia: Number(row.total_dia ?? 0),
        slot0900: Number(row.slot_0900 ?? 0),
        slot1100: Number(row.slot_1100 ?? 0),
        slot1400: Number(row.slot_1400 ?? 0),
        slot1600: Number(row.slot_1600 ?? 0),
      });
    }

    const currentHour = now.getHours();
    const suggestions = candidateDates.flatMap((date) => {
      const load = loadMap.get(date) ?? {
        totalDia: 0,
        slot0900: 0,
        slot1100: 0,
        slot1400: 0,
        slot1600: 0,
      };
      const dateOffset = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
      const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());

      return TASK_SUGGESTION_SLOTS
        .filter((slot) => date !== today || Number(slot.inicio.slice(0, 2)) > currentHour)
        .map((slot) => {
          const totalNaFaixa =
            slot.inicio === "09:00"
              ? load.slot0900
              : slot.inicio === "11:00"
                ? load.slot1100
                : slot.inicio === "14:00"
                  ? load.slot1400
                  : load.slot1600;

          return {
            data: date,
            horarioInicio: slot.inicio,
            horarioFim: slot.fim,
            totalTarefasNoDia: load.totalDia,
            totalTarefasNaFaixa: totalNaFaixa,
            scopedToDate: Boolean(params.prazoConclusao),
            score: load.totalDia * 100 + totalNaFaixa * 10 + dateOffset + (isWeekend ? 3 : 0),
          };
        });
    });

    return suggestions
      .sort((left, right) => left.score - right.score || left.data.localeCompare(right.data) || left.horarioInicio.localeCompare(right.horarioInicio))
      .slice(0, params.limit ?? 4)
      .map(({ score: _score, ...suggestion }): TaskScheduleSuggestion => suggestion);
  }

  async createTarefa(input: CreateTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      this.validatePrazoConclusaoTarefa(demanda, input.prazoConclusao);
      const orderResult = await client.query(
        `select coalesce(max(ordem), 0) as max_ordem from adminlog.tarefas_pendentes where pre_demanda_id = $1`,
        [demanda.id],
      );
      const nextOrdem = Number(orderResult.rows[0]?.max_ordem ?? 0) + 1;
      const inserted = await client.query(
        `
          insert into adminlog.tarefas_pendentes (
            pre_demanda_id,
            ordem,
            descricao,
            tipo,
            assunto_id,
            procedimento_id,
            prazo_conclusao,
            horario_inicio,
            horario_fim,
            recorrencia_tipo,
            recorrencia_dias_semana,
            recorrencia_dia_mes,
            setor_destino_id,
            gerada_automaticamente,
            created_by_user_id
          )
          values ($1, $2, $3, $4, $5::uuid, $6::uuid, $7::date, $8::time, $9::time, $10, $11::jsonb, $12::int, $13::uuid, $14, $15)
          returning id
        `,
        [
          demanda.id,
          nextOrdem,
          input.descricao,
          input.tipo,
          input.assuntoId ?? null,
          input.procedimentoId ?? null,
          input.prazoConclusao,
          input.horarioInicio ?? null,
          input.horarioFim ?? null,
          input.recorrenciaTipo ?? null,
          input.recorrenciaDiasSemana ? JSON.stringify(input.recorrenciaDiasSemana) : null,
          input.recorrenciaDiaMes ?? null,
          input.setorDestinoId ?? null,
          input.geradaAutomaticamente ?? false,
          input.changedByUserId,
        ],
      );

      const tarefas = await loadTarefas(client, demanda.id, demanda.preId);
      const tarefa = tarefas.find((item) => item.id === String(inserted.rows[0].id));
      if (!tarefa) {
        throw new AppError(500, "TAREFA_CREATE_FAILED", "Falha ao carregar a tarefa criada.");
      }

      return tarefa;
    });
  }

  async updateTarefa(input: UpdateTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, concluida, descricao, tipo
          from adminlog.tarefas_pendentes
          where id = $1::uuid and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.tarefaId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "TAREFA_NOT_FOUND", "Tarefa nao encontrada.");
      }

      if (current.rows[0].concluida) {
        throw new AppError(409, "TAREFA_NOT_EDITABLE", "Tarefas concluidas nao podem ser alteradas.");
      }

      this.validatePrazoConclusaoTarefa(demanda, input.prazoConclusao);

      await client.query(
        `
          update adminlog.tarefas_pendentes
          set descricao = $3, tipo = $4, prazo_conclusao = $5::date, horario_inicio = $6::time, horario_fim = $7::time, recorrencia_tipo = $8, recorrencia_dias_semana = $9::jsonb, recorrencia_dia_mes = $10::int
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [
          input.tarefaId,
          demanda.id,
          input.descricao,
          input.tipo,
          input.prazoConclusao,
          input.horarioInicio ?? null,
          input.horarioFim ?? null,
          input.recorrenciaTipo ?? null,
          input.recorrenciaDiasSemana ? JSON.stringify(input.recorrenciaDiasSemana) : null,
          input.recorrenciaDiaMes ?? null,
        ],
      );

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Tarefa atualizada: ${input.descricao}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      const tarefas = await loadTarefas(client, demanda.id, demanda.preId);
      const tarefa = tarefas.find((item) => item.id === input.tarefaId);
      if (!tarefa) {
        throw new AppError(500, "TAREFA_UPDATE_FAILED", "Falha ao carregar a tarefa atualizada.");
      }

      return tarefa;
    });
  }

  async reorderTarefas(input: { preId: string; tarefaIds: string[]; changedByUserId: number }) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id
          from adminlog.tarefas_pendentes
          where pre_demanda_id = $1 and concluida = false
          order by ordem asc, created_at asc, id asc
          for update
        `,
        [demanda.id],
      );

      const currentIds = current.rows.map((row) => String(row.id));
      const requestedIds = input.tarefaIds;

      if (currentIds.length !== requestedIds.length || currentIds.some((id) => !requestedIds.includes(id))) {
        throw new AppError(400, "TAREFA_REORDER_INVALID", "A ordenacao informada nao corresponde as tarefas pendentes da demanda.");
      }

      for (let index = 0; index < requestedIds.length; index += 1) {
        await client.query(
          `update adminlog.tarefas_pendentes set ordem = $3 where id = $1::uuid and pre_demanda_id = $2`,
          [requestedIds[index], demanda.id, index + 1],
        );
      }

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: "Checklist reorganizada manualmente.",
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return loadTarefas(client, demanda.id, demanda.preId);
    });
  }

  async removeTarefa(input: RemoveTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, descricao, concluida
          from adminlog.tarefas_pendentes
          where id = $1::uuid and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.tarefaId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "TAREFA_NOT_FOUND", "Tarefa nao encontrada.");
      }

      if (current.rows[0].concluida) {
        throw new AppError(409, "TAREFA_NOT_DELETABLE", "Tarefas concluidas nao podem ser excluidas.");
      }

      await client.query(
        `
          delete from adminlog.tarefas_pendentes
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [input.tarefaId, demanda.id],
      );

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Tarefa removida: ${String(current.rows[0].descricao)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return { removedId: input.tarefaId };
    });
  }

  async concluirTarefa(input: ConcluirTarefaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await getResolvedPreDemanda(client, input.preId);
      const current = await client.query(
        `
          select id, descricao, concluida, tipo, ordem, assunto_id, procedimento_id
               , setor_destino_id
               , prazo_conclusao, horario_inicio, horario_fim, recorrencia_tipo, recorrencia_dias_semana, recorrencia_dia_mes, gerada_automaticamente
          from adminlog.tarefas_pendentes
          where id = $1::uuid and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.tarefaId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "TAREFA_NOT_FOUND", "Tarefa nao encontrada.");
      }

      if (current.rows[0].concluida) {
        throw new AppError(409, "TAREFA_ALREADY_DONE", "A tarefa ja foi concluida.");
      }

      await client.query(
        `
          update adminlog.tarefas_pendentes
          set concluida = true, concluida_em = now(), concluida_por_user_id = $3
          where id = $1::uuid and pre_demanda_id = $2
        `,
        [input.tarefaId, demanda.id, input.changedByUserId],
      );

      const proximaDataRecorrente = this.getProximaDataRecorrente({
        prazoConclusao: new Date(current.rows[0].prazo_conclusao).toISOString().slice(0, 10),
        recorrenciaTipo: current.rows[0].recorrencia_tipo ? (String(current.rows[0].recorrencia_tipo) as TarefaRecorrenciaTipo) : null,
        recorrenciaDiasSemana: Array.isArray(current.rows[0].recorrencia_dias_semana)
          ? current.rows[0].recorrencia_dias_semana.filter((item: unknown): item is string => typeof item === "string")
          : null,
        recorrenciaDiaMes: typeof current.rows[0].recorrencia_dia_mes === "number"
          ? current.rows[0].recorrencia_dia_mes
          : current.rows[0].recorrencia_dia_mes
            ? Number(current.rows[0].recorrencia_dia_mes)
            : null,
      });

      if (proximaDataRecorrente && new Date(`${proximaDataRecorrente}T00:00:00`).getTime() <= new Date(`${demanda.prazoProcesso}T00:00:00`).getTime()) {
        const ordemResult = await client.query(
          `select coalesce(max(ordem), 0) as max_ordem from adminlog.tarefas_pendentes where pre_demanda_id = $1`,
          [demanda.id],
        );
        const nextOrdem = Number(ordemResult.rows[0]?.max_ordem ?? current.rows[0].ordem ?? 0) + 1;

        await client.query(
          `
            insert into adminlog.tarefas_pendentes (
              pre_demanda_id,
              ordem,
              descricao,
              tipo,
              assunto_id,
              procedimento_id,
              prazo_conclusao,
              horario_inicio,
              horario_fim,
              recorrencia_tipo,
              recorrencia_dias_semana,
              recorrencia_dia_mes,
              setor_destino_id,
              gerada_automaticamente,
              created_by_user_id
            )
            values ($1, $2, $3, $4, $5::uuid, $6::uuid, $7::date, $8::time, $9::time, $10, $11::jsonb, $12::int, $13::uuid, $14, $15)
          `,
          [
            demanda.id,
            nextOrdem,
            String(current.rows[0].descricao),
            String(current.rows[0].tipo),
            current.rows[0].assunto_id ?? null,
            current.rows[0].procedimento_id ?? null,
            proximaDataRecorrente,
            current.rows[0].horario_inicio ?? null,
            current.rows[0].horario_fim ?? null,
            current.rows[0].recorrencia_tipo ?? null,
            current.rows[0].recorrencia_dias_semana ? JSON.stringify(current.rows[0].recorrencia_dias_semana) : null,
            current.rows[0].recorrencia_dia_mes ?? null,
            current.rows[0].setor_destino_id ?? null,
            Boolean(current.rows[0].gerada_automaticamente),
            input.changedByUserId,
          ],
        );

        await insertAndamento(client, {
          preDemandaId: demanda.id,
          preId: demanda.preId,
          descricao: `Nova ocorrencia gerada para a tarefa recorrente ${String(current.rows[0].descricao)} com prazo em ${new Date(`${proximaDataRecorrente}T00:00:00`).toLocaleDateString("pt-BR")}.`,
          tipo: "sistema",
          createdByUserId: input.changedByUserId,
        });
      }

      if (current.rows[0].setor_destino_id) {
        await activateSetorFromTarefa(client, {
          preDemandaId: demanda.id,
          preId: demanda.preId,
          setorDestinoId: String(current.rows[0].setor_destino_id),
          changedByUserId: input.changedByUserId,
        });
      }

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Tarefa concluida: ${String(current.rows[0].descricao)}.`,
        tipo: "tarefa_concluida",
        createdByUserId: input.changedByUserId,
      });

      const tarefas = await loadTarefas(client, demanda.id, demanda.preId);
      const tarefa = tarefas.find((item) => item.id === input.tarefaId);
      if (!tarefa) {
        throw new AppError(500, "TAREFA_UPDATE_FAILED", "Falha ao carregar a tarefa atualizada.");
      }

      return tarefa;
    });
  }
}
