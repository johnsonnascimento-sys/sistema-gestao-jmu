# Gestor Web JMU - Runbook Operacional

## Bootstrap
1. Copiar `.env.example` para `.env`.
2. Configurar `DATABASE_URL`, `SESSION_SECRET`, `CLIENT_ORIGIN` e `APP_BASE_URL`.
3. Executar `npm install`.
4. Executar `npm run db:migrate`.
5. Criar o primeiro administrador com `npm run db:create-user -- --email=... --name="..." --password=... --role=admin`.

## Deploy
1. Atualizar o codigo com `git pull --ff-only`.
2. Executar `npm install`.
3. Executar `npm run build`.
4. Executar `npm run db:migrate`.
5. Subir ou reciclar o container/processo.
6. Executar `npm run smoke:test`.

## Escopo operacional atual
- O runbook cobre apenas o Gestor Web proprio.
- Appsmith, n8n e RAG nao fazem parte do runtime atual.
- Os scripts operacionais usam PostgreSQL padrao e nao dependem de `pgvector`.
- O banco primario do ambiente produtivo esta na propria VPS.
- O container do banco e `gestor-jmu-db`, na rede `gestor-jmu-net`.

### Deploy automatizado da VPS
Use `npm run deploy:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_CONTAINER_NAME`, `JMU_CONTAINER_BIND`, `JMU_BRANCH`
- opcionais: `JMU_DOCKER_NETWORK` para a rede Docker do app e do banco
- opcionais para smoke autenticado: `JMU_SMOKE_TEST_EMAIL`, `JMU_SMOKE_TEST_PASSWORD`
- opcionais para exigir smoke autenticado: `JMU_SMOKE_TEST_REQUIRE_AUTH=true`
- opcionais para smoke administrativo: `JMU_SMOKE_TEST_ADMIN_EMAIL`, `JMU_SMOKE_TEST_ADMIN_PASSWORD`
- opcionais para exigir smoke administrativo: `JMU_SMOKE_TEST_REQUIRE_ADMIN=true`

O script executa `git pull`, rebuild da imagem Docker, recriacao do container, validacao de `GET /api/health`, `GET /api/ready` e `smoke-test`, com rollback automatico se a validacao falhar. Cada release recebe a tag `gestor-jmu-web:commit-<sha>`. Quando `SMOKE_TEST_REQUIRE_AUTH=true`, o deploy falha se nao houver credenciais de smoke.

### Inspecao rapida da VPS
Use `npm run status:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_CONTAINER_NAME`, `JMU_HEALTH_URL`, `JMU_READY_URL`

O comando mostra branch, commit atual, estado do checkout remoto, container ativo, health/readiness e as ultimas tags de imagem disponiveis para rollback.
Tambem mostra se o smoke autenticado e o administrativo estao exigidos na `.env` remota, sem expor segredos, alem dos cron jobs `JMU_GESTOR_*`, backups visiveis e ultimos eventos operacionais.

