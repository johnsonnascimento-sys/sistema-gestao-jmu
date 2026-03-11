import type { QueryResultRow } from "pg";
import type { DatabasePool } from "../db";
import { AppError } from "../errors";
import type { Norma } from "../domain/types";
import type { CreateNormaInput, NormaRepository, UpdateNormaInput } from "./types";

function mapNorma(row: QueryResultRow): Norma {
  return {
    id: String(row.id),
    numero: String(row.numero),
    dataNorma: new Date(row.data_norma).toISOString().slice(0, 10),
    origem: String(row.origem),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PostgresNormaRepository implements NormaRepository {
  constructor(private readonly pool: DatabasePool) {}

  async list() {
    const result = await this.pool.query("select * from adminlog.normas order by data_norma desc, numero asc, origem asc");
    return result.rows.map(mapNorma);
  }

  async getById(id: string) {
    const result = await this.pool.query("select * from adminlog.normas where id = $1::uuid limit 1", [id]);
    return result.rows[0] ? mapNorma(result.rows[0]) : null;
  }

  async create(input: CreateNormaInput) {
    const result = await this.pool.query(
      `
        insert into adminlog.normas (numero, data_norma, origem)
        values ($1, $2::date, $3)
        returning *
      `,
      [input.numero, input.dataNorma, input.origem],
    );

    return mapNorma(result.rows[0]);
  }

  async update(input: UpdateNormaInput) {
    const result = await this.pool.query(
      `
        update adminlog.normas
        set
          numero = $2,
          data_norma = $3::date,
          origem = $4,
          updated_at = now()
        where id = $1::uuid
        returning *
      `,
      [input.id, input.numero, input.dataNorma, input.origem],
    );

    if (!result.rows[0]) {
      throw new AppError(404, "NORMA_NOT_FOUND", "Norma nao encontrada.");
    }

    return mapNorma(result.rows[0]);
  }
}
