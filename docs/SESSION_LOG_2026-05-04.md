# Session Log - 2026-05-04

## Deploy Gestor Web

**O Que:** Publicado deploy do Gestor Web na VPS apos ajuste de ordenacao das tarefas pendentes por prazo no detalhe do processo/demanda.

**Identificadores:**
- Commit: `23132203eedb30658c483bc81ee383883833f2fe`
- Branch: `main`
- Container: `gestor-jmu-web`
- Imagem: `gestor-jmu-web:commit-23132203eedb30658c483bc81ee383883833f2fe`
- Arquivos funcionais do ajuste: `client/src/pages/pre-demanda-detail-page.tsx`, `client/src/pages/pre-demanda-detail-page.test.tsx`

**Validacao:**
- Teste local: `npx vitest run client/src/pages/pre-demanda-detail-page.test.tsx` com 5 testes aprovados.
- Build local: `npm run build:client` concluido com sucesso.
- Deploy remoto: `npm run deploy:vps` concluiu com `health ok`, `ready ok`, smoke autenticado admin OK e container `gestor-jmu-web` healthy.
- Health remoto reportou `commitSha=23132203eedb30658c483bc81ee383883833f2fe`.

**Seguranca:** Nenhum segredo, senha ou token foi registrado neste log.
