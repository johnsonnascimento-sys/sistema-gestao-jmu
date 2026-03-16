import type { QueryResultRow } from "pg";
import type { DatabasePool } from "../db";
import { AppError } from "../errors";
import type {
  CreateInteressadoInput,
  InteressadoRepository,
  ListInteressadosParams,
  ListInteressadosResult,
  UpdateInteressadoInput,
} from "./types";
import type { Interessado } from "../domain/types";

function mapInteressado(row: QueryResultRow): Interessado {
  return {
    id: String(row.id),
    nome: String(row.nome),
    cargo: row.cargo ? String(row.cargo) : null,
    matricula: row.matricula ? String(row.matricula) : null,
    cpf: row.cpf ? String(row.cpf) : null,
    dataNascimento: row.data_nascimento ? new Date(row.data_nascimento).toISOString().slice(0, 10) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function emptyToNull(value: string | null | undefined) {
  return value && value.length > 0 ? value : null;
}

export class PostgresInteressadoRepository implements InteressadoRepository {
  constructor(private readonly pool: DatabasePool) {}

  async list(params: ListInteressadosParams): Promise<ListInteressadosResult> {
    const values: Array<string | number> = [];
    const filters: string[] = [];

    if (params.q) {
      values.push(`%${params.q}%`);
      const index = values.length;
      filters.push(`(nome ilike $${index} or coalesce(cargo, '') ilike $${index} or coalesce(matricula, '') ilike $${index} or coalesce(cpf, '') ilike $${index})`);
    }

    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const offset = (params.page - 1) * params.pageSize;
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;

    const [itemsResult, totalResult] = await Promise.all([
      this.pool.query(
        `
          select *
          from adminlog.interessados
          ${where}
          order by nome asc, created_at desc
          limit $${limitIndex}
          offset $${offsetIndex}
        `,
        [...values, params.pageSize, offset],
      ),
      this.pool.query(
        `
          select count(*)::int as total
          from adminlog.interessados
          ${where}
        `,
        values,
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapInteressado),
      total: Number(totalResult.rows[0]?.total ?? 0),
    };
  }

  async getById(id: string) {
    const result = await this.pool.query("select * from adminlog.interessados where id = $1::uuid limit 1", [id]);
    return result.rows[0] ? mapInteressado(result.rows[0]) : null;
  }

  async create(input: CreateInteressadoInput) {
    const result = await this.pool.query(
      `
        insert into adminlog.interessados (nome, cargo, matricula, cpf, data_nascimento)
        values ($1, $2, $3, $4, $5::date)
        returning *
      `,
      [input.nome, emptyToNull(input.cargo), emptyToNull(input.matricula), emptyToNull(input.cpf), input.dataNascimento ?? null],
    );

    return mapInteressado(result.rows[0]);
  }

  async update(input: UpdateInteressadoInput) {
    const result = await this.pool.query(
      `
        update adminlog.interessados
        set
          nome = $2,
          cargo = $3,
          matricula = $4,
          cpf = $5,
          data_nascimento = $6::date
        where id = $1::uuid
        returning *
      `,
      [input.id, input.nome, emptyToNull(input.cargo), emptyToNull(input.matricula), emptyToNull(input.cpf), input.dataNascimento ?? null],
    );

    if (!result.rows[0]) {
      throw new AppError(404, "INTERESSADO_NOT_FOUND", "Interessado nao encontrado.");
    }

    return mapInteressado(result.rows[0]);
  }
}
