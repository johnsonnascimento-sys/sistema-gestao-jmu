# Fase 2 - Busca RAG no Appsmith

Data: 2026-02-15

## Objetivo
Entregar uma tela de busca de normas com dois modos:
- busca semantica via `match_documents`
- fallback lexical via `match_documents_lexical`

## Appsmith
- App: `JMU_Gestao_Inteligente`
- Page: `Busca_Normas`
- `applicationId`: `6992325c8a3a0012fc7c5ed5`
- `pageId`: `6992325c8a3a0012fc7c5ed7`
- `layoutId`: `6992325c8a3a0012fc7c5ed6`

## Datasources
- `Supabase JMU`: Postgres/RPC
- `Gemini API`: REST em `https://generativelanguage.googleapis.com`

## RPC
- Semantica: `match_documents(query_embedding vector(768), match_threshold float, match_count int)`
- Lexical: `match_documents_lexical(query_text text, match_count int)`

## Actions
- `GerarEmbedding2`
  - `POST /v1beta/models/gemini-embedding-001:embedContent`
  - usa `x-goog-api-key: {{this.params.key}}`
  - `outputDimensionality: 768`
- `BuscarNormas`
  - chama `match_documents(...)`
  - recebe `this.params.vector`
- `BuscarNormasFTS`
  - chama `match_documents_lexical(...)`
  - aceita `this.params.text` e fallback para `Input_Busca.text`

## UI
- `Input_Busca`
- `Input_ApiKey`
- `Btn_SalvarKey`
- `Btn_LimparKey`
- `Btn_Buscar`
- `Table_Resultados`
- `Txt_KeyStatus`
- `Txt_DebugBusca`
- `Txt_Quota`
- `Txt_Erro`

## Store
- `GEMINI_API_KEY`
- `IS_SEARCHING`
- `LAST_MODE`
- `LAST_ERROR`
- `LAST_EMBED_LEN`
- `GEMINI_WINDOW_START`
- `GEMINI_WINDOW_COUNT`
- `GEMINI_TOTAL_CALLS`
- `CACHE_VEC_KEYS`
- `CACHE_VEC_<hash>`
- `SEARCH_RESULTS`
- `SEARCH_QUERY`
- `SEARCH_LEX_COUNT`
- `SEARCH_SEM_COUNT`
- `SEARCH_COMBINED_COUNT`

## Comportamento
- Sem API key: roda apenas `BuscarNormasFTS`.
- Com API key: roda FTS sempre e tenta semantica em paralelo.
- Resultados sao mesclados e deduplicados por `id`.
- Cada linha recebe `origin`: `lexical`, `semantic` ou `both`.
- A tabela renderiza `SEARCH_RESULTS`.
- A key fica apenas em `appsmith.store`.

## Observacoes
- `GerarEmbedding2` nao roda no page-load.
- `Txt_Erro` aparece apenas apos tentativa de busca.
- Se a key/senha vazou em chat ou log, trate como comprometida e rotacione.

## Script
- `scripts/appsmith_phase2_cache_vectors_and_origin.js`
- Faz backup local em `tmp/appsmith/backups/`
- Atualiza a pagina `Busca_Normas`
- Publica o app ao final
