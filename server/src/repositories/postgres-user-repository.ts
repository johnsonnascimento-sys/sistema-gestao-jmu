import type { QueryResultRow } from "pg";
import type { AppUser } from "../domain/types";
import type { DatabasePool } from "../db";
import type { CreateUserInput, UserRepository } from "./types";

function mapUser(row: QueryResultRow): AppUser {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as AppUser["role"],
    active: Boolean(row.active),
    passwordHash: String(row.password_hash),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: DatabasePool) {}

  async findByEmail(email: string) {
    const result = await this.pool.query(
      `
        select id, email, name, role, active, password_hash, created_at, updated_at
        from adminlog.app_user
        where lower(email) = lower($1)
        limit 1
      `,
      [email],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findById(id: number) {
    const result = await this.pool.query(
      `
        select id, email, name, role, active, password_hash, created_at, updated_at
        from adminlog.app_user
        where id = $1
        limit 1
      `,
      [id],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async create(input: CreateUserInput) {
    const result = await this.pool.query(
      `
        insert into adminlog.app_user (email, name, password_hash, role)
        values (lower($1), $2, $3, $4)
        returning id, email, name, role, active, password_hash, created_at, updated_at
      `,
      [input.email, input.name, input.passwordHash, input.role],
    );

    return mapUser(result.rows[0]);
  }
}
