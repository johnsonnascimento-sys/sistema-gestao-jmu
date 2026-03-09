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

### Deploy automatizado da VPS
Use `npm run deploy:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_CONTAINER_NAME`, `JMU_CONTAINER_BIND`, `JMU_BRANCH`
- opcionais para smoke autenticado: `JMU_SMOKE_TEST_EMAIL`, `JMU_SMOKE_TEST_PASSWORD`
- opcionais para exigir smoke autenticado: `JMU_SMOKE_TEST_REQUIRE_AUTH=true`
- opcionais para smoke administrativo: `JMU_SMOKE_TEST_ADMIN_EMAIL`, `JMU_SMOKE_TEST_ADMIN_PASSWORD`
- opcionais para exigir smoke administrativo: `JMU_SMOKE_TEST_REQUIRE_ADMIN=true`

O script executa `git pull`, rebuild da imagem Docker, recriacao do container, validacao de `GET /api/health`, `GET /api/ready` e `smoke-test`, com rollback automatico para a imagem anterior se a validacao falhar. Cada release passa a ser tagueada como `gestor-jmu-web:commit-<sha>`, o que permite rollback explicito sem rebuild. Quando `SMOKE_TEST_REQUIRE_AUTH=true`, o deploy falha se nao houver credenciais de smoke configuradas.

### Inspecao rapida da VPS
Use `npm run status:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_CONTAINER_NAME`, `JMU_HEALTH_URL`, `JMU_READY_URL`

O comando mostra branch, commit actual, estado do checkout remoto, container activo, health/readiness e as ultimas tags de imagem disponiveis para rollback.
Tambem mostra se o smoke autenticado e o smoke administrativo estao exigidos e configurados na `.env` remota, sem expor os segredos.

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
- Rotacionar `DATABASE_URL` no Supabase e atualizar o `.env`.
- Rotacionar `SESSION_SECRET` em cada incidente de exposicao.
- Rotacionar credenciais administrativas temporarias apos bootstrap.

## Backup e restore
### Backup remoto
Use `npm run backup:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_BACKUP_DIR`, `JMU_DATABASE_SCHEMA`, `JMU_PG_IMAGE`
- opcionais: `JMU_BACKUP_LABEL` para identificar o dump
- opcionais: `JMU_BACKUP_KEEP_LATEST` para retenção automática no diretório remoto

O script lê a `DATABASE_URL` da `.env` remota, gera `pg_dump` comprimido do schema `adminlog` usando a imagem oficial do Postgres, valida o gzip e mostra checksum/arquivos recentes.

### Restore remoto
Use `npm run restore:vps` com:

- `JMU_SSH_HOST`
- `JMU_SSH_USER`
- `JMU_SSH_PASSWORD` ou `JMU_SSH_KEY_PATH`
- `JMU_RESTORE_CONFIRM=ERASE_ADMINLOG`
- `JMU_RESTORE_FILE=<arquivo>` ou `JMU_RESTORE_LATEST=true`
- opcionais: `JMU_REMOTE_APP_DIR`, `JMU_BACKUP_DIR`, `JMU_DATABASE_SCHEMA`, `JMU_PG_IMAGE`
- opcionais para smoke autenticado: `JMU_SMOKE_TEST_EMAIL`, `JMU_SMOKE_TEST_PASSWORD`
- opcionais para exigir smoke autenticado: `JMU_SMOKE_TEST_REQUIRE_AUTH=true`
- opcionais para smoke administrativo: `JMU_SMOKE_TEST_ADMIN_EMAIL`, `JMU_SMOKE_TEST_ADMIN_PASSWORD`
- opcionais para exigir smoke administrativo: `JMU_SMOKE_TEST_REQUIRE_ADMIN=true`

O restore cria antes um dump de seguranca `pre-restore`, para o container actual, restaura o schema `adminlog`, reaplica `db:migrate` dentro do container e executa `health`, `ready` e `smoke-test`.

### Checklist pos-restore
1. Confirmar `GET /api/health` e `GET /api/ready`.
2. Executar `npm run smoke:test` ou validar o smoke automatico do `restore:vps`.
3. Confirmar que `adminlog.schema_migration`, `adminlog.app_user`, `adminlog.admin_user_audit`, `adminlog.pre_demanda`, `adminlog.pre_to_sei_link` e `adminlog.pre_demanda_status_audit` foram restaurados.
4. Validar login admin, listagem de pre-demandas e tela de operacoes.
5. Registar o arquivo usado no restore e manter o dump `pre-restore` ate o encerramento do incidente.

## Investigacao de incidente
1. Verificar `GET /api/health` e `GET /api/ready`.
2. Inspecionar logs do processo/container por `reqId`, `userId` e `preId`.
3. Se o incidente envolver acessos, consultar `GET /api/admin/users/auditoria`.
4. Confirmar conectividade com o banco.
5. Executar `npm run smoke:test`.
