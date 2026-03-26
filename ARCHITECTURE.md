# Sistema de Gestao JMU - Arquitetura Tecnica

## 1. Componentes e Responsabilidades

### A) Frontend
- React + Vite
- responsavel por dashboard, filas, detalhe do processo, tarefas, audiencias e administracao

### B) Backend
- Fastify + TypeScript
- responsavel por autenticacao, validacao, regras de negocio, auditoria e exposicao das rotas HTTP

### C) Banco de Dados
- PostgreSQL acessado via `DATABASE_URL`
- schema operacional: `adminlog`
- fonte de verdade de processos, tarefas, andamentos, audiencias, pessoas, setores, assuntos, comentarios, documentos e administracao

### D) Infra
- VPS Hostinger
- Docker para empacotamento e execucao
- scripts operacionais para deploy, rollback, backup, restore, status e smoke test

### E) Sistemas externos
- SEI/e-Proc permanecem externos
- o Gestor nao faz scraping, automacao de clique nem operacao oficial direta sobre esses sistemas

---

## 2. Fluxo do Sistema

1. Usuario acessa o frontend React
2. Frontend consome a API Fastify
3. Backend aplica validacao, regras de dominio e auditoria
4. Dados persistem no PostgreSQL
5. Dashboard, fila de tarefas e detalhe do processo refletem o estado consolidado

---

## 3. Dominios Principais

### Processos e demandas
- criacao e edicao de processo
- status, fila operacional e reassociacao PRE x SEI
- processos judiciais com numero judicial e audiencias

### Tarefas
- tarefas manuais e tarefas derivadas de assunto
- prazo, horarios opcionais, recorrencia e ordenacao
- fila global dedicada e listagem no detalhe do processo

### Audiencias
- entidade propria para processos judiciais
- pauta dedicada
- dashboard com audiencias e indicadores relacionados

### Apoio operacional
- pessoas, setores, assuntos, relacionamentos, comentarios e documentos
- historico de andamentos e auditoria administrativa

---

## 4. Banco e Historico de Integracoes

### Banco operacional
- schema principal: `adminlog`
- uso corrente: tabelas e rotas do Gestor Web

### Fora do banco operacional atual
- RAG/indexacao juridica nao fazem parte do Gestor Web atual
- Appsmith e n8n nao fazem parte da arquitetura atual
- o schema versionado remove os objetos legados de embeddings e `pgvector`

---

## 5. Endpoints e Contratos

O sistema usa API HTTP propria do backend Fastify, incluindo:
- autenticacao de usuario
- CRUD e operacoes de processo
- timeline e auditoria
- tarefas, audiencias, pessoas, setores e assuntos
- dashboard, pauta e fila global de tarefas

Rotas operacionais e detalhes de execucao ficam documentados em `docs/GESTOR_WEB_V1.md` e `docs/GESTOR_WEB_RUNBOOK.md`.

---

## 6. Organizacao e Padroes de Codigo

### Backend
- repositorios devem ser divididos por contexto e responsabilidade
- rotas recebem repositorios por injecao para manter testabilidade
- mapeadores e transacoes auxiliares ficam em utilitarios dedicados

### Frontend
- paginas atuam como orquestradoras
- modais, tabelas, componentes visuais, tipos e utilitarios devem ser extraidos por responsabilidade
- evitar arquivos monoliticos e estados acoplados sem necessidade
