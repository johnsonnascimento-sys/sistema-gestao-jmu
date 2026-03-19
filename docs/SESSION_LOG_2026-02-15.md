# Session Log - 2026-02-15

## Contexto
Fechar a Fase 1 (N8N -> Supabase) e iniciar a Fase 2 (Appsmith) com busca RAG.

## Fase 1
- Workflow: `JMU_Indexador_Atomico_RAG_Supabase`.
- Estrategia: manter o caminho legado e adicionar persistencia RAG por chunk no Supabase.
- Correcao: uso de `Merge` para evitar sobrescrita de dados pelo node HTTP.

## Gemini embeddings
- Modelo adotado: `models/gemini-embedding-001`.
- Metodo: `embedContent`.
- `outputDimensionality`: `768`.

## Supabase
- RPC semantico: `match_documents(query_embedding vector(768), match_threshold float, match_count int)`.
- Fallback lexical: `match_documents_lexical(query_text text, match_count int)`.

## Appsmith
- App: `JMU_Gestao_Inteligente`.
- Page: `Busca_Normas`.
- Actions: `GerarEmbedding2`, `BuscarNormas`, `BuscarNormasFTS`.
- Busca hibrida: lexical sempre, semantica quando houver `GEMINI_API_KEY`.
- Resultados mesclados e gravados em `appsmith.store.SEARCH_RESULTS`.
- Cache local de embeddings por termo normalizado.

## Correcoes
- `GerarEmbedding2` deixava de rodar no page-load.
- A tabela passou a ler apenas `SEARCH_RESULTS`.
- `Txt_Erro` e `Txt_DebugBusca` passaram a ler values do store.

## Seguranca
- Nao incluir segredos em arquivos.
- Preferir mudancas documentadas e scripts idempotentes.
