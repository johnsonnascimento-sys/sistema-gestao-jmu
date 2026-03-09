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

function getConnectionConfig() {
  const host = getRequiredEnv("JMU_SSH_HOST");
  const username = process.env.JMU_SSH_USER || "root";
  const port = Number(process.env.JMU_SSH_PORT || "22");
  const password = process.env.JMU_SSH_PASSWORD;
  const keyPath = process.env.JMU_SSH_KEY_PATH;

  if (!password && !keyPath && !process.env.SSH_AUTH_SOCK) {
    throw new Error("Informe JMU_SSH_PASSWORD, JMU_SSH_KEY_PATH ou SSH_AUTH_SOCK.");
  }

  return {
    host,
    port,
    username,
    ...(process.env.SSH_AUTH_SOCK ? { agent: process.env.SSH_AUTH_SOCK } : {}),
    ...(keyPath ? { privateKey: fs.readFileSync(keyPath, "utf8") } : {}),
    ...(password ? { password } : {}),
  };
}

async function runRemoteBash(script) {
  const payload = toBase64(script);
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

            reject(new Error(`Execucao remota falhou com codigo ${code}.`));
          });
        });
      })
      .on("error", reject)
      .connect(getConnectionConfig());
  });
}

module.exports = {
  getRequiredEnv,
  runRemoteBash,
};
