# SESSION LOG - 2026-03-26

## O que
- Confirmada a ausencia de uso de Appsmith, n8n e RAG no runtime atual do Gestor Web.
- Removidos do repositorio os artefatos legados de MCP, Appsmith, n8n e documentacao operacional antiga associada a esse stack.
- Removidos os scripts `appsmith_*`, os wrappers e configuracoes MCP, utilitarios de n8n e documentacao de fases RAG/Appsmith.
- Atualizados `AI_BOOTLOADER.md`, `PROJECT_HANDOVER.md`, `ARCHITECTURE.md`, `AGENT_RULES`, `agents.toml`, `boot.ps1`, `boot.sh`, `scripts/README.md`, `docs/GESTOR_WEB_V1.md` e `docs/GESTOR_WEB_RUNBOOK.md` para refletir o estado atual do sistema.

## Identificadores
- Data do registro: `2026-03-26`
- Escopo: limpeza de projeto/runtime
- Objetos legados mantidos no banco:
  - `adminlog.normas_index`
  - `adminlog.ai_generation_log`
  - `match_documents*`
  - extensao `vector`

## Validacao
- O runtime atual do Gestor Web continua descrito como React + Vite + Fastify + PostgreSQL.
- O repositorio deixou de carregar MCP, Appsmith e n8n como partes ativas da arquitetura.
- A documentacao-mestra passou a declarar explicitamente que RAG, Appsmith e n8n estao fora do runtime atual.
- Os objetos legados de banco foram mantidos e documentados como fora do escopo operacional corrente.

## Seguranca
- Nenhum segredo foi registrado.
- Nenhuma credencial foi copiada para a documentacao.
