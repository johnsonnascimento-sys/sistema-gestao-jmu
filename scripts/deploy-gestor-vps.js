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

  if (options.smokeEmail) {
    smokeEnv.push(`SMOKE_TEST_EMAIL=${bashSingleQuote(options.smokeEmail)}`);
  }

  if (options.smokePassword) {
    smokeEnv.push(`SMOKE_TEST_PASSWORD=${bashSingleQuote(options.smokePassword)}`);
  }

  const smokePrefix = smokeEnv.length ? `${smokeEnv.join(" ")} ` : "";

  return [
    "set -euo pipefail",
    `cd ${bashSingleQuote(options.remoteDir)}`,
    "",
    `CONTAINER_NAME=${bashSingleQuote(options.containerName)}`,
    `PORT_BIND=${bashSingleQuote(options.portBind)}`,
    `BRANCH=${bashSingleQuote(options.branch)}`,
    `HEALTH_URL=${bashSingleQuote(options.healthUrl)}`,
    `READY_URL=${bashSingleQuote(options.readyUrl)}`,
    `SMOKE_PREFIX=${bashSingleQuote(smokePrefix)}`,
    "",
    'OLD_IMAGE="$(docker inspect "$CONTAINER_NAME" --format \'{{.Image}}\')"',
    'CURRENT_COMMIT="$(git rev-parse HEAD)"',
    'echo "current_commit=${CURRENT_COMMIT}"',
    'echo "old_image=${OLD_IMAGE}"',
    "",
    'git fetch origin "$BRANCH"',
    'git checkout "$BRANCH"',
    'git pull --ff-only origin "$BRANCH"',
    'NEW_COMMIT="$(git rev-parse HEAD)"',
    'echo "new_commit=${NEW_COMMIT}"',
    "",
    'docker build -t "$CONTAINER_NAME:latest" .',
    "",
    "deploy_failed=1",
    "cleanup_on_failure() {",
    '  if [ "$deploy_failed" -eq 1 ]; then',
    '    echo "deploy_failed=1"',
    '    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true',
    '    docker run -d --name "$CONTAINER_NAME" --restart unless-stopped --env-file .env -p "$PORT_BIND" "$OLD_IMAGE" >/dev/null',
    '    echo "rollback_completed=1"',
    "  fi",
    "}",
    "trap cleanup_on_failure EXIT",
    "",
    'docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true',
    'docker run -d --name "$CONTAINER_NAME" --restart unless-stopped --env-file .env -p "$PORT_BIND" "$CONTAINER_NAME:latest" >/dev/null',
    "",
    "sleep 15",
    'curl -fsS "$HEALTH_URL" >/tmp/gestor-health.json',
    'curl -fsS "$READY_URL" >/tmp/gestor-ready.json',
    'docker exec "$CONTAINER_NAME" /bin/sh -lc "${SMOKE_PREFIX}APP_BASE_URL=http://127.0.0.1:3000 node dist/server/scripts/smoke-test.js"',
    'docker ps --filter "name=$CONTAINER_NAME" --format \'container={{.Names}} image={{.Image}} status={{.Status}} ports={{.Ports}}\'',
    "",
    'echo "health=$(cat /tmp/gestor-health.json)"',
    'echo "ready=$(cat /tmp/gestor-ready.json)"',
    "deploy_failed=0",
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
    branch: process.env.JMU_BRANCH || "main",
    healthUrl: process.env.JMU_HEALTH_URL || "http://127.0.0.1:3000/api/health",
    readyUrl: process.env.JMU_READY_URL || "http://127.0.0.1:3000/api/ready",
    smokeEmail: process.env.JMU_SMOKE_TEST_EMAIL || "",
    smokePassword: process.env.JMU_SMOKE_TEST_PASSWORD || "",
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

            reject(new Error(`Deploy remoto falhou com codigo ${code}.`));
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
