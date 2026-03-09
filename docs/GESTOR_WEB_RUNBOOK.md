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

O script executa `git pull`, rebuild da imagem Docker, recriacao do container, validacao de `GET /api/health`, `GET /api/ready` e `smoke-test`, com rollback automatico para a imagem anterior se a validacao falhar.

## Rollback
1. Repor a imagem ou commit anterior.
2. Recriar o container com a versao anterior.
3. Validar `GET /api/health` e `npm run smoke:test`.

## Rotacao de segredos
- Rotacionar `DATABASE_URL` no Supabase e atualizar o `.env`.
- Rotacionar `SESSION_SECRET` em cada incidente de exposicao.
- Rotacionar credenciais administrativas temporarias apos bootstrap.

## Backup e restore
- Manter snapshot/export regular do schema `adminlog`.
- Validar restore em ambiente separado antes de incidentes reais.
- Confirmar que `adminlog.schema_migration`, `adminlog.app_user` e `adminlog.admin_user_audit` foram restaurados.

## Investigacao de incidente
1. Verificar `GET /api/health` e `GET /api/ready`.
2. Inspecionar logs do processo/container por `reqId`, `userId` e `preId`.
3. Se o incidente envolver acessos, consultar `GET /api/admin/users/auditoria`.
4. Confirmar conectividade com o banco.
5. Executar `npm run smoke:test`.
