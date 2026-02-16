# Resumo para Gemini (atualizado em 2026-02-16)

Voce e um engenheiro full-stack. Preciso que voce entenda o estado atual do repo e me ajude a continuar a Fase 2 (Appsmith) sem quebrar producao e sem exigir Google Cloud Billing.

## Fonte da verdade (leia primeiro)
- `AI_BOOTLOADER.md`
- `PROJECT_HANDOVER.md`
- `ARCHITECTURE.md` (secao RAG)
- `docs/FASE2_APPSMITH_BUSCA_RAG.md`
- `docs/SESSION_LOG_2026-02-15.md`
- `docs/MANUAL_USUARIO_JMU_GESTAO_INTELIGENTE.md`

## Status do projeto
- Fase 0 (Supabase RAG): concluida
  - extensao `vector`
  - tabelas `adminlog.normas_index` e `adminlog.ai_generation_log`
  - scripts: `sql/setup_rag_v1.sql`, `sql/adminlog_rag_schema.sql`
- Fase 1 (N8N -> Supabase): concluida
  - workflow: `docs/n8n/JMU_Indexador_Atomico_RAG_Supabase.json`
  - persistencia por chunk em `adminlog.normas_index` + auditoria em `adminlog.ai_generation_log`
  - fix aplicado: usar `Merge` para evitar "amnesia HTTP"
- Fase 2 (Appsmith - busca): estabilizada (versao 1 do painel)
  - app: `JMU_Gestao_Inteligente`
  - page: `Busca_Normas`

## Appsmith (IDs)
- `applicationId`: `6992325c8a3a0012fc7c5ed5`
- `pageId`: `6992325c8a3a0012fc7c5ed7`
- `layoutId`: `6992325c8a3a0012fc7c5ed6`
- URL (view): `https://app.johnsontn.com.br/app/jmu-gestao-inteligente/busca-normas-6992325c8a3a0012fc7c5ed7`

## Supabase (RPC)
- Semantica: `match_documents(query_embedding vector(768), match_threshold float, match_count int)`
- Lexical fallback (no-billing): `match_documents_lexical(query_text text, match_count int)`

## Gemini embeddings (decisao)
- A API key do Google AI Studio nao suportou `models/text-embedding-004:embedContent` no endpoint `v1beta`.
- Modelo valido via `ListModels`: `models/gemini-embedding-001` com `embedContent`.
- Usar `outputDimensionality: 768` para compatibilidade com `vector(768)`.

## Appsmith (Actions)
- `GerarEmbedding2` (REST):
  - `POST /v1beta/models/gemini-embedding-001:embedContent`
  - header `x-goog-api-key` e dinamico via `{{this.params.key}}` (nao fica hardcoded no datasource)
- `BuscarNormas` (Postgres):
  - chama `match_documents(...)`
  - recebe o vetor via `BuscarNormas.run({ vector: "[...]" })` e le via `this.params.vector`
- `BuscarNormasFTS` (Postgres):
  - chama `match_documents_lexical(...)`
  - aceita `this.params.text` e tem fallback para `Input_Busca.text` (quando rodar "Run" manual no editor)

## Appsmith (UI / comportamento)
- A pagina sempre faz busca lexical (FTS) e, se houver `GEMINI_API_KEY`, tenta busca semantica em paralelo.
- Resultados sao mesclados (dedup por `id`) e gravados em `appsmith.store.SEARCH_RESULTS`.
- Cada resultado recebe `origin` (`lexical`, `semantic` ou `both`) para explicar por que apareceu.
- Embeddings usam cache local (client-side) por termo normalizado (hash) para economizar quota/limites do Gemini.
- A tabela (`Table_Resultados`) renderiza somente `SEARCH_RESULTS` (evita estado antigo/stale).
- API key e salva no browser via `appsmith.store.GEMINI_API_KEY` e pode ser apagada pelo botao `Apagar Key`.
- Quota mostrada na tela e apenas estimativa local (contadores no store).

## Fix critico (resolvido)
- `GerarEmbedding2` estava sendo executada no carregamento da pagina e falhava com "The text content is empty".
- Fix: remover referencias diretas a `GerarEmbedding2.data/error` no DSL e passar dados por store/parametros.
- Resultado: `layoutOnLoadActions` vazio e `GerarEmbedding2` com `runBehaviour=MANUAL` (nao roda ao abrir).

## O que eu quero de voce (Gemini)
1. Revisar o desenho da busca hibrida e sugerir melhorias sem exigir billing (ex: ranking, thresholds, UI, cache local).
2. Sugerir um checklist de testes (Appsmith + Supabase) e como validar rapidamente ingestao + busca.
3. Sugerir hardening de seguranca (rotacao de segredos, onde armazenar, como evitar vazamento em exports/logs).

Regras:
- NAO inclua segredos (API keys, senhas) em nenhum arquivo.
- Prefira mudancas documentadas e scripts idempotentes.
