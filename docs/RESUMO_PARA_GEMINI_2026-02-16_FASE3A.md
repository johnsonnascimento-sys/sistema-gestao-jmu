# Resumo para Gemini (atualizado em 2026-02-16 - Fase 3-A concluida)

Voce e um engenheiro full-stack. Preciso que voce assuma a continuidade do projeto na Fase 3-B sem quebrar producao.

## Fonte da verdade (leia primeiro)
- `AI_BOOTLOADER.md`
- `PROJECT_HANDOVER.md`
- `ARCHITECTURE.md` (secao 6 - RAG)
- `docs/FASE3_INGESTAO_WEB.md`
- `docs/SESSION_LOG_2026-02-16_FASE3A.md`
- `docs/MANUAL_USUARIO_JMU_GESTAO_INTELIGENTE.md`

## Estado atual do projeto
- Fase 0 (Supabase RAG): concluida
  - `vector` habilitado
  - tabelas `adminlog.normas_index` e `adminlog.ai_generation_log`
- Fase 1 (N8N -> Supabase): concluida
  - workflow atomico gravando chunks + embeddings
- Fase 2 (Appsmith busca): concluida
  - pagina `Busca_Normas` com busca hibrida (semantica + lexical), cache client-side e fallback no-billing
  - tabela com contexto de origem: `norma_id`, `artigo`, `tipo` (lexical/semantic/both)
  - botao `Limpar Busca` para resetar consulta e resultados
- Fase 3-A (Ingestao Web/Planalto): concluida e validada E2E
  - workflow n8n ativo: `JMU_Indexador_Web_RAG_Supabase (FASE3-A-ATIVO)` ID `OTp1ykZvIPLmk8HE`
  - endpoint de producao funcional: `POST /webhook/index-norma-web-v3`
  - `Upload_Normas` (aba web) funcional via action `IngerirNormaWeb` ligada ao datasource `N8N Webhooks`
  - teste QA inseriu `LEI-8112-WEB-QA` com 34 chunks e embeddings `768` no Supabase
  - reindex oficial `LEI_8112_1990`: 269 chunks, 14 ocorrencias de "férias", sem caracteres `�`

## Detalhes tecnicos importantes (Fase 3-A)
- Parser HTML no n8n remove:
  - `<script>`, `<style>`, `<noscript>`, `<strike>`, `<s>`
- Chunking:
  - por `Art.` com fallback por tamanho
- Charset/encoding:
  - download HTML em binario no n8n
  - parse com heuristica (`utf8`/`latin1`/`windows-1252`) para evitar perda de acentuacao
- Embeddings:
  - modelo `gemini-embedding-001`
  - body JSON corrigido com `JSON.stringify(...)` para evitar erro de JSON invalido
- Logs:
  - auditoria gravada em `adminlog.ai_generation_log`

## Appsmith (Ingestao)
- Pagina `Upload_Normas` criada:
  - URL: `https://app.johnsontn.com.br/app/jmu-gestao-inteligente/upload-normas-699334508a3a0012fc7c5f16`
- Aba Web:
  - `Input_Web_URL`, `Input_Web_NormaId`, botao `Btn_Enviar_Web`
- Aba PDF:
  - placeholder para Fase 3-B
- Action REST:
  - `IngerirNormaWeb` aponta para `.../webhook/index-norma-web-v3`
  - datasource obrigatorio: `N8N Webhooks` (nao usar `DEFAULT_REST_DATASOURCE`)

## Missao agora (Fase 3-B: Upload PDF)
1. Criar webhook PDF no n8n para receber arquivo binario + metadados (`norma_id`, `assunto`).
2. Salvar PDF original no Google Drive (pasta `00_JMU_Normas_Originais`, ID `1QEZGPtlmg2ladDSyFdv7S7foNSpgiaqk`).
3. Extrair texto (OCR/loader), chunking e embeddings 768.
4. Inserir em `adminlog.normas_index` e log em `adminlog.ai_generation_log`.
5. Integrar com aba PDF da pagina `Upload_Normas`.
6. Entregar checklist de QA rapido (upload, indexacao, busca posterior no Appsmith).
7. Garantir que metadata do chunk inclua `norma_id`, `source_url` ou `drive_file_id` para rastreabilidade na UI.

## Regras
- Nao incluir segredos em arquivo/commit.
- Preservar producao atual (`index-norma`, `index-norma-web-v3` e `Busca_Normas`).
- Preferir scripts/documentacao idempotentes.
