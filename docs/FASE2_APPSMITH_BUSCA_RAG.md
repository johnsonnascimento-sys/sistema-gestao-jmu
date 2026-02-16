# Fase 2 - Painel de Busca RAG (Appsmith)

Data: 2026-02-15

## Objetivo
Entregar uma tela simples de busca de normas (RAG), com 2 modos:
1. Busca semantica (embedding + pgvector via RPC `match_documents`)
2. Fallback sem API key / sem billing: busca lexical (FTS/trigram via RPC `match_documents_lexical`)

## Appsmith (entidades)
- App: `JMU_Gestao_Inteligente`
- `applicationId`: `6992325c8a3a0012fc7c5ed5`
- Page: `Busca_Normas`
- `pageId`: `6992325c8a3a0012fc7c5ed7`
- `layoutId`: `6992325c8a3a0012fc7c5ed6`
- URL (view): `https://app.johnsontn.com.br/app/jmu-gestao-inteligente/busca-normas-6992325c8a3a0012fc7c5ed7`

## Datasources
- Postgres: `Supabase JMU`
  - Usado para chamar as funcoes RPC e ler o indice.
  - Observacao: credenciais ficam no Appsmith (nao commitar/exportar senha).
- REST: `Gemini API`
  - Base URL: `https://generativelanguage.googleapis.com`

## Supabase (funcoes/RPC)

### 1) Busca semantica
Funcao: `match_documents(query_embedding vector(768), match_threshold float, match_count int)`

Retorna: `id, conteudo_texto, similarity, metadata`.

### 2) Busca lexical (no-billing fallback)
Funcao: `match_documents_lexical(query_text text, match_count int)`

Retorna: `id, conteudo_texto, similarity, metadata`.

Motivacao: permitir resultados mesmo sem embeddings (sem API key) e melhorar casos tipo
`desercao` -> `desertor` (trigram + heuristicas).

## Appsmith (actions)

### `GerarEmbedding2` (REST)
- Endpoint: `/v1beta/models/gemini-embedding-001:embedContent`
- Header: `x-goog-api-key: {{this.params.key}}`
- Body: inclui `outputDimensionality: 768`

Observacao: com API key do Google AI Studio, o modelo `text-embedding-004` nao estava
disponivel para `embedContent`. O modelo valido listado foi `models/gemini-embedding-001`.

### `BuscarNormas` (Postgres)
Chama `match_documents(...)`.

Obs (importante): o vetor e passado como parametro do run:
- `BuscarNormas.run({ vector: "[...768 floats...]" })`
- a query le esse parametro via `this.params.vector`

### `BuscarNormasFTS` (Postgres)
Chama `match_documents_lexical(...)`.

Implementacao atual aceita:
- `this.params.text` (quando acionada pelo botao)
- fallback para `Input_Busca.text` (para o caso de usar "Run" manual na UI sem params)

## UI (widgets)
Principais widgets da pagina `Busca_Normas`:
- `Input_Busca`: texto da consulta
- `Input_ApiKey`: input da Gemini API key
- `Btn_SalvarKey`: salva key em `appsmith.store`
- `Btn_LimparKey`: apaga key do `appsmith.store`
- `Btn_Buscar`: orquestra a busca (semantica, com fallback FTS)
- `Table_Resultados`: tabela que renderiza os resultados
- `Txt_KeyStatus`: mostra se existe key no store (mascarada)
- `Txt_DebugBusca`: mostra contadores/len e qual modo foi usado
- `Txt_Quota`: quota estimada localmente (nao e quota oficial do Google)
- `Txt_Erro`: renderiza o ultimo erro da busca (store `LAST_ERROR`) na tela (para debug)

## Store keys (Appsmith)
- `GEMINI_API_KEY`: chave salva no browser/store do Appsmith
- `LAST_MODE`: `hybrid` ou `fts` (informativo; a tabela prioriza `SEARCH_RESULTS`)
- `LAST_ERROR`: ultima mensagem de erro exibida na tela (debug)
- `LAST_EMBED_LEN`: dimensao do embedding da ultima busca (debug)
- `GEMINI_WINDOW_START`, `GEMINI_WINDOW_COUNT`: janela local de RPM (estimativa)
- `GEMINI_TOTAL_CALLS`: contador total local (estimativa)

## Comportamento esperado
- Sem API key:
  - `Btn_Buscar` chama `BuscarNormasFTS`
  - `LAST_MODE` vira `fts`
  - tabela mostra `appsmith.store.SEARCH_RESULTS` (resultados textuais)
- Com API key:
  - busca hibrida:
    - dispara `BuscarNormasFTS` SEMPRE (para match exato)
    - dispara `GerarEmbedding2` -> `BuscarNormas` (semantica), se possivel
    - mescla resultados e remove duplicatas por `id` (lexico tem prioridade)
  - `LAST_MODE` vira `hybrid`
  - tabela mostra `appsmith.store.SEARCH_RESULTS` (resultado combinado)

## Debug rapido (Appsmith)
1. Editor: lateral esquerda `Queries` -> selecione a action -> `Run`
2. Veja as abas embaixo: `Response`, `Logs`, `Errors`
3. Na pagina publicada, se der erro, o widget `Txt_Erro` deve aparecer com o JSON do erro.

## Nota (on-page-load)
Fix aplicado: a pagina `Busca_Normas` nao executa `GerarEmbedding2` no carregamento (sem "run on page load").

## Busca hibrida (implementacao)
- A tabela nao le diretamente `BuscarNormas.data` / `BuscarNormasFTS.data`.
- O botao `Btn_Buscar` grava o resultado final no store:
  - `SEARCH_RESULTS` (array com linhas)
- Campos auxiliares:
  - `SEARCH_QUERY` (texto consultado)
  - `SEARCH_LEX_COUNT` / `SEARCH_SEM_COUNT` / `SEARCH_COMBINED_COUNT`

## Notas de seguranca
- Nao commitar API keys, senhas ou JSON de service account.
- A Gemini API key e armazenada apenas no `appsmith.store` (client-side).
- Se chaves/senhas vazaram em chat ou logs, trate como comprometidas e rotacione.
