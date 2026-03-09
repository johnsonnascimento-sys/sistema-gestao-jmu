import type { PoolClient, QueryResultRow } from "pg";
import type { AdminUserAuditRecord, AdminUserSummary, AppUser, AuditActor } from "../domain/types";
import { AppError } from "../errors";
import type { DatabasePool } from "../db";
import type { CreateUserInput, ResetUserPasswordInput, UpdateUserInput, UserRepository } from "./types";

function mapActor(row: QueryResultRow, prefix: string): AuditActor | null {
  if (row[`${prefix}_id`] === null || row[`${prefix}_id`] === undefined) {
    return null;
  }

  return {
    id: Number(row[`${prefix}_id`]),
    email: String(row[`${prefix}_email`]),
    name: String(row[`${prefix}_name`]),
    role: row[`${prefix}_role`] as AuditActor["role"],
  };
}

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

function mapUserSummary(row: QueryResultRow): AdminUserSummary {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as AdminUserSummary["role"],
    active: Boolean(row.active),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapAdminAudit(row: QueryResultRow): AdminUserAuditRecord {
  return {
    id: Number(row.id),
    action: row.action as AdminUserAuditRecord["action"],
    actor: mapActor(row, "actor"),
    targetUser: {
      id: Number(row.target_user_id),
      email: String(row.target_email),
      name: String(row.target_name),
      role: row.target_role as AppUser["role"],
      active: Boolean(row.target_active),
    },
    nameAnterior: row.name_anterior ? String(row.name_anterior) : null,
    nameNovo: row.name_novo ? String(row.name_novo) : null,
    roleAnterior: row.role_anterior ? (row.role_anterior as AdminUserSummary["role"]) : null,
    roleNovo: row.role_novo ? (row.role_novo as AdminUserSummary["role"]) : null,
    activeAnterior: row.active_anterior === null || row.active_anterior === undefined ? null : Boolean(row.active_anterior),
    activeNovo: row.active_novo === null || row.active_novo === undefined ? null : Boolean(row.active_novo),
    registradoEm: new Date(row.registrado_em).toISOString(),
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

async function insertAdminAudit(
  client: PoolClient,
  input: {
    action: AdminUserAuditRecord["action"];
    actorUserId?: number | null;
    targetUser: AdminUserSummary;
    nameAnterior?: string | null;
    nameNovo?: string | null;
    roleAnterior?: AdminUserSummary["role"] | null;
    roleNovo?: AdminUserSummary["role"] | null;
    activeAnterior?: boolean | null;
    activeNovo?: boolean | null;
  },
) {
  await client.query(
    `
      insert into adminlog.admin_user_audit (
        action,
        actor_user_id,
        target_user_id,
        target_email,
        target_name,
        target_role,
        target_active,
        name_anterior,
        name_novo,
        role_anterior,
        role_novo,
        active_anterior,
        active_novo
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `,
    [
      input.action,
      input.actorUserId ?? null,
      input.targetUser.id,
      input.targetUser.email,
      input.targetUser.name,
      input.targetUser.role,
      input.targetUser.active,
      input.nameAnterior ?? null,
      input.nameNovo ?? null,
      input.roleAnterior ?? null,
      input.roleNovo ?? null,
      input.activeAnterior ?? null,
      input.activeNovo ?? null,
    ],
  );
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
    return inTransaction(this.pool, async (client) => {
      try {
        const result = await client.query(
          `
            insert into adminlog.app_user (email, name, password_hash, role)
            values (lower($1), $2, $3, $4)
            returning id, email, name, role, active, password_hash, created_at, updated_at
          `,
          [input.email, input.name, input.passwordHash, input.role],
        );

        const user = mapUser(result.rows[0]);
        const summary = mapUserSummary(result.rows[0]);

        await insertAdminAudit(client, {
          action: "user_created",
          actorUserId: input.changedByUserId,
          targetUser: summary,
          nameNovo: user.name,
          roleNovo: user.role,
          activeNovo: user.active,
        });

        return user;
      } catch (error) {
        const pgError = error as { code?: string; constraint?: string };

        if (pgError.code === "23505" && pgError.constraint === "uq_app_user_email_lower") {
          throw new AppError(409, "USER_EMAIL_CONFLICT", "Ja existe um utilizador com este email.");
        }

        throw error;
      }
    });
  }

  async list() {
    const result = await this.pool.query(
      `
        select id, email, name, role, active, created_at, updated_at
        from adminlog.app_user
        order by created_at desc
      `,
    );

    return result.rows.map(mapUserSummary);
  }

  async listAudit(limit = 12) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 12;
    const result = await this.pool.query(
      `
        select
          audit.id,
          audit.action,
          audit.target_user_id,
          audit.target_email,
          audit.target_name,
          audit.target_role,
          audit.target_active,
          audit.name_anterior,
          audit.name_novo,
          audit.role_anterior,
          audit.role_novo,
          audit.active_anterior,
          audit.active_novo,
          audit.registrado_em,
          actor.id as actor_id,
          actor.email as actor_email,
          actor.name as actor_name,
          actor.role as actor_role
        from adminlog.admin_user_audit audit
        left join adminlog.app_user actor on actor.id = audit.actor_user_id
        order by audit.registrado_em desc, audit.id desc
        limit $1
      `,
      [safeLimit],
    );

    return result.rows.map(mapAdminAudit);
  }

  async update(input: UpdateUserInput) {
    return inTransaction(this.pool, async (client) => {
      const currentResult = await client.query(
        `
          select id, email, name, role, active, password_hash, created_at, updated_at
          from adminlog.app_user
          where id = $1
          limit 1
          for update
        `,
        [input.id],
      );

      if (!currentResult.rows[0]) {
        throw new AppError(404, "USER_NOT_FOUND", "Usuario nao encontrado.");
      }

      const currentUser = mapUser(currentResult.rows[0]);
      const result = await client.query(
        `
          update adminlog.app_user
          set
            name = coalesce($2, name),
            role = coalesce($3, role),
            active = coalesce($4, active),
            updated_at = now()
          where id = $1
          returning id, email, name, role, active, created_at, updated_at
        `,
        [input.id, input.name ?? null, input.role ?? null, input.active ?? null],
      );

      const summary = mapUserSummary(result.rows[0]);

      if (input.name !== undefined && input.name !== currentUser.name) {
        await insertAdminAudit(client, {
          action: "user_name_changed",
          actorUserId: input.changedByUserId,
          targetUser: summary,
          nameAnterior: currentUser.name,
          nameNovo: summary.name,
        });
      }

      if (input.role !== undefined && input.role !== currentUser.role) {
        await insertAdminAudit(client, {
          action: "user_role_changed",
          actorUserId: input.changedByUserId,
          targetUser: summary,
          roleAnterior: currentUser.role,
          roleNovo: summary.role,
        });
      }

      if (input.active !== undefined && input.active !== currentUser.active) {
        await insertAdminAudit(client, {
          action: input.active ? "user_activated" : "user_deactivated",
          actorUserId: input.changedByUserId,
          targetUser: summary,
          activeAnterior: currentUser.active,
          activeNovo: summary.active,
        });
      }

      return summary;
    });
  }

  async resetPassword(input: ResetUserPasswordInput) {
    return inTransaction(this.pool, async (client) => {
      const result = await client.query(
        `
          update adminlog.app_user
          set
            password_hash = $2,
            updated_at = now()
          where id = $1
          returning id, email, name, role, active, created_at, updated_at
        `,
        [input.id, input.passwordHash],
      );

      if (!result.rows[0]) {
        throw new AppError(404, "USER_NOT_FOUND", "Usuario nao encontrado.");
      }

      const summary = mapUserSummary(result.rows[0]);

      await insertAdminAudit(client, {
        action: "user_password_reset",
        actorUserId: input.changedByUserId,
        targetUser: summary,
      });

      return summary;
    });
  }
}
