# Session Log - 2026-02-16 (Fase 3-A)

## Objetivo
Concluir a porta de ingestao Web (Planalto) da Fase 3-A com validacao E2E:
1. webhook de producao funcionando;
2. parser/chunking robusto;
3. persistencia em `adminlog.normas_index` com embeddings 768.

## Entregas

### N8N
- Workflow: `JMU_Indexador_Web_RAG_Supabase (FASE3-A-ATIVO)`
- ID: `OTp1ykZvIPLmk8HE`
- Export versionado:
  - `docs/n8n/JMU_Indexador_Web_RAG_Supabase.json`
- Endpoint operacional final:
  - `POST /webhook/index-norma-web-v3`

Pipeline implementado:
- Webhook URL -> parse/limpeza de HTML -> remocao de `<strike>` -> chunk por `Art.` -> embeddings (`gemini-embedding-001`, 768) -> inserts em `adminlog.normas_index` + `adminlog.ai_generation_log`.

### Appsmith
- Script criado e executado:
  - `scripts/appsmith_phase3_upload_page_web.js`
- Pagina criada/publicada:
  - `Upload_Normas`
  - `pageId`: `699334508a3a0012fc7c5f16`
  - URL: `https://app.johnsontn.com.br/app/jmu-gestao-inteligente/upload-normas-699334508a3a0012fc7c5f16`
- Action criada:
  - `IngerirNormaWeb` (atualizar para `https://n8n.johnsontn.com.br/webhook/index-norma-web-v3`)
- Estrutura de abas:
  - `Normas Internas (PDF)` (placeholder para Fase 3-B)
  - `Legislacao Federal (Web)` (funcional)

## Problemas encontrados e correcoes aplicadas
1. `404 webhook not registered` no endpoint web.
   - Correcao operacional: alteracao de path para `index-norma-web-v3` + reativacao do workflow.
2. Falha no parser ao combinar resposta HTML em formato expandido por caracteres (`"0":"<","1":"h"...`).
   - Correcao de codigo no node `Parse HTML + Chunk por Artigo`: reconstrucao de HTML a partir de chaves numericas.
3. Erro no node `Gemini (Embeddings Web)`: `JSON parameter needs to be valid JSON`.
   - Correcao no body JSON: uso de `JSON.stringify(...)` para texto com aspas/quebras de linha.

## Validacao final (E2E)
1. Requisicao de producao:
   - `POST https://n8n.johnsontn.com.br/webhook/index-norma-web-v3`
   - retorno: `200 {"message":"Workflow was started"}`
2. Execucao n8n:
   - execucao `109`
   - modo: `webhook`
   - status: `success`
3. Supabase:
   - `norma_id = 'LEI-8112-WEB-QA'`
   - `34` chunks inseridos em `adminlog.normas_index`
   - `vector_dims(embedding) = 768` (min/max)
   - `ai_generation_log` recebeu novo registro com `model_used = 'gemini-embedding-001'`

## Resultado final da sessao
- Fase 3-A (Pipeline Web) concluida e operacional.
- Proxima frente: Fase 3-B (Upload PDF -> Drive -> OCR/Loader -> chunking -> embedding -> Supabase).

## Atualizacoes de fechamento do dia (pos-validacao)

### 1) Appsmith - Busca_Normas com contexto juridico
- Script aplicado: `scripts/appsmith_phase2_show_norma_context.js`
- Acoes atualizadas:
  - `BuscarNormas` (semantica)
  - `BuscarNormasFTS` (lexical)
- Mudanca tecnica:
  - `JOIN adminlog.normas_index` por `id` para retornar `norma_id`, `chunk_index` e `source_url`.
- UI:
  - Tabela `Table_Resultados` passou a exibir `norma_id` e `artigo` (regex em `conteudo_texto`).

### 2) Appsmith - Upload_Normas (erro de datasource)
- Erro observado em producao: `DEFAULT_REST_DATASOURCE is not correctly configured`.
- Correcao aplicada:
  - Action `IngerirNormaWeb` vinculada ao datasource real `N8N Webhooks`.
  - Endpoint ajustado para path relativo do webhook publicado (`/webhook/index-norma-web-v3`).

### 3) n8n - Parser Planalto (acentuacao e cobertura de ocorrencias)
- Sintoma:
  - texto com caracteres corrompidos e perda de ocorrencias na busca por "ferias".
- Correcao:
  - node de download HTML em modo binario;
  - node de parse com decodificacao por heuristica de charset (`utf8`, `latin1`, `windows-1252`), escolhendo a melhor qualidade.
- Validacao no Supabase:
  - `norma_id = LEI_8112_1990` reindexada;
  - `269` chunks;
  - `14` ocorrencias de "férias";
  - `0` caracteres `�`.

### 4) UX
- Botao `Limpar Busca` ativo para limpar consulta e tabela entre testes.
- Contadores de busca mantidos para diagnostico rapido (chunks e ocorrencias).
