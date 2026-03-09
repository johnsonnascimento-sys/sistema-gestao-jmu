import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SchemaMigrationSummary } from "../domain/types";
import type { DatabasePool } from "../db";

export async function describeMigrations(pool: DatabasePool): Promise<SchemaMigrationSummary> {
  const migrationsDir = join(process.cwd(), "sql", "migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const appliedRows = await pool.query<{ version: string; checksum: string; applied_at: string }>(
    `
      select version, checksum, applied_at
      from adminlog.schema_migration
      order by version desc
    `,
  );
  const applied = new Map(appliedRows.rows.map((row) => [row.version, row]));
  const items: SchemaMigrationSummary["items"] = [];

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const row = applied.get(file);

    if (!row) {
      items.push({
        version: file,
        state: "pending",
        appliedAt: null,
      });
      continue;
    }

    items.push({
      version: file,
      state: row.checksum === checksum ? "applied" : "drifted",
      appliedAt: new Date(row.applied_at).toISOString(),
    });
  }

  return {
    totalFiles: items.length,
    appliedCount: items.filter((item) => item.state === "applied").length,
    pendingCount: items.filter((item) => item.state === "pending").length,
    driftedCount: items.filter((item) => item.state === "drifted").length,
    items,
  };
}
