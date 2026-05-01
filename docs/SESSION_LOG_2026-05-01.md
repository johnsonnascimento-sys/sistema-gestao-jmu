# SESSION LOG - 2026-05-01

## O que
- Implementada a feature `Processos em lote` para criar uma pre-demanda por assunto confirmado.
- Adicionado cadastro de pacotes reutilizaveis de assuntos em `pre_demanda_pacotes` e `pre_demanda_pacote_assuntos`.
- Criadas rotas para listar, criar e editar pacotes, alem de `POST /api/pre-demandas/lote`.
- Criada UI para selecionar/criar pessoa, escolher pacote, revisar/remover assuntos, preencher prazo unico e acompanhar o resultado com links dos processos.
- Criada UI simples para cadastrar pacotes a partir dos assuntos existentes.
- Mantida a geracao automatica de tarefas pelo fluxo existente de procedimentos por assunto.
- Vinculados entre si os processos criados no mesmo lote via `demanda_vinculos`.

## Identificadores
- Data do registro: `2026-05-01`
- Escopo: processos em lote por pacotes reutilizaveis de assuntos
- Migration: `sql/migrations/026_pre_demanda_pacotes.sql`
- Rotas novas: `GET /api/pre-demandas/pacotes`, `POST /api/pre-demandas/pacotes`, `PATCH /api/pre-demandas/pacotes/:id`, `POST /api/pre-demandas/lote`
- Telas novas: `/processos-lote`, `/pacotes-processos`

## Validacao
- `npm run build:server`
- `npm run build:client`
- `npm exec vitest -- run server/src/app.test.ts` com `17 passed`

## Seguranca
- Permissao de uso do lote: `pre_demanda.create`.
- Permissao de manutencao de pacotes: `cadastro.assunto.write`.
- Nenhum segredo foi registrado.
