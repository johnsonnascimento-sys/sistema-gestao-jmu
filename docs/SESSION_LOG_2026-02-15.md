# Session Log - 2026-02-15

## Contexto
Objetivo do dia: finalizar o deploy da Fase 1 (N8N -> Supabase) e iniciar a Fase 2 (Appsmith) com um painel de busca RAG.

## 1) Fase 1 (N8N -> Supabase)
- Workflow de producao: `JMU_Indexador_Atomico_RAG_Supabase` (arquivo versionado em `docs/n8n/JMU_Indexador_Atomico_RAG_Supabase.json`).
- Estrategia: manter o caminho legado (Google Sheets) e adicionar persistencia RAG no Supabase por chunk.
- Correcao critica aplicada no fluxo: "amnesia HTTP" (o node HTTP podia sobrescrever o JSON do item).
  - Solucao: usar um node `Merge` para preservar `norma_id`, `chunk_index`, `conteudo_texto`, `metadata` e juntar com `embedding.values`.

## 2) Gemini Embeddings (decisao de modelo)
- A API key do Google AI Studio nao suportou `models/text-embedding-004:embedContent` no endpoint `v1beta` (erro NOT_FOUND).
- `ListModels` mostrou suporte a `embedContent` para: `models/gemini-embedding-001`.
- Padrao adotado:
  - Modelo: `models/gemini-embedding-001`
  - Metodo: `embedContent`
  - `outputDimensionality`: `768` (compatibilidade com `vector(768)` no Supabase)

## 3) Supabase (RPC/Busca)
- Confirmado funcionamento do RPC semantico:
  - `match_documents(query_embedding vector(768), match_threshold float, match_count int)`
- Criado/ajustado fallback lexical para funcionar sem billing/sem API key:
  - `match_documents_lexical(query_text text, match_count int)`
  - Objetivo: funcionar bem em casos tipo `desercao` -> `desertor`.

## 4) Appsmith (Fase 2 - Painel de Busca)
App criado para busca RAG:
- App: `JMU_Gestao_Inteligente`
- Page: `Busca_Normas`
- Datasources:
  - `Supabase JMU` (Postgres)
  - `Gemini API` (REST)
- Actions:
  - `GerarEmbedding2` (REST): chama `/v1beta/models/gemini-embedding-001:embedContent` com `x-goog-api-key` dinamica.
  - `BuscarNormas` (DB): chama `match_documents(...)`.
  - `BuscarNormasFTS` (DB): chama `match_documents_lexical(...)`.
- UI:
  - Inputs: texto de busca + campo de API key
  - Botoes: buscar + salvar/apagar key
  - Tabela: renderiza resultados
  - Widgets de debug: status da key, quota estimada local, debug de tamanhos, ultimo erro.

### 4.1 Busca hibrida (polimento)
- Mudanca: em vez de alternar "ou semantica ou lexical", o botao `Buscar` passa a executar:
  - `BuscarNormasFTS` sempre (match exato/lexical)
  - `GerarEmbedding2` -> `BuscarNormas` quando existir API key (semantico)
- Resultados sao combinados (dedup por `id`) e gravados no `appsmith.store.SEARCH_RESULTS`.
- Motivo: garantir que termos exatos (ex: "Portaria 123") e conceitos ("militar que some") aparecam juntos.

## 5) Bugs encontrados e correcoes
- Sintoma: "Resultados (texto): N" aparecia, mas a tabela ficava vazia.
  - Causa: tabela estava bindada somente a `BuscarNormas.data` (semantica).
  - Fix: tabela passou a escolher dataset de acordo com `LAST_MODE` e/ou por "quem tem linhas" (`BuscarNormasFTS.data` vs `BuscarNormas.data`).
- Sintoma: ao usar `Run` manual em `BuscarNormasFTS`, retornava 0 registros.
  - Causa: `this.params.text` vazio ao rodar sem params.
  - Fix: query ganhou fallback para `Input_Busca.text`.
 - Sintoma: resultados semanticos antigos podiam "vazar" entre buscas (stale state).
   - Fix: a tabela passou a ler apenas `appsmith.store.SEARCH_RESULTS`, preenchido pelo botao `Buscar` a cada nova consulta.
- Sintoma: erros de actions podiam aparecer na tela publicada mesmo antes de buscar (ruido no page-load).
  - Fix: `Txt_Erro` passou a renderizar apenas apos uma tentativa de busca (quando `appsmith.store.SEARCH_QUERY` existe).
- Sintoma: `GerarEmbedding2` estava sendo executado no carregamento da pagina (on-page-load) e falhava com "The text content is empty".
  - Causa provavel: referencias a `GerarEmbedding2.data/error` em widgets/query faziam o Appsmith considerar a action como "automatic".
  - Fix: remover dependencias diretas e operar via store/parametros:
    - `Txt_DebugBusca` agora le `appsmith.store.LAST_EMBED_LEN` (nao le `GerarEmbedding2.data`).
    - `Txt_Erro` agora le `appsmith.store.LAST_ERROR` (nao le `GerarEmbedding2.error`).
    - `BuscarNormas` agora recebe o vetor via `this.params.vector` (em vez de ler `GerarEmbedding2.data` dentro do SQL).
  - Resultado: `layoutOnLoadActions` ficou vazio e `GerarEmbedding2` passou a `MANUAL` (nao roda na abertura da pagina).

## 6) Seguranca
- Houve exposicao de segredos em chat durante a fase de setup (API key / senha de DB etc).
- Acao recomendada: rotacionar credenciais apos estabilizar o deploy.
- Regra mantida no repo:
  - `MEUS_SEGREDOS.txt` e `.env*` ficam fora do git (ver `.gitignore`).

## Artefatos relevantes (repo)
- Docs Fase 2: `docs/FASE2_APPSMITH_BUSCA_RAG.md`
- Workflow N8N: `docs/n8n/JMU_Indexador_Atomico_RAG_Supabase.json`
- SQL Fase 0: `sql/setup_rag_v1.sql`, `sql/adminlog_rag_schema.sql`
- MCP Appsmith: `mcp/appsmith-mcp-server.js`, `mcp/appsmith-mcp.ps1`
