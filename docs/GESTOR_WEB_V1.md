# Gestor Web JMU v1

Aplicacao propria do Gestor JMU para o fluxo pre-SEI/SEI.

## Stack
- Frontend: React + Vite
- Backend: Fastify + PostgreSQL
- Auth: cookie `HttpOnly` assinado
- Banco primario de producao: PostgreSQL local na VPS

## Variaveis de ambiente
Copie `.env.example` para `.env` e ajuste os valores:

```env
PORT=3000
DATABASE_URL=postgresql://...
SESSION_SECRET=troque-esta-chave
CLIENT_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:3000
QUEUE_ATTENTION_DAYS=2
QUEUE_CRITICAL_DAYS=5
NODE_ENV=development
```

## Banco
Antes de subir a aplicacao:

1. `npm run db:migrate`

## Criacao do primeiro usuario
```bash
npm run db:create-user -- --email=admin@jmu.local --name="Administrador" --password=Senha1234 --role=admin
```

## Desenvolvimento
```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`

## Build e execucao
```bash
npm run build
npm start
```

Em producao, a API tambem serve o frontend em `dist/client`.

## Smoke test
```bash
npm run smoke:test
```

Defina `SMOKE_TEST_REQUIRE_AUTH=true`, `SMOKE_TEST_EMAIL` e `SMOKE_TEST_PASSWORD` para exigir validacao autenticada de login, sessao e fila operacional.
Para validar a area administrativa, use `SMOKE_TEST_REQUIRE_ADMIN=true`, `SMOKE_TEST_ADMIN_EMAIL` e `SMOKE_TEST_ADMIN_PASSWORD`.

## Rotas da API
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/pre-demandas`
- `GET /api/pre-demandas`
- `GET /api/pre-demandas?queueHealth=attention,critical`
- `GET /api/pre-demandas/pacotes`
- `POST /api/pre-demandas/pacotes`
- `PATCH /api/pre-demandas/pacotes/:id`
- `POST /api/pre-demandas/lote`
- `GET /api/pre-demandas/timeline/recentes`
- `GET /api/pre-demandas/:preId`
- `GET /api/pre-demandas/:preId/exclusao-preview`
- `DELETE /api/pre-demandas/:preId`
- `PATCH /api/pre-demandas/:preId/status`
- `POST /api/pre-demandas/:preId/associacoes-sei`
- `GET /api/pre-demandas/:preId/auditoria`
- `GET /api/pre-demandas/:preId/timeline`
- `GET /api/admin/users`
- `GET /api/admin/users/auditoria`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-password`

## Escopo atual
- Login proprio
- Dashboard do Gestor
- Cadastro de pre-demanda
- Inicio de processo relacionado a partir da barra de acoes do detalhe, com cadastro em branco e vinculo automatico
- Cadastro de processos em lote por pacotes de assuntos, com uma pre-demanda por assunto confirmado
- Cadastro simples de pacotes de processos usando assuntos existentes
- Lista com filtros e paginacao
- Dashboard com atalhos e ultimas movimentacoes
- Situacao operacional de fila parada no backend e front:
  - `Em observacao`: `QUEUE_ATTENTION_DAYS` dias ou mais sem movimentacao
  - `Em risco`: `QUEUE_CRITICAL_DAYS` dias ou mais sem movimentacao
- Associacao e reassociacao PRE -> SEI
- Auditoria de reassociacoes, status e administracao de utilizadores
- Exclusao definitiva de processo/demanda restrita a admin, com preview de impacto, confirmacao por `pre_id` e auditoria permanente em `pre_demanda_delete_audit`

## Iniciar Processo Relacionado

No detalhe do processo/demanda, o botao **Iniciar Processo Relacionado** abre `/pre-demandas/nova?origemPreId=...`. O formulario mostra a origem, mas conserva os valores iniciais do cadastro comum, sem copiar dados do processo. Cancelar retorna a origem. Ao salvar, o sistema abre o novo registro ja relacionado.

O contrato `POST /api/pre-demandas` aceita `origem_pre_id` opcional. Quando informado, exige as permissoes `pre_demanda.create` e `pre_demanda.manage_vinculos`. A criacao, o vinculo em `demanda_vinculos` e os registros de historico sao gravados juntos: uma falha desfaz toda a operacao. Os recursos atuais de consulta, inclusao e remocao de vinculos continuam disponiveis.

Se os dados identificarem um cadastro existente sem o relacionamento solicitado, a API retorna conflito e informa o registro existente, sem relaciona-lo automaticamente. Uma repeticao que encontre o registro ja vinculado retorna o resultado idempotente, sem duplicar o historico. O cadastro comum permanece inalterado.

Os processos sao independentes: nao compartilham status, prazos, tarefas ou interessados. E possivel iniciar um relacionado a uma origem encerrada sem reabri-la. Remover o relacionamento nao exclui nenhum processo e registra o evento nos dois historicos. A funcionalidade nao cria processos no SEI externo e nao exige nova migration.

Appsmith, n8n e RAG/indexacao juridica ficam fora do runtime atual desta aplicacao. O banco operacional atual tambem nao depende de `pgvector` nem de artefatos de embeddings. A producao usa PostgreSQL local na VPS, com o Supabase apenas como contingencia temporaria apos o cutover.
