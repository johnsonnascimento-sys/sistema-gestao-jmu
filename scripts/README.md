# Scripts (Appsmith/N8N Ops)

Este diretorio contem scripts pontuais para automatizar ajustes no Appsmith via API (login + XSRF).

## Regras
- Segredos ficam em `MEUS_SEGREDOS.txt` (gitignored). Nunca hardcode.
- Scripts sao "cirurgicos": rode apenas quando voce entende o que eles mudam.

## Estado atual (Fase 2 - Appsmith / Busca_Normas)
- Action de embeddings em uso: `GerarEmbedding2`
- Actions de busca:
  - `BuscarNormas` (semantica via RPC `match_documents`)
  - `BuscarNormasFTS` (fallback lexical via `match_documents_lexical`)

Alguns scripts antigos ainda referenciam `GerarEmbedding` (nome legado) e podem falhar se rodados sem adaptacao.

## Scripts uteis
- `scripts/appsmith_publish_app.js`: publica (deploy) o app (unpublished -> published).
- `scripts/appsmith_phase2_cache_vectors_and_origin.js`: cache client-side de vetores + coluna Tipo (origem) + backup local.
- `scripts/appsmith_replace_action_refs_in_dsl.js`: troca referencias de um nome de action para outro no DSL.
- `scripts/appsmith_delete_action.js`: remove actions antigas/teste (por id).
- `scripts/appsmith_patch_busca_normas_err_visibility.js`: reduz ruido na tela publicada (so mostra erro apos busca).
