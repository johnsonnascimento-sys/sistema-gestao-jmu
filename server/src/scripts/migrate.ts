import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config";
import { createPool } from "../db";

async function run() {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  const migrationsDir = join(process.cwd(), "sql", "migrations");

  try {
    await pool.query("create schema if not exists adminlog");
    await pool.query(`
      create table if not exists adminlog.schema_migration (
        version text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    const appliedRows = await pool.query<{ version: string; checksum: string }>(
      "select version, checksum from adminlog.schema_migration order by version",
    );
    const applied = new Map(appliedRows.rows.map((row) => [row.version, row.checksum]));

    for (const file of files) {
      const sql = await readFile(join(migrationsDir, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previousChecksum = applied.get(file);

      if (previousChecksum === checksum) {
        console.log(`skip ${file}`);
        continue;
      }

      if (previousChecksum && previousChecksum !== checksum) {
        throw new Error(`Migration checksum mismatch for ${file}.`);
      }

      const client = await pool.connect();

      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into adminlog.schema_migration (version, checksum) values ($1, $2)", [file, checksum]);
        await client.query("commit");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
