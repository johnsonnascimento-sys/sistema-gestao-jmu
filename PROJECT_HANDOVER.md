# SISTEMA DE GESTAO JMU - DOCUMENTACAO DE HANDOVER

> STATUS DO PROJETO: EM DESENVOLVIMENTO ATIVO E EM PRODUCAO
> DATA: 26/03/2026
> FOCO: Gestor Web proprio (React + Fastify + PostgreSQL)

---

## 1. Conceito do Sistema
Sistema de gestao processual e operacional da JMU, com foco em:
- processos pre-SEI e processos vinculados
- tarefas, andamentos e fila de trabalho
- audiencias, pauta, pessoas, setores e assuntos
- processos em lote por pacotes reutilizaveis de assuntos
- auditoria e historico operacional

Regra de ouro:
- o sistema nao substitui SEI/e-Proc
- nao faz scraping, automacao de clique ou operacao oficial direta em sistemas externos

---

## 2. Stack Atual

### Aplicacao
- Frontend: React + Vite
- Backend: Fastify + TypeScript
- Banco: PostgreSQL via `DATABASE_URL`
- Schema principal: `adminlog`

### Infra
- VPS Hostinger com Docker
- scripts operacionais versionados em `scripts/`
- backup, restore, rollback, status e smoke test documentados no runbook
- banco primario executado no container `gestor-jmu-db`
- rede Docker dedicada do Gestor: `gestor-jmu-net`

### Estado de integracoes antigas
- Appsmith: fora do runtime atual
- n8n: fora do runtime atual
- RAG/indexacao juridica: fora do runtime atual

---

## 3. Status Atual
- O Gestor Web e a unica interface ativa deste repositorio.
- O sistema ja cobre dashboard, processos, processos em lote por pacotes, tarefas, audiencias, pauta, assuntos, pessoas, setores, comentarios, documentos e auditoria.
- O deploy produtivo e feito pelos scripts `deploy:vps`, `rollback:vps`, `status:vps`, `backup:vps` e `restore:vps`.
- O banco primario ja foi migrado para a VPS.
- O Supabase permanece apenas como contingencia temporaria, fora do runtime ativo.

---

## 4. Como Retomar em Outro Computador

Arquivos de contexto principais:
- `START_HERE_AGENTS.md`
- `AI_BOOTLOADER.md`
- `AGENT_RULES`
- `agents.toml`
- `ARCHITECTURE.md`
- `docs/GESTOR_WEB_V1.md`
- `docs/GESTOR_WEB_RUNBOOK.md`

Convencao operacional de agentes:
- `Atlas` coordena e integra
- `Ada`, `Turing`, `Laplace` e `SRE-1` devem ser usados por padrao quando a tarefa tiver dominio tecnico claro
- `git add`, `git commit`, `git push` e `deploy` ficam sob o agente principal por padrao
- Toda tarefa com agente ou subagente deve ser anunciada antes da execucao com nome, papel e modelo, e deve ser recapitulada ao final com o resultado entregue.

### Windows
```powershell
cd C:\Users\johnsontn\Documents\Playground\sistema-gestao-jmu
.\boot.ps1
```

---

## 5. Fontes da Verdade
- `AI_BOOTLOADER.md`: contexto mestre atual
- `ARCHITECTURE.md`: arquitetura tecnica do Gestor Web
- `docs/GESTOR_WEB_V1.md`: visao funcional da aplicacao
- `docs/GESTOR_WEB_RUNBOOK.md`: operacao de VPS, backup, restore, deploy e rollback
- `docs/SESSION_LOG_2026-03-26.md`: registro da limpeza estrutural de Appsmith, n8n e RAG
- `docs/SESSION_LOG_2026-05-01.md`: registro da feature de processos em lote por pacotes

---

## 6. Observacoes de Operacao
- Segredos permanecem fora do repositorio
- O app em producao usa `DATABASE_URL` local da VPS com `sslmode=disable`
- O banco local fica no container `gestor-jmu-db`, conectado pela rede `gestor-jmu-net`
- A limpeza estrutural ja removeu do projeto/runtime e do schema versionado as dependencias de Appsmith, n8n e RAG
