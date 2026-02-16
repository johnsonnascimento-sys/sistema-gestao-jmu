# Fase 3-A - Central de Ingestao Web (Planalto)

Data: 2026-02-16
Status: concluida (pipeline web operacional)

## Objetivo
Implementar a primeira porta de entrada da Fase 3:
- URL de legislacao federal (Planalto) -> parse HTML -> chunk por artigo -> embedding -> Supabase.

## Entregas realizadas

### 1) N8N - Workflow Web dedicado
- Workflow: `JMU_Indexador_Web_RAG_Supabase (FASE3-A-ATIVO)`
- ID: `OTp1ykZvIPLmk8HE`
- Export versionado: `docs/n8n/JMU_Indexador_Web_RAG_Supabase.json`
- Endpoint final de producao: `POST /webhook/index-norma-web-v3`

Fluxo interno:
1. `Webhook (Recebe URL)`  
2. `Preparar URL e Norma ID`  
3. `Buscar HTML (Planalto)`  
4. `Merge (URL + HTML)`  
5. `Parse HTML + Chunk por Artigo`  
   - remove `script/style/noscript`
   - remove `<strike>` e `<s>`
   - strip de tags HTML
   - chunk semantico por `Art.`
6. `Gemini (Embeddings Web)` (`gemini-embedding-001`, 768)
7. `Merge (Dados + Embedding Web)`
8. `Supabase (Normas Web) - Insert`
9. `Supabase (Log Web) - Insert`

Correcoes tecnicas no workflow:
- parser com fallback para resposta HTML expandida por caracteres (merge com chaves numericas);
- body JSON do node de embeddings corrigido com `JSON.stringify(...)`.

### 2) Appsmith - Pagina de ingestao
- Pagina criada e publicada: `Upload_Normas`
- `pageId`: `699334508a3a0012fc7c5f16`
- Link:
  - `https://app.johnsontn.com.br/app/jmu-gestao-inteligente/upload-normas-699334508a3a0012fc7c5f16`

Widgets:
- `Btn_Tab_PDF` e `Btn_Tab_WEB` (estrutura de abas por store `UPLOAD_TAB`)
- Aba Web funcional:
  - `Input_Web_URL`
  - `Input_Web_NormaId` (opcional)
  - `Btn_Enviar_Web` (dispara action REST)
- Aba PDF: placeholder para Fase 3-B

Action:
- `IngerirNormaWeb` (REST)
- URL a usar: `POST https://n8n.johnsontn.com.br/webhook/index-norma-web-v3`
- Body: `{ url, norma_id }`

## Validacao final
1. Chamada webhook:
```bash
curl -X POST https://n8n.johnsontn.com.br/webhook/index-norma-web-v3 \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm\",\"norma_id\":\"LEI-8112-WEB-QA\"}"
```
Resposta esperada:
```json
{"message":"Workflow was started"}
```

2. Resultado no Supabase:
```sql
select norma_id, count(*) as chunks, min(vector_dims(embedding)) as min_dims, max(vector_dims(embedding)) as max_dims
from adminlog.normas_index
where norma_id = 'LEI-8112-WEB-QA'
group by norma_id;
```
Resultado validado:
- `norma_id`: `LEI-8112-WEB-QA`
- `chunks`: `34`
- `min_dims`: `768`
- `max_dims`: `768`

## Proxima etapa
- Fase 3-B: pipeline PDF (upload binario no Appsmith, armazenamento no Drive, OCR/loader, chunking e indexacao no Supabase).
