const { Client } = require('ssh2');
const fs = require('fs');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Env var obrigatoria ausente: ${name}`);
    process.exit(2);
  }
  return v;
}

// Autenticacao SSH:
// - Preferir SSH agent (SSH_AUTH_SOCK) ou chave via JMU_SSH_KEY_PATH.
// - Se precisar usar senha, informe via JMU_SSH_PASSWORD (nao versionar).
const host = requireEnv('JMU_SSH_HOST');
const username = process.env.JMU_SSH_USER || 'root';
const port = Number(process.env.JMU_SSH_PORT || '22');

const keyPath = process.env.JMU_SSH_KEY_PATH;
const password = process.env.JMU_SSH_PASSWORD;

const config = {
  host,
  port,
  username,
  ...(process.env.SSH_AUTH_SOCK ? { agent: process.env.SSH_AUTH_SOCK } : {}),
  ...(keyPath ? { privateKey: fs.readFileSync(keyPath, 'utf8') } : {}),
  ...(password ? { password } : {}),
};

const workflows = [
  'nwV77ktZrCIawXYr', // JMU - PreSEI Criar
  'clRfeCOLYAWBN3Qs', // JMU - PreSEI Associar
  'nfBKnnBjON6oU1NT', // JMU - Bootstrap Adminlog
];

const conn = new Client();

console.log(`Connecting to VPS ${host}:${port} as ${username}...`);

conn
  .on('ready', () => {
    console.log('Client :: ready');

    conn.exec('docker ps --format \"{{.Names}}\" | grep -E \"^n8n\" || true', (err, stream) => {
      if (err) throw err;
      let containerName = '';

      stream
        .on('data', (data) => {
          containerName += data.toString();
        })
        .on('close', () => {
          containerName = containerName.trim();
          if (!containerName) {
            console.error('Could not find running N8N container.');
            conn.end();
            return;
          }

          containerName = containerName.split('\n')[0].trim();
          console.log(`Found N8N container: ${containerName}`);

          activateNext(0, containerName);
        });
    });

    function activateNext(index, containerName) {
      if (index >= workflows.length) {
        console.log('All workflows processed.');
        conn.end();
        return;
      }

      const id = workflows[index];
      const cmd = `docker exec ${containerName} n8n update:workflow --active=true --id=${id}`;

      console.log(`Activating workflow ${id}...`);
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream
          .on('close', (code) => {
            console.log(`Workflow ${id} activation exited with code ${code}`);
            activateNext(index + 1, containerName);
          })
          .on('data', (data) => console.log('STDOUT: ' + data))
          .stderr.on('data', (data) => console.log('STDERR: ' + data));
      });
    }
  })
  .on('error', (err) => console.error('Connection Error:', err))
  .connect(config);
