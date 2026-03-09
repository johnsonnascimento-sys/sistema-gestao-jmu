import type { PoolClient, QueryResultRow } from "pg";
import type { DatabasePool } from "../db";
import type { PreDemandaAuditRecord, PreDemandaDetail, PreDemandaStatus, SeiAssociation } from "../domain/types";
import { AppError } from "../errors";
import type {
  AssociateSeiInput,
  AssociateSeiResult,
  CreatePreDemandaInput,
  CreatePreDemandaResult,
  ListPreDemandasParams,
  ListPreDemandasResult,
  PreDemandaRepository,
} from "./types";

function mapPreDemanda(row: QueryResultRow): PreDemandaDetail {
  const currentAssociation =
    row.sei_numero === null
      ? null
      : {
          preId: String(row.pre_id),
          seiNumero: String(row.sei_numero),
          linkedAt: new Date(row.linked_at).toISOString(),
          updatedAt: new Date(row.link_updated_at).toISOString(),
          observacoes: row.link_observacoes ? String(row.link_observacoes) : null,
        };

  return {
    id: Number(row.id),
    preId: String(row.pre_id),
    solicitante: String(row.solicitante),
    assunto: String(row.assunto),
    dataReferencia: new Date(row.data_referencia).toISOString().slice(0, 10),
    status: row.status as PreDemandaStatus,
    descricao: row.descricao ? String(row.descricao) : null,
    fonte: row.fonte ? String(row.fonte) : null,
    observacoes: row.observacoes ? String(row.observacoes) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    currentAssociation,
  };
}

