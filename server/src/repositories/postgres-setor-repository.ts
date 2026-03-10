import type { QueryResultRow } from "pg";
import type { DatabasePool } from "../db";
import { AppError } from "../errors";
import type { Setor } from "../domain/types";
import type { CreateSetorInput, SetorRepository, UpdateSetorInput } from "./types";

function mapSetor(row: QueryResultRow): Setor {
  return {
    id: String(row.id),
    sigla: String(row.sigla),
    nomeCompleto: String(row.nome_completo),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PostgresSetorRepository implements SetorRepository {
  constructor(private readonly pool: DatabasePool) {}

  async list() {
    const result = await this.pool.query("select * from adminlog.setores order by sigla asc, nome_completo asc");
    return result.rows.map(mapSetor);
  }

  async getById(id: string) {
    const result = await this.pool.query("select * from adminlog.setores where id = $1::uuid limit 1", [id]);
    return result.rows[0] ? mapSetor(result.rows[0]) : null;
  }

  async create(input: CreateSetorInput) {
    const result = await this.pool.query(
      `
        insert into adminlog.setores (sigla, nome_completo)
        values (upper($1), $2)
        returning *
      `,
      [input.sigla, input.nomeCompleto],
    );

    return mapSetor(result.rows[0]);
  }

  async update(input: UpdateSetorInput) {
    const result = await this.pool.query(
      `
        update adminlog.setores
        set
          sigla = upper($2),
          nome_completo = $3
        where id = $1::uuid
        returning *
      `,
      [input.id, input.sigla, input.nomeCompleto],
    );

    if (!result.rows[0]) {
      throw new AppError(404, "SETOR_NOT_FOUND", "Setor nao encontrado.");
    }

    return mapSetor(result.rows[0]);
  }
}
