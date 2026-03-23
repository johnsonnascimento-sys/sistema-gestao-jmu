import { AppError } from "../errors";
import type { DatabasePool } from "../db";
import type { AudienciaSituacao } from "../domain/types";
import {
  getResolvedPreDemanda,
  inTransaction,
  insertAndamento,
  loadAudiencias,
  type Queryable,
} from "./postgres-pre-demanda-utils";
import type {
  CreateAudienciaInput,
  PreDemandaAudienciaRepository,
  RemoveAudienciaInput,
  UpdateAudienciaInput,
} from "./types";

const AUDIENCIA_PRIORITARIA: AudienciaSituacao[] = ["designada"];

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "AUDIENCIA_DATA_HORA_INVALIDA", "Data e hora da audiencia invalida.");
  }

  return date.toISOString();
}

function formatDateTimeForLog(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function buildMetadataPatch(summary: {
  dataHoraInicio: string | null;
  dataHoraFim: string | null;
  descricao: string | null;
  sala: string | null;
  situacao: AudienciaSituacao | null;
}) {
  return {
    audiencia_data: summary.dataHoraInicio ? summary.dataHoraInicio.slice(0, 10) : null,
    audiencia_status: summary.situacao,
    audiencia_horario_inicio: summary.dataHoraInicio,
    audiencia_horario_fim: summary.dataHoraFim,
    audiencia_sala: summary.sala,
    audiencia_descricao: summary.descricao,
  };
}

export class PostgresPreDemandaAudienciaRepository implements PreDemandaAudienciaRepository {
  constructor(private readonly pool: DatabasePool) {}

  private async ensureJudicialProcess(queryable: Queryable, preId: string) {
    const demanda = await getResolvedPreDemanda(queryable, preId);

    if (!demanda.numeroJudicial) {
      throw new AppError(409, "PRE_DEMANDA_AUDIENCIA_REQUER_NUMERO_JUDICIAL", "Apenas processos judiciais podem possuir audiencias.");
    }

    return demanda;
  }

  private async refreshResumoAudiencia(queryable: Queryable, preDemandaId: number) {
    const result = await queryable.query(
      `
        select
          audiencia.data_hora_inicio,
          audiencia.data_hora_fim,
          audiencia.descricao,
          audiencia.sala,
          audiencia.situacao
        from adminlog.demanda_audiencias_judiciais audiencia
        where audiencia.pre_demanda_id = $1
        order by
          case
            when audiencia.situacao = any($2::text[])
            then 0
            else 1
          end asc,
          audiencia.data_hora_inicio asc,
          audiencia.updated_at desc,
          audiencia.created_at desc,
          audiencia.id desc
        limit 1
      `,
      [preDemandaId, AUDIENCIA_PRIORITARIA],
    );

    const audiencia = result.rows[0] ?? null;
    const metadataPatch = buildMetadataPatch(
      audiencia
        ? {
            dataHoraInicio: new Date(audiencia.data_hora_inicio).toISOString(),
            dataHoraFim: audiencia.data_hora_fim ? new Date(audiencia.data_hora_fim).toISOString() : null,
            descricao: String(audiencia.descricao),
            sala: audiencia.sala ? String(audiencia.sala) : null,
            situacao: audiencia.situacao as AudienciaSituacao,
          }
        : {
            dataHoraInicio: null,
            dataHoraFim: null,
            descricao: null,
            sala: null,
            situacao: null,
          },
    );

    await queryable.query(
      `
        update adminlog.pre_demanda
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where id = $1
      `,
      [preDemandaId, JSON.stringify(metadataPatch)],
    );
  }

  async listAudiencias(preId: string) {
    const demanda = await getResolvedPreDemanda(this.pool, preId);
    if (!demanda.numeroJudicial) {
      return [];
    }

    return loadAudiencias(this.pool, demanda.id, demanda.preId);
  }

  async createAudiencia(input: CreateAudienciaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await this.ensureJudicialProcess(client, input.preId);
      const dataHoraInicio = normalizeDateTime(input.dataHoraInicio);
      const dataHoraFim = input.dataHoraFim ? normalizeDateTime(input.dataHoraFim) : null;

      if (dataHoraFim && new Date(dataHoraFim).getTime() < new Date(dataHoraInicio).getTime()) {
        throw new AppError(400, "AUDIENCIA_DATA_HORA_FIM_INVALIDA", "A data e hora final da audiencia nao pode ser anterior ao inicio.");
      }

      const inserted = await client.query(
        `
          insert into adminlog.demanda_audiencias_judiciais (
            pre_demanda_id,
            data_hora_inicio,
            data_hora_fim,
            descricao,
            sala,
            situacao,
            observacoes,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, null)
          returning id
        `,
        [
          demanda.id,
          dataHoraInicio,
          dataHoraFim,
          input.descricao,
          emptyToNull(input.sala),
          input.situacao ?? "designada",
          emptyToNull(input.observacoes),
          input.changedByUserId,
        ],
      );

      await this.refreshResumoAudiencia(client, demanda.id);

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Audiencia designada para ${formatDateTimeForLog(dataHoraInicio)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      const audiencias = await loadAudiencias(client, demanda.id, demanda.preId);
      const audiencia = audiencias.find((item) => item.id === String(inserted.rows[0].id));
      if (!audiencia) {
        throw new AppError(500, "AUDIENCIA_CREATE_FAILED", "Falha ao carregar a audiencia criada.");
      }

      return audiencia;
    });
  }

  async updateAudiencia(input: UpdateAudienciaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await this.ensureJudicialProcess(client, input.preId);
      const current = await client.query(
        `
          select id, data_hora_inicio, data_hora_fim, descricao, sala, situacao, observacoes
          from adminlog.demanda_audiencias_judiciais
          where id = $1::uuid
            and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.audienciaId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "AUDIENCIA_NOT_FOUND", "Audiencia nao encontrada.");
      }

      const dataHoraInicio = input.dataHoraInicio !== undefined ? normalizeDateTime(input.dataHoraInicio) : null;
      const dataHoraFim = input.dataHoraFim !== undefined ? (input.dataHoraFim ? normalizeDateTime(input.dataHoraFim) : null) : null;
      const nextDataHoraInicio = dataHoraInicio ?? new Date(current.rows[0].data_hora_inicio).toISOString();
      const nextDataHoraFim = input.dataHoraFim === undefined ? (current.rows[0].data_hora_fim ? new Date(current.rows[0].data_hora_fim).toISOString() : null) : dataHoraFim;

      if (nextDataHoraFim && new Date(nextDataHoraFim).getTime() < new Date(nextDataHoraInicio).getTime()) {
        throw new AppError(400, "AUDIENCIA_DATA_HORA_FIM_INVALIDA", "A data e hora final da audiencia nao pode ser anterior ao inicio.");
      }

      await client.query(
        `
          update adminlog.demanda_audiencias_judiciais
          set
            data_hora_inicio = case when $3::boolean then $4::timestamptz else data_hora_inicio end,
            data_hora_fim = case when $5::boolean then $6::timestamptz else data_hora_fim end,
            descricao = case when $7::boolean then $8 else descricao end,
            sala = case when $9::boolean then $10 else sala end,
            situacao = case when $11::boolean then $12 else situacao end,
            observacoes = case when $13::boolean then $14 else observacoes end,
            updated_by_user_id = $15
          where id = $1::uuid
            and pre_demanda_id = $2
        `,
        [
          input.audienciaId,
          demanda.id,
          input.dataHoraInicio !== undefined,
          dataHoraInicio,
          input.dataHoraFim !== undefined,
          input.dataHoraFim === undefined ? null : dataHoraFim,
          input.descricao !== undefined,
          input.descricao ?? null,
          input.sala !== undefined,
          emptyToNull(input.sala),
          input.situacao !== undefined,
          input.situacao ?? null,
          input.observacoes !== undefined,
          input.observacoes === undefined ? null : emptyToNull(input.observacoes),
          input.changedByUserId,
        ],
      );

      await this.refreshResumoAudiencia(client, demanda.id);

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Audiencia atualizada: ${String(input.descricao ?? current.rows[0].descricao)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      const audiencias = await loadAudiencias(client, demanda.id, demanda.preId);
      const audiencia = audiencias.find((item) => item.id === input.audienciaId);
      if (!audiencia) {
        throw new AppError(500, "AUDIENCIA_UPDATE_FAILED", "Falha ao carregar a audiencia atualizada.");
      }

      return audiencia;
    });
  }

  async removeAudiencia(input: RemoveAudienciaInput) {
    return inTransaction(this.pool, async (client) => {
      const demanda = await this.ensureJudicialProcess(client, input.preId);
      const current = await client.query(
        `
          select id, descricao
          from adminlog.demanda_audiencias_judiciais
          where id = $1::uuid
            and pre_demanda_id = $2
          limit 1
          for update
        `,
        [input.audienciaId, demanda.id],
      );

      if (!current.rows[0]) {
        throw new AppError(404, "AUDIENCIA_NOT_FOUND", "Audiencia nao encontrada.");
      }

      await client.query(
        `
          delete from adminlog.demanda_audiencias_judiciais
          where id = $1::uuid
            and pre_demanda_id = $2
        `,
        [input.audienciaId, demanda.id],
      );

      await this.refreshResumoAudiencia(client, demanda.id);

      await insertAndamento(client, {
        preDemandaId: demanda.id,
        preId: demanda.preId,
        descricao: `Audiencia removida: ${String(current.rows[0].descricao)}.`,
        tipo: "sistema",
        createdByUserId: input.changedByUserId,
      });

      return { removedId: input.audienciaId };
    });
  }
}
