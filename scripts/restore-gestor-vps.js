const fs = require("fs");
const { Client } = require("ssh2");

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Env var obrigatoria ausente: ${name}`);
  }

  return value;
}

function toBase64(content) {
  return Buffer.from(content, "utf8").toString("base64");
}

function bashSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function buildRemoteScript(options) {
  const smokeEnv = [];

  if (options.smokeRequireAuth) {
    smokeEnv.push(`SMOKE_TEST_REQUIRE_AUTH=${bashSingleQuote(options.smokeRequireAuth)}`);
  }

  if (options.smokeRequireAdmin) {
    smokeEnv.push(`SMOKE_TEST_REQUIRE_ADMIN=${bashSingleQuote(options.smokeRequireAdmin)}`);
  }

  if (options.smokeEmail) {
    smokeEnv.push(`SMOKE_TEST_EMAIL=${bashSingleQuote(options.smokeEmail)}`);
  }

  if (options.smokePassword) {
    smokeEnv.push(`SMOKE_TEST_PASSWORD=${bashSingleQuote(options.smokePassword)}`);
  }

  if (options.smokeAdminEmail) {
    smokeEnv.push(`SMOKE_TEST_ADMIN_EMAIL=${bashSingleQuote(options.smokeAdminEmail)}`);
  }

  if (options.smokeAdminPassword) {
    smokeEnv.push(`SMOKE_TEST_ADMIN_PASSWORD=${bashSingleQuote(options.smokeAdminPassword)}`);
  }

  const smokePrefix = smokeEnv.length ? `${smokeEnv.join(" ")} ` : "";

  return [
    "set -euo pipefail",
    `cd ${bashSingleQuote(options.remoteDir)}`,
    "",
    `CONTAINER_NAME=${bashSingleQuote(options.containerName)}`,
    `PORT_BIND=${bashSingleQuote(options.portBind)}`,
    `HEALTH_URL=${bashSingleQuote(options.healthUrl)}`,
    `READY_URL=${bashSingleQuote(options.readyUrl)}`,
    `BACKUP_DIR=${bashSingleQuote(options.backupDir)}`,
    `RESTORE_FILE=${bashSingleQuote(options.restoreFile)}`,
    `RESTORE_LATEST=${bashSingleQuote(options.restoreLatest)}`,
    `SCHEMA_NAME=${bashSingleQuote(options.schemaName)}`,
    `CONFIRM_TOKEN=${bashSingleQuote(options.confirmToken)}`,
    `PG_IMAGE=${bashSingleQuote(options.pgImage)}`,
    `SMOKE_PREFIX=${bashSingleQuote(smokePrefix)}`,
    "",
    'if [ "$CONFIRM_TOKEN" != "ERASE_ADMINLOG" ]; then echo "Defina JMU_RESTORE_CONFIRM=ERASE_ADMINLOG para permitir o restore." >&2; exit 1; fi',
    'if [ ! -f .env ]; then echo ".env remoto nao encontrado." >&2; exit 1; fi',
    "set -a",
    ". ./.env",
    "set +a",
    'if [ -z "${DATABASE_URL:-}" ]; then echo "DATABASE_URL nao configurada na VPS." >&2; exit 1; fi',
    'TARGET_FILE="$RESTORE_FILE"',
    'if [ "$RESTORE_LATEST" = "true" ]; then',
    '  TARGET_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" | sort -r | head -n 1)"',
    "fi",
    'if [ -z "$TARGET_FILE" ]; then echo "Informe JMU_RESTORE_FILE ou JMU_RESTORE_LATEST=true." >&2; exit 1; fi',
    'case "$TARGET_FILE" in',
    '  /*) ;;',
    '  *) TARGET_FILE="$BACKUP_DIR/$TARGET_FILE" ;;',
    "esac",
    'if [ ! -f "$TARGET_FILE" ]; then echo "Arquivo de backup nao encontrado: $TARGET_FILE" >&2; exit 1; fi',
    'gzip -t "$TARGET_FILE"',
    'CURRENT_IMAGE="$(docker inspect "$CONTAINER_NAME" --format \'{{.Config.Image}}\' 2>/dev/null || true)"',
    'echo "restore_file=$TARGET_FILE"',
    'echo "current_image=${CURRENT_IMAGE}"',
    "",
    'PRE_RESTORE_TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"',
    'PRE_RESTORE_BASENAME="gestor-${SCHEMA_NAME}-${PRE_RESTORE_TIMESTAMP}-pre-restore.sql.gz"',
    'PRE_RESTORE_SQL_BASENAME="gestor-${SCHEMA_NAME}-${PRE_RESTORE_TIMESTAMP}-pre-restore.sql.part"',
    'PRE_RESTORE_SQL_FILE="$BACKUP_DIR/$PRE_RESTORE_SQL_BASENAME"',
    'PRE_RESTORE_FILE="$BACKUP_DIR/$PRE_RESTORE_BASENAME"',
    'rm -f "$PRE_RESTORE_SQL_FILE" "$PRE_RESTORE_FILE"',
    'docker run --rm -e DATABASE_URL="$DATABASE_URL" -e SCHEMA_NAME="$SCHEMA_NAME" -e PRE_RESTORE_SQL_BASENAME="$PRE_RESTORE_SQL_BASENAME" -v "$BACKUP_DIR:/backup" "$PG_IMAGE" /bin/sh -lc \'pg_dump --no-owner --no-privileges --schema "$SCHEMA_NAME" -f "/backup/$PRE_RESTORE_SQL_BASENAME" "$DATABASE_URL"\'',
    'if [ ! -s "$PRE_RESTORE_SQL_FILE" ]; then echo "Pre-restore gerado com tamanho zero." >&2; rm -f "$PRE_RESTORE_SQL_FILE"; exit 1; fi',
    'gzip -9 "$PRE_RESTORE_SQL_FILE"',
    'gzip -t "$PRE_RESTORE_FILE"',
    'echo "pre_restore_backup=$BACKUP_DIR/$PRE_RESTORE_BASENAME"',
    "",
    'docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true',
    'docker run --rm -e DATABASE_URL="$DATABASE_URL" -e SCHEMA_NAME="$SCHEMA_NAME" "$PG_IMAGE" /bin/sh -lc \'printf "drop schema if exists %s cascade;\\n" "$SCHEMA_NAME" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1\'',
    'docker run --rm -e DATABASE_URL="$DATABASE_URL" -v "$BACKUP_DIR:/backup" "$PG_IMAGE" /bin/sh -lc \'gunzip -c "$1" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1\' -- "$TARGET_FILE"',
    "",
    'if [ -n "$CURRENT_IMAGE" ]; then',
    '  docker run -d --name "$CONTAINER_NAME" --restart unless-stopped --env-file .env -p "$PORT_BIND" "$CURRENT_IMAGE" >/dev/null',
    "  sleep 15",
    '  docker exec "$CONTAINER_NAME" node dist/server/scripts/migrate.js',
    '  curl -fsS "$HEALTH_URL" >/tmp/gestor-health.json',
    '  curl -fsS "$READY_URL" >/tmp/gestor-ready.json',
    '  docker exec "$CONTAINER_NAME" /bin/sh -lc "${SMOKE_PREFIX}APP_BASE_URL=http://127.0.0.1:3000 node dist/server/scripts/smoke-test.js"',
    '  echo "health=$(cat /tmp/gestor-health.json)"',
    '  echo "ready=$(cat /tmp/gestor-ready.json)"',
    "fi",
  ].join("\n");
}

async function run() {
  const host = getRequiredEnv("JMU_SSH_HOST");
  const username = process.env.JMU_SSH_USER || "root";
  const port = Number(process.env.JMU_SSH_PORT || "22");
  const password = process.env.JMU_SSH_PASSWORD;
  const keyPath = process.env.JMU_SSH_KEY_PATH;

  if (!password && !keyPath && !process.env.SSH_AUTH_SOCK) {
    throw new Error("Informe JMU_SSH_PASSWORD, JMU_SSH_KEY_PATH ou SSH_AUTH_SOCK.");
  }

  const options = {
    remoteDir: process.env.JMU_REMOTE_APP_DIR || "/home/johnsontn-app/apps/gestor-web",
    containerName: process.env.JMU_CONTAINER_NAME || "gestor-jmu-web",
    portBind: process.env.JMU_CONTAINER_BIND || "127.0.0.1:3000:3000",
    healthUrl: process.env.JMU_HEALTH_URL || "http://127.0.0.1:3000/api/health",
    readyUrl: process.env.JMU_READY_URL || "http://127.0.0.1:3000/api/ready",
    backupDir: process.env.JMU_BACKUP_DIR || "/home/johnsontn-app/backups/gestor-web",
    restoreFile: process.env.JMU_RESTORE_FILE || "",
    restoreLatest: process.env.JMU_RESTORE_LATEST || "",
    schemaName: process.env.JMU_DATABASE_SCHEMA || "adminlog",
    confirmToken: process.env.JMU_RESTORE_CONFIRM || "",
    pgImage: process.env.JMU_PG_IMAGE || "postgres:17-alpine",
    smokeRequireAuth: process.env.JMU_SMOKE_TEST_REQUIRE_AUTH || "",
    smokeRequireAdmin: process.env.JMU_SMOKE_TEST_REQUIRE_ADMIN || "",
    smokeEmail: process.env.JMU_SMOKE_TEST_EMAIL || "",
    smokePassword: process.env.JMU_SMOKE_TEST_PASSWORD || "",
    smokeAdminEmail: process.env.JMU_SMOKE_TEST_ADMIN_EMAIL || "",
    smokeAdminPassword: process.env.JMU_SMOKE_TEST_ADMIN_PASSWORD || "",
  };

  const remoteScript = buildRemoteScript(options);
  const payload = toBase64(remoteScript);
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn
      .on("ready", () => {
        conn.exec(`echo ${payload} | base64 -d | /bin/bash`, (error, stream) => {
          if (error) {
            reject(error);
            return;
          }

          stream.on("data", (data) => process.stdout.write(data.toString()));
          stream.stderr.on("data", (data) => process.stderr.write(data.toString()));
          stream.on("close", (code) => {
            conn.end();

            if (code === 0) {
              resolve();
              return;
            }

            reject(new Error(`Restore remoto falhou com codigo ${code}.`));
          });
        });
      })
      .on("error", reject)
      .connect({
        host,
        port,
        username,
        ...(process.env.SSH_AUTH_SOCK ? { agent: process.env.SSH_AUTH_SOCK } : {}),
        ...(keyPath ? { privateKey: fs.readFileSync(keyPath, "utf8") } : {}),
        ...(password ? { password } : {}),
      });
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
