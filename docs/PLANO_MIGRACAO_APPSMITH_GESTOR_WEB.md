# Plano de Migracao Appsmith -> Gestor Web Proprio

## Resumo
Substituir o Appsmith por uma aplicacao web propria para o modulo Gestor JMU, mantendo o banco `Supabase/Postgres` e usando `n8n` apenas para automacoes e integracoes. A v1 cobre login, cadastro de pre-demanda, listagem, associacao PRE -> SEI, auditoria e operacao na mesma VPS.

Decisoes fechadas:
- Escopo inicial: so modulo Gestor pre-SEI/SEI
- Frontend: React + Vite
- Backend: API dedicada, com `n8n` apenas como apoio
- Acesso: login proprio da aplicacao
- Hospedagem: mesma VPS

## Implementacao
### Arquitetura alvo
- Frontend SPA em React + Vite
- Backend Node.js com API HTTP propria
- `Supabase/Postgres` como fonte de verdade, reaproveitando o schema `adminlog`
- `n8n` fora do caminho da UI

### Backend
- Rotas autenticadas:
  - `POST /auth/login`
  - `POST /auth/logout`
  - `GET /auth/me`
  - `POST /pre-demandas`
  - `GET /pre-demandas`
  - `GET /pre-demandas/:preId`
  - `POST /pre-demandas/:preId/associacoes-sei`
  - `GET /pre-demandas/:preId/auditoria`
- Sessao HTTP com cookie `HttpOnly`
- Usuarios em tabela propria com `role` minima (`admin`, `operador`)
- Validacao server-side de datas, status e numero SEI
- Idempotencia na criacao de pre-demanda
- Associacao PRE -> SEI com auditoria de reassociacao
- Resposta padronizada em `ok`, `data`, `error`

### Frontend
- Rotas protegidas:
  - `/login`
  - `/dashboard`
  - `/pre-demandas`
  - `/pre-demandas/nova`
  - `/pre-demandas/:preId`
- Fluxos principais:
- Fluxos principais: cadastro, listagem, detalhe, associacao ao SEI e historico
- Dashboard com contagens por status e ultimas demandas atualizadas

### Infra e operacao
- Frontend buildado atras do Nginx/CloudPanel na mesma VPS
- Backend como servico Node separado
- API exposta em `/api` no mesmo host para simplificar cookie, CORS e sessao
- Segredos apenas no servidor
- Deploy em paralelo ao Appsmith, seguido de corte do proxy

## Interfaces e dados
- Tabelas reaproveitadas:
  - `adminlog.pre_demanda`
  - `adminlog.pre_to_sei_link`
  - `adminlog.pre_to_sei_link_audit`
- Adicao minima para autenticacao:
  - `adminlog.app_user`
  - indice unico por email
  - `password_hash`, `role`, `active`, `created_at`, `updated_at`

## Testes e aceite
- Login valido e invalido
- Criacao de pre-demanda nova
- Repeticao do payload retornando idempotencia
- Listagem filtrada por status
- Associacao inicial PRE -> SEI
- Reassociacao com auditoria
- Guarda de rota no frontend
- Fluxo minimo: login -> criar demanda -> listar -> associar -> ver auditoria
