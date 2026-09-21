# Registro de Sessão — 21/09/2026

## Deploy produtivo da correção de tarefas unificadas

**O que:** Publicado na VPS Hostinger o commit `170e5db13a19b35c9a591930614ac44aaa13eaf6` (`fix: pagina tarefas unificadas por processo`). Não houve commit nem push nesta sessão, pois a `main` local já estava limpa e sincronizada com `origin/main`.

**Segurança e backup:** A chave pública SSH da VPS foi conferida pela impressão digital configurada. Antes da publicação, foi criado o backup `gestor-adminlog-20260921T160411Z-pre-deploy-170e5db.sql.gz` (SHA-256 `e354a0c8ba91a6822668e54e6a65017352632154f05e9546aecf6e17204951a3`). O deploy manteve rollback automático para a imagem anterior.

**Validação:** Build remoto concluído. O container `gestor-jmu-web` ficou saudável; `GET /api/health`, `GET /api/ready`, smoke autenticado e smoke administrativo foram aprovados. A aplicação informa o commit `170e5db13a19b35c9a591930614ac44aaa13eaf6`; a verificação de readiness confirmou banco pronto.
