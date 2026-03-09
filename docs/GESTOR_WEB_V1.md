# Gestor Web JMU v1

Aplicacao propria do Gestor JMU, substituindo o Appsmith no fluxo pre-SEI/SEI.

## Stack
- Frontend: React + Vite
- Backend: Fastify + PostgreSQL
- Auth: cookie `HttpOnly` assinado

## Variaveis de ambiente
Copie `.env.example` para `.env` e ajuste:

```env
PORT=3000
DATABASE_URL=postgresql://...
SESSION_SECRET=troque-esta-chave
CLIENT_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:3000
NODE_ENV=development
```

## Banco
Antes de subir a aplicacao, aplique:

1. `sql/adminlog_provisionamento.sql`
2. `sql/adminlog_auth.sql`

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

Em producao, a API tambem serve o frontend buildado em `dist/client`.

## Rotas da API
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/pre-demandas`
- `GET /api/pre-demandas`
- `GET /api/pre-demandas/:preId`
- `POST /api/pre-demandas/:preId/associacoes-sei`
- `GET /api/pre-demandas/:preId/auditoria`

## Escopo atual
- Login proprio
- Dashboard do Gestor
- Cadastro de pre-demanda
- Lista com filtros e paginacao
- Associacao e reassociacao PRE -> SEI
- Auditoria de reassociacoes

RAG, indexacao juridica e telas do Appsmith permanecem fora desta entrega.
