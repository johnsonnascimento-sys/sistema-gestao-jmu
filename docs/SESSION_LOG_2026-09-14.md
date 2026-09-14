# Session Log - 14/09/2026

## Correcao de idempotencia na criacao de demandas com SEI

### O que
- Corrigida a regra que tratava como duplicadas duas demandas com o mesmo solicitante, assunto e data, mesmo quando seus numeros SEI eram diferentes.
- A chave passa a incluir o SEI inicial normalizado quando ele e informado; demandas criadas sem SEI preservam a regra anterior.
- A migration `032_pre_demanda_idempotencia_sei.sql` adiciona e preenche a identidade do SEI inicial e recria atomicamente o indice `uq_pre_demanda_idempotencia`.
- O backfill preserva `updated_at`, evitando alterar artificialmente os indicadores de envelhecimento da fila.

### Identificadores
- Caso observado: `DEMANDA-0377-2026`, SEI `019326/26-00.101`.
- Novo SEI que deve poder coexistir na mesma chave-base: `018976/26-00.101`.
- Coluna: `adminlog.pre_demanda.idempotencia_sei_norm`.
- Migration: `032_pre_demanda_idempotencia_sei.sql`.

### Validacao
- `npm run build`: aprovado.
- `npm test`: 20 arquivos e 76 testes aprovados.
- Preflight produtivo: 1.752 demandas, tabela com 2.680 kB e nenhuma colisao na nova chave composta.
- Backup anterior ao deploy: `gestor-adminlog-20260914T213033Z-pre-idempotencia-20260914.sql.gz`, 1,1 MB, SHA-256 `52e06f2f17c742525bcaf43e56ebeee61d5858779bc460c10882c7cbb887e857`.
- Restore drill do backup: aprovado.
- Migration e smoke test produtivo: a preencher apos o deploy.

### Seguranca
- Nenhuma senha, chave privada ou segredo foi registrado neste documento.
