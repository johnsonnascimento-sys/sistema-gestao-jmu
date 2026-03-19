# Resumo para Gemini (atualizado em 2026-02-16)

Voce e um engenheiro full-stack. Entenda o estado atual do repo e ajude a continuar a Fase 2 (Appsmith) sem quebrar producao e sem exigir Google Cloud Billing.

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
- Busca lexical sempre roda; a semantica entra quando houver `GEMINI_API_KEY`.
- Resultados sao mesclados e gravados em `appsmith.store.SEARCH_RESULTS`.
- Cada item recebe `origin` (`lexical`, `semantic` ou `both`).
- Embeddings usam cache local por termo normalizado.
- `Table_Resultados` renderiza apenas `SEARCH_RESULTS`.
- A API key fica em `appsmith.store.GEMINI_API_KEY` e pode ser apagada.
- A quota exibida e apenas estimativa local.

## Correcao importante (resolvida)
- `GerarEmbedding2` estava sendo executada no carregamento da pagina e falhava com "The text content is empty".
- Fix: remover referencias diretas a `GerarEmbedding2.data/error` no DSL e passar dados por store/parametros.
- Resultado: `layoutOnLoadActions` vazio e `GerarEmbedding2` com `runBehaviour=MANUAL` (nao roda ao abrir).

## O que eu quero de voce (Gemini)
1. Revisar a busca hibrida e sugerir melhorias sem billing.
2. Sugerir um checklist de testes para ingestao e busca.
3. Sugerir hardening de seguranca sem expor segredos.

Regras:
- NAO inclua segredos.
- Prefira mudancas documentadas e scripts idempotentes.
