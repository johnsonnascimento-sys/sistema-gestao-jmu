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

const dockerComposeContent = `version: "3"
services:
  appsmith:
    image: index.docker.io/appsmith/appsmith-ce
    container_name: appsmith
    ports:
      - "8081:80"
      - "9091:9090"
    volumes:
      - ./stacks:/appsmith-stacks
    restart: unless-stopped
`;

const conn = new Client();

console.log(`Connecting to VPS ${host}:${port} as ${username}...`);

conn
  .on('ready', () => {
    console.log('Client :: ready');

    conn.sftp((err, sftp) => {
      if (err) throw err;

      const remoteDir = '/home/docker/appsmith';
      const remoteFile = `${remoteDir}/docker-compose.yml`;

      conn.exec(`mkdir -p ${remoteDir}`, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
          console.log(`mkdir exited with code ${code}`);
          if (code !== 0) {
            conn.end();
            return;
          }

          console.log('Writing docker-compose.yml...');
          const writeStream = sftp.createWriteStream(remoteFile);
          writeStream.write(dockerComposeContent);
          writeStream.end();

          writeStream.on('close', () => {
            console.log('docker-compose.yml uploaded.');

            console.log('Running docker compose up -d...');
            conn.exec(`cd ${remoteDir} && docker compose up -d`, (err, stream) => {
              if (err) throw err;
              stream
                .on('close', (code) => {
                  console.log(`docker compose exited with code ${code}`);

                  conn.exec(`docker ps --filter \"name=appsmith\"`, (err, stream) => {
                    if (err) throw err;
                    console.log('--- Checking Container Status ---');
                    stream
                      .on('data', (data) => console.log('STDOUT: ' + data))
                      .stderr.on('data', (data) => console.log('STDERR: ' + data));
                    stream.on('close', () => conn.end());
                  });
                })
                .on('data', (data) => console.log('STDOUT: ' + data))
                .stderr.on('data', (data) => console.log('STDERR: ' + data));
            });
          });
        }).resume();
      });
    });
  })
  .on('error', (err) => console.error('Connection Error:', err))
  .connect(config);