function mapAssociation(row: QueryResultRow): SeiAssociation {
  return {
    preId: String(row.pre_id),
    seiNumero: String(row.sei_numero),
    linkedAt: new Date(row.linked_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    observacoes: row.observacoes ? String(row.observacoes) : null,
  };
}

function mapAudit(row: QueryResultRow): PreDemandaAuditRecord {
  return {
    id: Number(row.id),
    preId: String(row.pre_id),
    seiNumeroAnterior: String(row.sei_numero_anterior),
    seiNumeroNovo: String(row.sei_numero_novo),
    motivo: row.motivo ? String(row.motivo) : null,
    registradoEm: new Date(row.registrado_em).toISOString(),
  };
}

function buildWhereClause(params: ListPreDemandasParams) {
  const values: Array<string | number | string[]> = [];
  const clauses: string[] = [];

  if (params.q) {
    values.push(`%${params.q}%`);
    const index = values.length;
    clauses.push(`(pd.pre_id ilike $${index} or pd.solicitante ilike $${index} or pd.assunto ilike $${index})`);
  }

  if (params.statuses?.length) {
    values.push(params.statuses);
    clauses.push(`pd.status = any($${values.length}::text[])`);
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values,
  };
}

async function inTransaction<T>(pool: DatabasePool, callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export class PostgresPreDemandaRepository implements PreDemandaRepository {
  constructor(private readonly pool: DatabasePool) {}

  async create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult> {
    try {
      const result = await this.pool.query(
        `
          insert into adminlog.pre_demanda (
            pre_id,
            solicitante,
            assunto,
            data_referencia,
            status,
            descricao,
            fonte,
            observacoes
          )
          values (
            adminlog.fn_generate_pre_id($1::date),
            $2,
            $3,
            $1::date,
            'aberta',
            $4,
            $5,
            $6
          )
          returning
            id,
            pre_id,
            solicitante,
            assunto,
            data_referencia,
            status,
            descricao,
            fonte,
            observacoes,
            created_at,
            updated_at,
            null::text as sei_numero,
            null::timestamptz as linked_at,
            null::timestamptz as link_updated_at,
            null::text as link_observacoes
        `,
        [
          input.dataReferencia,
          input.solicitante,
          input.assunto,
          input.descricao ?? null,
          input.fonte ?? null,
          input.observacoes ?? null,
        ],
      );

      return {
        record: mapPreDemanda(result.rows[0]),
        idempotent: false,
      };
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };

      if (pgError.code !== "23505" || pgError.constraint !== "uq_pre_demanda_idempotencia") {
        throw error;
      }

      const result = await this.pool.query(
        `
          select
            pd.id,
            pd.pre_id,
            pd.solicitante,
            pd.assunto,
            pd.data_referencia,
            pd.status,
            pd.descricao,
            pd.fonte,
            pd.observacoes,
            pd.created_at,
            pd.updated_at,
            pts.sei_numero,
            pts.linked_at,
            pts.updated_at as link_updated_at,
            pts.observacoes as link_observacoes
          from adminlog.pre_demanda pd
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          where pd.solicitante_norm = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
            and pd.assunto_norm = lower(regexp_replace(trim($2), '\s+', ' ', 'g'))
            and pd.data_referencia = $3::date
          limit 1
        `,
        [input.solicitante, input.assunto, input.dataReferencia],
      );

      if (!result.rows[0]) {
        throw new AppError(409, "PRE_DEMANDA_DUPLICATE", "Nao foi possivel recuperar a demanda existente.");
      }

      return {
        record: mapPreDemanda(result.rows[0]),
        idempotent: true,
      };
    }
  }

  async list(params: ListPreDemandasParams): Promise<ListPreDemandasResult> {
    const { where, values } = buildWhereClause(params);
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const offset = (params.page - 1) * params.pageSize;

    const [itemsResult, totalResult] = await Promise.all([
      this.pool.query(
        `
          select
            pd.id,
            pd.pre_id,
            pd.solicitante,
            pd.assunto,
            pd.data_referencia,
            pd.status,
            pd.descricao,
            pd.fonte,
            pd.observacoes,
            pd.created_at,
            pd.updated_at,
            pts.sei_numero,
            pts.linked_at,
            pts.updated_at as link_updated_at,
            pts.observacoes as link_observacoes
          from adminlog.pre_demanda pd
          left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
          ${where}
          order by pd.updated_at desc
          limit $${limitIndex}
          offset $${offsetIndex}
        `,
        [...values, params.pageSize, offset],
      ),
      this.pool.query(
        `
          select count(*)::int as total
          from adminlog.pre_demanda pd
          ${where}
        `,
        values,
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapPreDemanda),
      total: Number(totalResult.rows[0]?.total ?? 0),
    };
  }

  async getStatusCounts() {
    const result = await this.pool.query(
      `
        select status, count(*)::int as total
        from adminlog.pre_demanda
        group by status
      `,
    );

    return result.rows.map((row) => ({
      status: row.status as PreDemandaStatus,
      total: Number(row.total),
    }));
  }

  async getByPreId(preId: string) {
    const result = await this.pool.query(
      `
        select
          pd.id,
          pd.pre_id,
          pd.solicitante,
          pd.assunto,
          pd.data_referencia,
          pd.status,
          pd.descricao,
          pd.fonte,
          pd.observacoes,
          pd.created_at,
          pd.updated_at,
          pts.sei_numero,
          pts.linked_at,
          pts.updated_at as link_updated_at,
          pts.observacoes as link_observacoes
        from adminlog.pre_demanda pd
        left join adminlog.pre_to_sei_link pts on pts.pre_id = pd.pre_id
        where pd.pre_id = $1
        limit 1
      `,
      [preId],
    );

    return result.rows[0] ? mapPreDemanda(result.rows[0]) : null;
  }

  async associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult> {
    return inTransaction(this.pool, async (client) => {
      const demandaResult = await client.query(
        `
          select pre_id
          from adminlog.pre_demanda
          where pre_id = $1
          limit 1
          for update
        `,
        [input.preId],
      );

      if (!demandaResult.rows[0]) {
        throw new AppError(404, "PRE_DEMANDA_NOT_FOUND", "Pre-demanda nao encontrada.");
      }

      const currentLinkResult = await client.query(
        `
          select pre_id, sei_numero, linked_at, updated_at, observacoes
          from adminlog.pre_to_sei_link
          where pre_id = $1
          limit 1
          for update
        `,
        [input.preId],
      );

      let audited = false;

      if (!currentLinkResult.rows[0]) {
        const inserted = await client.query(
          `
            insert into adminlog.pre_to_sei_link (pre_id, sei_numero, observacoes)
            values ($1, $2, $3)
            returning pre_id, sei_numero, linked_at, updated_at, observacoes
          `,
          [input.preId, input.seiNumero, input.observacoes ?? null],
        );

        await client.query(
          `
            update adminlog.pre_demanda
            set status = 'associada'
            where pre_id = $1
          `,
          [input.preId],
        );

        return {
          association: mapAssociation(inserted.rows[0]),
          audited,
        };
      }

      const currentLink = mapAssociation(currentLinkResult.rows[0]);

      if (currentLink.seiNumero !== input.seiNumero) {
        audited = true;

        await client.query(
          `
            insert into adminlog.pre_to_sei_link_audit (
              pre_id,
              sei_numero_anterior,
              sei_numero_novo,
              motivo
            )
            values ($1, $2, $3, $4)
          `,
          [input.preId, currentLink.seiNumero, input.seiNumero, input.motivo ?? null],
        );
      }

      const updated = await client.query(
        `
          update adminlog.pre_to_sei_link
          set
            sei_numero = $2,
            observacoes = $3,
            updated_at = now()
          where pre_id = $1
          returning pre_id, sei_numero, linked_at, updated_at, observacoes
        `,
        [input.preId, input.seiNumero, input.observacoes ?? null],
      );

      await client.query(
        `
          update adminlog.pre_demanda
          set status = 'associada'
          where pre_id = $1
        `,
        [input.preId],
      );

      return {
        association: mapAssociation(updated.rows[0]),
        audited,
      };
    });
  }

  async listAudit(preId: string) {
    const result = await this.pool.query(
      `
        select id, pre_id, sei_numero_anterior, sei_numero_novo, motivo, registrado_em
        from adminlog.pre_to_sei_link_audit
        where pre_id = $1
        order by registrado_em desc
      `,
      [preId],
    );

    return result.rows.map(mapAudit);
  }
}
