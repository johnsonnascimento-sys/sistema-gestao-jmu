# SESSION LOG - 2026-03-26

## O que
- Confirmada a ausencia de uso de Appsmith, n8n e RAG no runtime atual do Gestor Web.
- Removidos do repositorio os artefatos legados de MCP, Appsmith, n8n e documentacao operacional antiga associada a esse stack.
- Removidos os scripts `appsmith_*`, os wrappers e configuracoes MCP, utilitarios de n8n e documentacao de fases RAG/Appsmith.
- Atualizados `AI_BOOTLOADER.md`, `PROJECT_HANDOVER.md`, `ARCHITECTURE.md`, `AGENT_RULES`, `agents.toml`, `boot.ps1`, `boot.sh`, `scripts/README.md`, `docs/GESTOR_WEB_V1.md` e `docs/GESTOR_WEB_RUNBOOK.md` para refletir o estado atual do sistema.
- Adicionada a migration `023_remove_rag_legacy.sql` para remover do banco os objetos residuais de RAG/embeddings.
- Atualizados os scripts operacionais para usar `postgres:17` por omissao.
- Removidos os SQLs legados de bootstrap de RAG do repositorio.
- Publicada a preparacao do runtime para banco local na VPS (`58f0b28`), com rede Docker dedicada e suporte a `sslmode=disable`.
- Migrado o banco primario do Gestor Web do Supabase para o PostgreSQL local da VPS, no container `gestor-jmu-db`.
- Validado o cutover com `health`, `ready`, smoke autenticado, backup remoto e drill de restore.

## Identificadores
- Data do registro: `2026-03-26`
- Escopo: limpeza de projeto/runtime e schema
- Escopo complementar: migracao do banco primario para a VPS

## Validacao
- O runtime atual do Gestor Web continua descrito como React + Vite + Fastify + PostgreSQL.
- O repositorio deixou de carregar MCP, Appsmith e n8n como partes ativas da arquitetura.
- A documentacao-mestra passou a declarar explicitamente que RAG, Appsmith e n8n estao fora do runtime atual.
- O schema versionado passou a remover os objetos legados de RAG do banco operacional.
- O runtime produtivo passou a usar `DATABASE_URL` local da VPS, com latencia de banco significativamente menor.

## Seguranca
- Nenhum segredo foi registrado.
- Nenhuma credencial foi copiada para a documentacao.
