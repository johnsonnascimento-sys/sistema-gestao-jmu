# Session Log - 2026-02-16

## Contexto
Polir a Fase 2 do Appsmith para reduzir custo e melhorar UX sem exigir Google Cloud Billing.

## Cache local
- Embeddings passaram a usar cache no `appsmith.store` por termo normalizado.
- A fila de cache foi limitada para evitar crescimento sem controle.

## Origem do resultado
- Cada linha recebeu `origin`: `lexical`, `semantic` ou `both`.
- A tabela ganhou coluna `Tipo` para mostrar a origem.

## Robustez
- `IS_SEARCHING` passou a controlar o estado de busca.
- `LAST_ERROR` continua alimentando o debug da tela publicada.
- Sem `GEMINI_API_KEY`, a busca lexical segue funcionando.

## Script
- `scripts/appsmith_phase2_cache_vectors_and_origin.js` aplicou a mudanca.
- O script faz backup local, atualiza a pagina `Busca_Normas` e publica o app.

## Docs
- `docs/FASE2_APPSMITH_BUSCA_RAG.md`
- `docs/MANUAL_USUARIO_JMU_GESTAO_INTELIGENTE.md`
- `docs/RESUMO_PARA_GEMINI_2026-02-15.md`
