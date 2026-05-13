# SESSION LOG - 2026-05-13

## Cadastro de Pessoas: Pai, Mae, Endereco, RG e validacao de CPF

**O Que:** Expandido o cadastro de Pessoas/Interessados para incluir os campos `pai`, `mae`, `endereco` e `rg`. O campo `cpf` passou a ter mascara no frontend e validacao de digitos verificadores no backend, com normalizacao para armazenar apenas digitos.

**Identificadores:** Migrations `sql/migrations/028_interessados_pais_endereco.sql` e `sql/migrations/029_interessados_rg.sql`; rotas `server/src/routes/interessados.ts`; repositorio `server/src/repositories/postgres-interessado-repository.ts`; UI `client/src/pages/interessados-page.tsx`; util `client/src/lib/cpf.ts`.

**Validacao:** `npm run build:server` e `npm run build:client` executados com sucesso; `npx vitest run server/src/app.test.ts -t "supports cadastros base"` executado com sucesso.

**Seguranca:** Nenhuma credencial, token ou segredo foi exposto ou alterado.

## Exportacao de Pessoas em Excel com selecao

**O Que:** Adicionado fluxo de exportacao em `.xlsx` para Pessoas, com selecao individual por checkbox e acao de exportar apenas os registros marcados.

**Identificadores:** Rota `POST /api/pessoas/export.xlsx`; API `client/src/lib/api.ts`; UI `client/src/pages/interessados-page.tsx`; repositorio `server/src/repositories/postgres-interessado-repository.ts`; contrato `server/src/repositories/types.ts`; teste `server/src/app.test.ts`.

**Validacao:** `npm run build:server` e `npm run build:client` executados com sucesso.

**Seguranca:** Nenhuma credencial, token ou segredo foi exposto ou alterado.
