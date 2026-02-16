# Session Log - 2026-02-16

## Contexto
Objetivo do dia: polir a Fase 2 (Appsmith) para melhorar UX e reduzir custo/limite de API (sem exigir Google Cloud Billing).

## 1) Appsmith - Cache de Vetores (client-side)
- Implementado cache local de embeddings no `appsmith.store`:
  - Chave: `CACHE_VEC_<hash>` (hash do termo normalizado, para evitar keys enormes)
  - Valor: string no formato `[...]` com 768 floats (compativel com `vector(768)` no Supabase)
- Cache e limitado por uma lista `CACHE_VEC_KEYS` (max 30 entradas). Ao exceder, as mais antigas sao limpas.

Motivo: evitar chamar o Gemini repetidamente para o mesmo termo (economia de quota/RPM).

## 2) Appsmith - Origem do Resultado (explicabilidade)
- Cada linha retornada pela busca recebe `origin`:
  - `lexical` (FTS)
  - `semantic` (embedding + pgvector)
  - `both` (apareceu nos 2)
- A tabela ganhou uma coluna `Tipo` (icone) para indicar a origem.

## 3) Appsmith - Loading/Robustez
- Store `IS_SEARCHING` adicionado para controlar estado de busca e evitar duplo clique.
- `LAST_ERROR` continua sendo preenchido em falhas (para debug na tela publicada).
- Mantido o comportamento "no billing":
  - Sem `GEMINI_API_KEY`: roda apenas `BuscarNormasFTS` e ainda retorna resultados.

## 4) Mudanca aplicada via script (sem clicar na UI)
- Script: `scripts/appsmith_phase2_cache_vectors_and_origin.js`
  - Faz backup local antes de alterar: `tmp/appsmith/backups/`
  - Atualiza DSL da pagina `Busca_Normas`
  - Publica o app (deploy) ao final

## 5) Docs atualizadas
- `docs/FASE2_APPSMITH_BUSCA_RAG.md` (cache + origin + script)
- `docs/MANUAL_USUARIO_JMU_GESTAO_INTELIGENTE.md` (campo Tipo + cache)
- `docs/RESUMO_PARA_GEMINI_2026-02-15.md` (cache + origin)

