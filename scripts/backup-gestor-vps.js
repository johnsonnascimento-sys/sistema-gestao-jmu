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

function sanitizeSegment(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildRemoteScript(options) {
  return [
    "set -euo pipefail",
    `cd ${bashSingleQuote(options.remoteDir)}`,
    "",
    `BACKUP_DIR=${bashSingleQuote(options.backupDir)}`,
    `SCHEMA_NAME=${bashSingleQuote(options.schemaName)}`,
    `BACKUP_LABEL=${bashSingleQuote(options.backupLabel)}`,
    `KEEP_LATEST=${bashSingleQuote(options.keepLatest)}`,
    `PG_IMAGE=${bashSingleQuote(options.pgImage)}`,
    "",
    'if [ ! -f .env ]; then echo ".env remoto nao encontrado." >&2; exit 1; fi',
    "set -a",
    ". ./.env",
    "set +a",
    'if [ -z "${DATABASE_URL:-}" ]; then echo "DATABASE_URL nao configurada na VPS." >&2; exit 1; fi',
    'mkdir -p "$BACKUP_DIR"',
    'TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"',
    'LABEL_SUFFIX=""',
    'if [ -n "$BACKUP_LABEL" ]; then LABEL_SUFFIX="-$BACKUP_LABEL"; fi',
    'BACKUP_BASENAME="gestor-${SCHEMA_NAME}-${TIMESTAMP}${LABEL_SUFFIX}.sql.gz"',
    'BACKUP_FILE="$BACKUP_DIR/$BACKUP_BASENAME"',
    'TMP_SQL_BASENAME="gestor-${SCHEMA_NAME}-${TIMESTAMP}${LABEL_SUFFIX}.sql.part"',
    'TMP_SQL_FILE="$BACKUP_DIR/$TMP_SQL_BASENAME"',
    'TMP_BACKUP_FILE="$TMP_SQL_FILE.gz"',
    "",
    'rm -f "$TMP_SQL_FILE" "$TMP_BACKUP_FILE"',
    'docker run --rm -e DATABASE_URL="$DATABASE_URL" -e SCHEMA_NAME="$SCHEMA_NAME" -e TMP_SQL_BASENAME="$TMP_SQL_BASENAME" -v "$BACKUP_DIR:/backup" "$PG_IMAGE" /bin/sh -lc \'pg_dump --no-owner --no-privileges --schema "$SCHEMA_NAME" -f "/backup/$TMP_SQL_BASENAME" "$DATABASE_URL"\'',
    'if [ ! -s "$TMP_SQL_FILE" ]; then echo "Backup SQL gerado com tamanho zero." >&2; rm -f "$TMP_SQL_FILE"; exit 1; fi',
    'gzip -9 "$TMP_SQL_FILE"',
    'gzip -t "$TMP_BACKUP_FILE"',
    'if [ ! -s "$TMP_BACKUP_FILE" ]; then echo "Backup gerado com tamanho zero." >&2; rm -f "$TMP_BACKUP_FILE"; exit 1; fi',
    'UNCOMPRESSED_SIZE="$(gzip -l "$TMP_BACKUP_FILE" | awk \'NR==2 {print $2}\')"',
    'if [ -z "$UNCOMPRESSED_SIZE" ] || [ "$UNCOMPRESSED_SIZE" -le 0 ]; then echo "Backup gerado sem conteudo util." >&2; rm -f "$TMP_BACKUP_FILE"; exit 1; fi',
    'mv "$TMP_BACKUP_FILE" "$BACKUP_FILE"',
    'echo "backup_file=$BACKUP_FILE"',
    'echo "backup_size=$(du -h "$BACKUP_FILE" | cut -f1)"',
    'echo "backup_sha256=$(sha256sum "$BACKUP_FILE" | cut -d" " -f1)"',
    "",
    'find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" | while read -r invalid_file; do',
    '  INVALID_SIZE="$(gzip -l "$invalid_file" | awk \'NR==2 {print $2}\')"',
    '  if [ -z "$INVALID_SIZE" ] || [ "$INVALID_SIZE" -le 0 ]; then',
    '    rm -f "$invalid_file"',
    '    echo "removed_invalid_backup=$invalid_file"',
    "  fi",
    "done",
    "",
    'if [ "${KEEP_LATEST}" -gt 0 ] 2>/dev/null; then',
    '  find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" | sort -r | tail -n +$(("${KEEP_LATEST}" + 1)) | while read -r old_file; do',
    '    rm -f "$old_file"',
    '    echo "pruned_backup=$old_file"',
    "  done",
    "fi",
    "",
    'echo "recent_backups="',
    'find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" -printf "%TY-%Tm-%Td %TH:%TM:%TS %p\n" | sort -r | head -n 5',
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
    backupDir: process.env.JMU_BACKUP_DIR || "/home/johnsontn-app/backups/gestor-web",
    schemaName: process.env.JMU_DATABASE_SCHEMA || "adminlog",
    backupLabel: sanitizeSegment(process.env.JMU_BACKUP_LABEL || ""),
    keepLatest: String(Number(process.env.JMU_BACKUP_KEEP_LATEST || "15")),
    pgImage: process.env.JMU_PG_IMAGE || "postgres:17-alpine",
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

            reject(new Error(`Backup remoto falhou com codigo ${code}.`));
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
