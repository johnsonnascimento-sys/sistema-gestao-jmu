# SESSION LOG - 2026-05-05

## Exclusao segura definitiva de demanda/processo

**O Que:** Implementada ferramenta de exclusao definitiva de pre-demanda/processo restrita a administradores.

**Identificadores:** Permissao `pre_demanda.delete`; migration `sql/migrations/027_pre_demanda_delete_audit.sql`; tabela `adminlog.pre_demanda_delete_audit`; rotas `GET /api/pre-demandas/:preId/exclusao-preview` e `DELETE /api/pre-demandas/:preId`.

**Validacao:** `npm run build:server`, `npm run build:client`, `npx vitest run server/src/app.test.ts`, `npx vitest run client/src/pages/pre-demanda-detail-page.test.tsx` e `npm test` executados com sucesso.

**Seguranca:** A exclusao exige motivo e confirmacao digitada com o `pre_id`; antes do apagamento fisico, grava auditoria permanente sem FK para a demanda apagada.

## Deploy VPS

**O Que:** Publicado o commit `1b37778` em `main` e executado deploy produtivo via `npm run deploy:vps`.

**Validacao:** Deploy concluiu com `health ok`, `ready ok`, smoke autenticado admin OK e container `gestor-jmu-web` healthy.
