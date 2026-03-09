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
  return [
    "set -euo pipefail",
    `cd ${bashSingleQuote(options.remoteDir)}`,
    "",
    `CONTAINER_NAME=${bashSingleQuote(options.containerName)}`,
    `HEALTH_URL=${bashSingleQuote(options.healthUrl)}`,
    `READY_URL=${bashSingleQuote(options.readyUrl)}`,
    `BACKUP_DIR=${bashSingleQuote(options.backupDir)}`,
    `SCHEMA_NAME=${bashSingleQuote(options.schemaName)}`,
    "",
    'echo "branch=$(git rev-parse --abbrev-ref HEAD)"',
    'echo "commit=$(git rev-parse HEAD)"',
    'echo "status=$(git status --short | wc -l | tr -d \' \')"',
    'docker ps --filter "name=$CONTAINER_NAME" --format \'container={{.Names}} image={{.Image}} status={{.Status}} ports={{.Ports}}\'',
    'docker inspect "$CONTAINER_NAME" --format \'health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} started={{.State.StartedAt}} image={{.Image}}\'',
    'curl -fsS "$HEALTH_URL" >/tmp/gestor-health.json',
    'curl -fsS "$READY_URL" >/tmp/gestor-ready.json',
    'echo "health=$(cat /tmp/gestor-health.json)"',
    'echo "ready=$(cat /tmp/gestor-ready.json)"',
    'if [ -f .env ]; then',
    '  echo "smoke_require_auth=$(grep -E \'^SMOKE_TEST_REQUIRE_AUTH=\' .env | tail -n 1 | cut -d= -f2- || true)"',
    '  echo "smoke_require_admin=$(grep -E \'^SMOKE_TEST_REQUIRE_ADMIN=\' .env | tail -n 1 | cut -d= -f2- || true)"',
    '  echo "smoke_user_configured=$(grep -q \'^SMOKE_TEST_EMAIL=\' .env && ! grep -q \'^SMOKE_TEST_EMAIL=$\' .env && grep -q \'^SMOKE_TEST_PASSWORD=\' .env && ! grep -q \'^SMOKE_TEST_PASSWORD=$\' .env && echo true || echo false)"',
    '  echo "smoke_admin_configured=$(grep -q \'^SMOKE_TEST_ADMIN_EMAIL=\' .env && ! grep -q \'^SMOKE_TEST_ADMIN_EMAIL=$\' .env && grep -q \'^SMOKE_TEST_ADMIN_PASSWORD=\' .env && ! grep -q \'^SMOKE_TEST_ADMIN_PASSWORD=$\' .env && echo true || echo false)"',
    'fi',
    'if [ -d "$BACKUP_DIR" ]; then',
    '  echo "latest_backups="',
    '  find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" ! -size 0c -printf "%TY-%Tm-%Td %TH:%TM:%TS %s %p\n" | sort -r | head -n 5',
    "fi",
    'echo "recent_images="',
    'docker images --format \'{{.Repository}}:{{.Tag}} {{.CreatedSince}}\' | grep "^${CONTAINER_NAME}:" | head -n 8',
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
    healthUrl: process.env.JMU_HEALTH_URL || "http://127.0.0.1:3000/api/health",
    readyUrl: process.env.JMU_READY_URL || "http://127.0.0.1:3000/api/ready",
    backupDir: process.env.JMU_BACKUP_DIR || "/home/johnsontn-app/backups/gestor-web",
    schemaName: process.env.JMU_DATABASE_SCHEMA || "adminlog",
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

            reject(new Error(`Status remoto falhou com codigo ${code}.`));
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
