# Registro de Sessão — 21/09/2026

## Deploy produtivo da correção de tarefas unificadas

**O que:** Publicado na VPS Hostinger o commit `170e5db13a19b35c9a591930614ac44aaa13eaf6` (`fix: pagina tarefas unificadas por processo`). Não houve commit nem push nesta sessão, pois a `main` local já estava limpa e sincronizada com `origin/main`.

**Segurança e backup:** A chave pública SSH da VPS foi conferida pela impressão digital configurada. Antes da publicação, foi criado o backup `gestor-adminlog-20260921T160411Z-pre-deploy-170e5db.sql.gz` (SHA-256 `e354a0c8ba91a6822668e54e6a65017352632154f05e9546aecf6e17204951a3`). O deploy manteve rollback automático para a imagem anterior.

**Validação:** Build remoto concluído. O container `gestor-jmu-web` ficou saudável; `GET /api/health`, `GET /api/ready`, smoke autenticado e smoke administrativo foram aprovados. A aplicação informa o commit `170e5db13a19b35c9a591930614ac44aaa13eaf6`; a verificação de readiness confirmou banco pronto.

## Deploy produtivo da busca no histórico de andamentos

**O que:** Publicado o commit `89d4552154faf328d736dba67ef25ffa3a618743` (`feat: buscar processos por andamentos`). A busca global passou a localizar termos registrados em descrição, motivo e observações dos andamentos.

**Segurança e operação:** A identidade SSH da VPS foi validada pela impressão digital configurada. Não houve migração de banco. Duas tentativas concorrentes de publicação detectaram o conflito de nome do container e concluíram rollback automático para a imagem anterior; uma execução posterior, isolada, publicou a imagem do commit com sucesso.

**Validação:** Build remoto concluído. O container `gestor-jmu-web` ficou saudável; `GET /api/health`, `GET /api/ready`, smoke autenticado e smoke administrativo foram aprovados. A aplicação informa o commit `89d4552154faf328d736dba67ef25ffa3a618743`; a verificação de readiness confirmou banco pronto.
