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
    `DOCKER_NETWORK=${bashSingleQuote(options.dockerNetwork)}`,
    `HEALTH_URL=${bashSingleQuote(options.healthUrl)}`,
    `READY_URL=${bashSingleQuote(options.readyUrl)}`,
    `BACKUP_DIR=${bashSingleQuote(options.backupDir)}`,
    `BACKUP_SCHEMA=${bashSingleQuote(options.backupSchema)}`,
    `ROLLBACK_IMAGE=${bashSingleQuote(options.rollbackImage)}`,
    `ROLLBACK_COMMIT=${bashSingleQuote(options.rollbackCommit)}`,
    `SMOKE_PREFIX=${bashSingleQuote(smokePrefix)}`,
    "",
    'EVENT_LOG="$BACKUP_DIR/operations-events.jsonl"',
    'log_event() {',
    '  mkdir -p "$BACKUP_DIR"',
    '  printf \'{"id":"%s","kind":"rollback","status":"%s","source":"rollback-vps","message":"%s","reference":"%s","occurredAt":"%s"}\\n\' "$(date -u +%Y%m%dT%H%M%SZ)-$$" "$1" "$2" "$3" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$EVENT_LOG"',
    '}',
    "",
    'CURRENT_IMAGE="$(docker inspect "$CONTAINER_NAME" --format \'{{.Image}}\' 2>/dev/null || true)"',
    'TARGET_IMAGE="$ROLLBACK_IMAGE"',
    'if [ -z "$TARGET_IMAGE" ] && [ -n "$ROLLBACK_COMMIT" ]; then TARGET_IMAGE="$CONTAINER_NAME:commit-$ROLLBACK_COMMIT"; fi',
    'if [ -z "$TARGET_IMAGE" ]; then echo "Informe ROLLBACK_IMAGE ou ROLLBACK_COMMIT." >&2; exit 1; fi',
    'docker image inspect "$TARGET_IMAGE" >/dev/null',
    'docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1 || docker network create "$DOCKER_NETWORK" >/dev/null',
    'echo "rollback_target=${TARGET_IMAGE}"',
    'echo "current_image=${CURRENT_IMAGE}"',
    "",
    "rollback_failed=1",
    "cleanup_on_failure() {",
    '  if [ "$rollback_failed" -eq 1 ] && [ -n "$CURRENT_IMAGE" ]; then',
    '    echo "rollback_failed=1"',
    '    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true',
    '    docker run -d --name "$CONTAINER_NAME" --restart unless-stopped --network "$DOCKER_NETWORK" --env-file .env -e OPS_BACKUP_DIR=/backup/ops -e OPS_BACKUP_SCHEMA="$BACKUP_SCHEMA" -v "$BACKUP_DIR:/backup/ops:ro" -p "$PORT_BIND" "$CURRENT_IMAGE" >/dev/null',
    '    log_event "failure" "Rollback falhou e a imagem anterior foi restaurada." "$TARGET_IMAGE"',
    '    echo "restore_completed=1"',
    "  fi",
    "}",
    "trap cleanup_on_failure EXIT",
    "",
    'mkdir -p "$BACKUP_DIR"',
    'docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true',
    'docker run -d --name "$CONTAINER_NAME" --restart unless-stopped --network "$DOCKER_NETWORK" --env-file .env -e OPS_BACKUP_DIR=/backup/ops -e OPS_BACKUP_SCHEMA="$BACKUP_SCHEMA" -v "$BACKUP_DIR:/backup/ops:ro" -p "$PORT_BIND" "$TARGET_IMAGE" >/dev/null',
    "",
    "sleep 15",
    'curl -fsS "$HEALTH_URL" >/tmp/gestor-health.json',
    'curl -fsS "$READY_URL" >/tmp/gestor-ready.json',
    'docker exec "$CONTAINER_NAME" /bin/sh -lc "${SMOKE_PREFIX}APP_BASE_URL=http://127.0.0.1:3000 node dist/server/scripts/smoke-test.js"',
    'docker ps --filter "name=$CONTAINER_NAME" --format \'container={{.Names}} image={{.Image}} status={{.Status}} ports={{.Ports}}\'',
    "",
    'echo "health=$(cat /tmp/gestor-health.json)"',
    'echo "ready=$(cat /tmp/gestor-ready.json)"',
    'log_event "success" "Rollback concluido com smoke validado." "$TARGET_IMAGE"',
    "rollback_failed=0",
  ].join("\n");
}

async function run() {
  const host = getRequiredEnv("JMU_SSH_HOST");
  const username = process.env.JMU_SSH_USER || "root";
  const port = Number(process.env.JMU_SSH_PORT || "22");
  const password = process.env.JMU_SSH_PASSWORD;
  const keyPath = process.env.JMU_SSH_KEY_PATH;
  const rollbackCommit = process.env.JMU_ROLLBACK_COMMIT || "";
  const rollbackImage = process.env.JMU_ROLLBACK_IMAGE || "";

  if (!rollbackCommit && !rollbackImage) {
    throw new Error("Informe JMU_ROLLBACK_COMMIT ou JMU_ROLLBACK_IMAGE.");
  }

  if (!password && !keyPath && !process.env.SSH_AUTH_SOCK) {
    throw new Error("Informe JMU_SSH_PASSWORD, JMU_SSH_KEY_PATH ou SSH_AUTH_SOCK.");
  }

  const options = {
    remoteDir: process.env.JMU_REMOTE_APP_DIR || "/home/johnsontn-app/apps/gestor-web",
    containerName: process.env.JMU_CONTAINER_NAME || "gestor-jmu-web",
    portBind: process.env.JMU_CONTAINER_BIND || "127.0.0.1:3000:3000",
    dockerNetwork: process.env.JMU_DOCKER_NETWORK || "gestor-jmu-net",
    healthUrl: process.env.JMU_HEALTH_URL || "http://127.0.0.1:3000/api/health",
    readyUrl: process.env.JMU_READY_URL || "http://127.0.0.1:3000/api/ready",
    backupDir: process.env.JMU_BACKUP_DIR || "/home/johnsontn-app/backups/gestor-web",
    backupSchema: process.env.JMU_DATABASE_SCHEMA || "adminlog",
    smokeRequireAuth: process.env.JMU_SMOKE_TEST_REQUIRE_AUTH || "",
    smokeRequireAdmin: process.env.JMU_SMOKE_TEST_REQUIRE_ADMIN || "",
    smokeEmail: process.env.JMU_SMOKE_TEST_EMAIL || "",
    smokePassword: process.env.JMU_SMOKE_TEST_PASSWORD || "",
    smokeAdminEmail: process.env.JMU_SMOKE_TEST_ADMIN_EMAIL || "",
    smokeAdminPassword: process.env.JMU_SMOKE_TEST_ADMIN_PASSWORD || "",
    rollbackCommit,
    rollbackImage,
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

            reject(new Error(`Rollback remoto falhou com codigo ${code}.`));
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
