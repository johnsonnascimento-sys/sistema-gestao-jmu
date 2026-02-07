# 🚀 SISTEMA DE GESTÃO JMU - DOCUMENTAÇÃO DE HANDOVER

> **STATUS DO PROJETO:** EM DESENVOLVIMENTO (Fase 2: Front-end)  
> **DATA:** 07/02/2026  
> **PRÓXIMA AÇÃO:** Deploy do Appsmith na VPS + Proxy no CloudPanel

---

## 1. 🧠 CONCEITO DO SISTEMA
Sistema de memória administrativa pessoal para a Justiça Militar da União.

- **Objetivo:** Organizar demandas informais (WhatsApp, corredor) e apoiar preparação documental.
- **Regra de Ouro:** Não substitui o SEI e não executa atos oficiais automaticamente.
- **Fluxo:** `Fato Informal` -> `Appsmith` -> `N8N` -> `Supabase (Postgres)` -> `Monitoramento/Consulta`

---

## 2. 🏗️ INFRAESTRUTURA (Stack)

### A) Servidor (VPS)
- **Provedor:** Hostinger (CloudPanel + Ubuntu 24.04)
- **IP:** `[REDACTED]`
- **Acesso:** SSH (user `root`)  
  Nota: Senha/keys não devem ficar nesta documentação.
- **Docker:** Hospeda os serviços (n8n e outros).
- **Nginx/CloudPanel:** Reverse proxy + TLS/SSL.

### B) Backend (Lógica & Dados)
- **n8n (self-hosted):** `https://n8n.johnsontn.com.br`
  - **Webhooks protegidos:** Header `x-api-key` (valor deve ficar em variável de ambiente, não em arquivo).
- **Supabase (Postgres):**
  - **Host:** `[REDACTED]`
  - **Schema:** `adminlog`

### C) Front-end (Fase atual)
- **Tecnologia:** Appsmith Community (Docker)
- **Porta no host:** `8081` (para não conflitar com 80/443)
- **URL desejada:** `app.johnsontn.com.br` (reverse proxy no CloudPanel para `http://127.0.0.1:8081`)

---

## 3. ✅ STATUS ATUAL (O que já está pronto)

### 3.1 Banco de Dados (Supabase)
Artefatos de provisionamento no repositório:
- Script SQL: `sql/adminlog_provisionamento.sql`

Estrutura prevista/implementada no schema `adminlog`:
- `pre_demanda`: demandas informais (pré-SEI), com regra de idempotência por `solicitante + assunto + data_referencia`.
- `pre_to_sei_link`: vínculo `pre_id` -> `sei_numero` (pode sobrescrever com auditoria).
- `pre_to_sei_link_audit`: histórico de (re)associações.
- Funções PL/pgSQL:
  - `fn_generate_pre_id(date)` para gerar IDs do tipo `PRE-2026-001`.

### 3.2 Workflows n8n (Criados)
Workflows JMU (IDs registrados por API):
- `JMU - PreSEI Criar` (ID `nwV77ktZrCIawXYr`)
  - Webhook: `POST /webhook/presei/criar`
  - Função: valida `x-api-key`, normaliza dados, aplica idempotência, cria `pre_demanda`.
- `JMU - PreSEI Associar` (ID `clRfeCOLYAWBN3Qs`)
  - Webhook: `POST /webhook/presei/associar-sei`
  - Função: upsert em `pre_to_sei_link`, auditoria em `pre_to_sei_link_audit`, status em `pre_demanda` -> `associada`.
- `JMU - Bootstrap Adminlog` (ID `nfBKnnBjON6oU1NT`)
  - Uso: bootstrap/DDL do schema `adminlog` (utilizar apenas se for necessário recriar/garantir estrutura).

**Nota operacional importante:** na instância atual, a ativação por API (`/api/v1/workflows/{id}/activate`) retornou erro `400`. Se algum workflow estiver desligado, ativar manualmente pela UI do n8n (toggle “Active”).

---

## 4. 🚀 COMO RETOMAR EM OUTRO COMPUTADOR

Arquivos de contexto do projeto:
- `AI_BOOTLOADER.md` (fonte da verdade do contexto)
- `boot.ps1` (Windows/PowerShell: copia o contexto para o clipboard)
- `boot.sh` (Linux/macOS: copia o contexto para o clipboard; se não houver utilitário, imprime na tela)

### 4.1 Windows (recomendado)
Executar:
```powershell
cd C:\Users\jtnas\.gemini\antigravity\scratch\sistema-gestao-jmu
.\boot.ps1
```

### 4.2 Linux/macOS
Executar:
```bash
./boot.sh
```

---

## 5. 🤖 PROMPT DE RETOMADA (DevOps + n8n)

> **ATUE COMO ENGENHEIRO DEVOPS E ESPECIALISTA EM N8N.**
>
> **CONTEXTO DO PROJETO:**
> Estamos construindo o "Sistema de Gestão JMU". O backend (n8n + Supabase/Postgres) já está pronto e não deve ser recriado.
>
> **MISSÃO (Fase de Front-end):**
> Subir o Appsmith na VPS via Docker Compose e publicar em `app.johnsontn.com.br` via reverse proxy no CloudPanel.
>
> **DADOS DE ACESSO:**
> - VPS: `[REDACTED]` (SSH user `root`)  
> - n8n: `https://n8n.johnsontn.com.br`
>
> **TAREFA IMEDIATA:**
> 1. Conectar via SSH à VPS (eu fornecerei a senha/chave no momento).
> 2. Criar a pasta `/home/docker/appsmith`.
> 3. Criar/validar o `docker-compose.yml` do Appsmith (porta **8081**).
> 4. Subir com `docker compose up -d`.
> 5. Validar com `docker ps` e teste HTTP local.
>
> **Por favor, solicite a senha/chave de root para iniciar.**

---

## 6. 📂 ANEXOS TÉCNICOS

### 6.1 Docker Compose do Appsmith (padrão)
```yaml
version: "3"
services:
  appsmith:
    image: index.docker.io/appsmith/appsmith-ce
    container_name: appsmith
    ports:
      - "8081:80"
      - "9091:9090"
    volumes:
      - ./stacks:/appsmith-stacks
    restart: unless-stopped
```

