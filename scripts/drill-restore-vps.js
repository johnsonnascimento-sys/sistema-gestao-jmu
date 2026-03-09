const { runRemoteBash } = require("./lib/ssh-runner");

function bashSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

async function run() {
  const remoteDir = process.env.JMU_REMOTE_APP_DIR || "/home/johnsontn-app/apps/gestor-web";

  await runRemoteBash([
    "set -euo pipefail",
    `cd ${bashSingleQuote(remoteDir)}`,
    "/bin/bash ops/restore-drill.sh",
  ].join("\n"));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
