import type { QueryResultRow } from "pg";
import type { AuditActor, QueueHealthConfig, UserRole } from "../domain/types";
import type { DatabasePool } from "../db";
import type { QueueHealthThresholds } from "../domain/queue-health";
import type { SettingsRepository, UpdateQueueHealthConfigInput } from "./types";

function mapActor(row: QueryResultRow, prefix: string) {
  if (row[`${prefix}_id`] === null || row[`${prefix}_id`] === undefined) {
    return null;
  }

  return {
    id: Number(row[`${prefix}_id`]),
    email: String(row[`${prefix}_email`]),
    name: String(row[`${prefix}_name`]),
    role: row[`${prefix}_role`] as UserRole,
  } satisfies AuditActor;
}

function mapConfig(row: QueryResultRow, source: QueueHealthConfig["source"]): QueueHealthConfig {
  return {
    attentionDays: Number(row.queue_attention_days),
    criticalDays: Number(row.queue_critical_days),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedBy: mapActor(row, "updated_by"),
    source,
  };
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(
    private readonly pool: DatabasePool,
    private readonly fallbackQueueHealthThresholds: QueueHealthThresholds,
  ) {}

  private createFallbackConfig(): QueueHealthConfig {
    return {
      attentionDays: this.fallbackQueueHealthThresholds.attentionDays,
      criticalDays: this.fallbackQueueHealthThresholds.criticalDays,
      updatedAt: null,
      updatedBy: null,
      source: "fallback",
    };
  }

  async getQueueHealthConfig(): Promise<QueueHealthConfig> {
    try {
      const result = await this.pool.query(
        `
          select
            config.queue_attention_days,
            config.queue_critical_days,
            config.updated_at,
            updated_by.id as updated_by_id,
            updated_by.email as updated_by_email,
            updated_by.name as updated_by_name,
            updated_by.role as updated_by_role
          from adminlog.gestor_config config
          left join adminlog.app_user updated_by on updated_by.id = config.updated_by_user_id
          where config.id = 1
          limit 1
        `,
      );

      if (!result.rows[0]) {
        return this.createFallbackConfig();
      }

      return mapConfig(result.rows[0], "database");
    } catch {
      return this.createFallbackConfig();
    }
  }

  async updateQueueHealthConfig(input: UpdateQueueHealthConfigInput): Promise<QueueHealthConfig> {
    const result = await this.pool.query(
      `
        insert into adminlog.gestor_config (
          id,
          queue_attention_days,
          queue_critical_days,
          updated_by_user_id
        )
        values (1, $1, $2, $3)
        on conflict (id)
        do update
          set queue_attention_days = excluded.queue_attention_days,
              queue_critical_days = excluded.queue_critical_days,
              updated_by_user_id = excluded.updated_by_user_id,
              updated_at = now()
        returning
          queue_attention_days,
          queue_critical_days,
          updated_at,
          updated_by_user_id
      `,
      [input.attentionDays, input.criticalDays, input.updatedByUserId],
    );

    const config = result.rows[0];
    const actorResult = await this.pool.query(
      `
        select
          id as updated_by_id,
          email as updated_by_email,
          name as updated_by_name,
          role as updated_by_role
        from adminlog.app_user
        where id = $1
        limit 1
      `,
      [input.updatedByUserId],
    );

    return mapConfig(
      {
        ...config,
        ...(actorResult.rows[0] ?? {
          updated_by_id: null,
          updated_by_email: null,
          updated_by_name: null,
          updated_by_role: null,
        }),
      },
      "database",
    );
  }
}