## Rollback
Use `npm run rollback:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- `JMU_ROLLBACK_COMMIT=<sha>` para usar a imagem `gestor-jmu-web:commit-<sha>`
- ou `JMU_ROLLBACK_IMAGE=<imagem>` para apontar uma tag/imagem especifica
- opcionais para smoke autenticado: `JMU_SMOKE_TEST_EMAIL`, `JMU_SMOKE_TEST_PASSWORD`
- opcionais para exigir smoke autenticado: `JMU_SMOKE_TEST_REQUIRE_AUTH=true`
- opcionais para smoke administrativo: `JMU_SMOKE_TEST_ADMIN_EMAIL`, `JMU_SMOKE_TEST_ADMIN_PASSWORD`
- opcionais para exigir smoke administrativo: `JMU_SMOKE_TEST_REQUIRE_ADMIN=true`

O rollback recria o container com a imagem alvo, valida `GET /api/health`, `GET /api/ready` e `smoke-test`, e restaura a imagem que estava em execucao se a reversao falhar.

## Rotacao de segredos
- Rotacionar `DATABASE_URL` no provedor atual de PostgreSQL e atualizar o `.env`.
- Rotacionar `SESSION_SECRET` em cada incidente de exposicao.
- Rotacionar credenciais administrativas temporarias apos bootstrap.

## Backup e restore
### Backup remoto
Use `npm run backup:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_BACKUP_DIR`, `JMU_DATABASE_SCHEMA`, `JMU_PG_IMAGE`
- opcionais: `JMU_DOCKER_NETWORK`
- opcionais: `JMU_BACKUP_LABEL` para identificar o dump
- opcionais: `JMU_BACKUP_KEEP_LATEST` para retencao automatica no diretorio remoto

O script le a `DATABASE_URL` da `.env` remota, gera `pg_dump` comprimido do schema `adminlog` usando a imagem oficial do PostgreSQL, valida o gzip e mostra checksum/arquivos recentes.
Por omissao, os scripts operacionais usam `postgres:17`.

### Instalacao da rotina operacional
Use `npm run install:ops:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_REMOTE_LOG_DIR`
- opcionais: `JMU_BACKUP_CRON`, `JMU_MONITOR_CRON`, `JMU_RESTORE_DRILL_CRON`, `JMU_BOOTSTRAP_AUDIT_CRON`

O instalador cria quatro jobs no `crontab` remoto:

- backup diario
- monitoracao periodica com `health`, `ready` e `smoke-test`
- drill semanal de restore em container temporario
- auditoria semanal de bootstrap/governanca

### Drill manual de restore
Use `npm run drill:restore:vps` para restaurar o backup mais recente num PostgreSQL temporario e validar o schema e as tabelas essenciais, sem tocar no banco de producao.

### Auditoria manual de bootstrap
Use `npm run audit:bootstrap:vps` para verificar `.env`, variaveis obrigatorias, cron jobs instalados, volume de backups e montagem do container.

### Restore remoto
Use `npm run restore:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- `JMU_RESTORE_CONFIRM=ERASE_ADMINLOG`
- `JMU_RESTORE_FILE=<arquivo>` ou `JMU_RESTORE_LATEST=true`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_BACKUP_DIR`, `JMU_DATABASE_SCHEMA`, `JMU_PG_IMAGE`
- opcionais: `JMU_DOCKER_NETWORK`
- opcionais para smoke autenticado: `JMU_SMOKE_TEST_EMAIL`, `JMU_SMOKE_TEST_PASSWORD`
- opcionais para exigir smoke autenticado: `JMU_SMOKE_TEST_REQUIRE_AUTH=true`
- opcionais para smoke administrativo: `JMU_SMOKE_TEST_ADMIN_EMAIL`, `JMU_SMOKE_TEST_ADMIN_PASSWORD`
- opcionais para exigir smoke administrativo: `JMU_SMOKE_TEST_REQUIRE_ADMIN=true`

O restore cria antes um dump de seguranca `pre-restore`, para o container atual, restaura o schema `adminlog`, reaplica `db:migrate` dentro do container e executa `health`, `ready` e `smoke-test`.

### Estado atual do banco
- banco primario: PostgreSQL local na VPS
- container: `gestor-jmu-db`
- rede: `gestor-jmu-net`
- o Supabase nao participa mais do runtime ativo da aplicacao

### Checklist pos-restore
1. Confirmar `GET /api/health` e `GET /api/ready`.
2. Executar `npm run smoke:test` ou validar o smoke automatico do `restore:vps`.
3. Confirmar que `adminlog.schema_migration`, `adminlog.app_user`, `adminlog.admin_user_audit`, `adminlog.pre_demanda`, `adminlog.pre_to_sei_link` e `adminlog.pre_demanda_status_audit` foram restaurados.
4. Validar login admin, listagem de pre-demandas e tela de operacoes.
5. Registrar o arquivo usado no restore e manter o dump `pre-restore` ate o encerramento do incidente.

## Investigacao de incidente
1. Verificar `GET /api/health` e `GET /api/ready`.
2. Inspecionar logs do processo/container por `reqId`, `userId` e `preId`.
3. Se o incidente envolver acessos, consultar `GET /api/admin/users/auditoria`.
4. Confirmar conectividade com o banco.
5. Executar `npm run smoke:test`.
