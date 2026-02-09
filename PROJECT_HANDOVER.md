# 🚀 SISTEMA DE GESTÃO JMU - DOCUMENTAÇÃO DE HANDOVER

> **STATUS DO PROJETO:** EM DESENVOLVIMENTO (Fase 3: Construção do Front-end)  
> **DATA:** 08/02/2026  
> **PRÓXIMA AÇÃO:** Desenvolvimento das interfaces no Appsmith (`app.johnsontn.com.br`)

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
- **IP:** (ver CloudPanel/Cloudflare; nao registrar IP fixo aqui)
- **Acesso:** SSH (user `root`)
- **Docker:** Hospeda os serviços (n8n, Appsmith).
- **Nginx/CloudPanel:** Reverse proxy + TLS/SSL.

### B) Backend (Lógica & Dados)
- **n8n (self-hosted):** `https://n8n.johnsontn.com.br`
  - **Status:** Workflows de backend ATIVOS.
  - **Webhooks protegidos:** Header `x-api-key`.
- **Supabase (Postgres):**
  - **Host:** (ver painel do Supabase; nao registrar aqui)
  - **Schema:** `adminlog`

### C) Front-end (Appsmith)
- **URL Base:** `https://app.johnsontn.com.br`
- **Hospedagem:** Docker (porta `8081` no host -> `80` no container)
- **Pasta:** `/home/docker/appsmith`
- **Status:** Instalado e Acessível via HTTPS.

---

## 3. ✅ STATUS ATUAL (O que já está pronto)

### 3.1 Infraestrutura Básica
- [x] VPS Configurada e Segura (SSH ativo).
- [x] CloudPanel Configurado (Reverse Proxy para N8N e Appsmith).
- [x] **DNS Configurado:** `app.johnsontn.com.br` apontando para a VPS (Cloudflare).
- [x] **SSL Ativo:** Certificados Let's Encrypt instalados para ambos os subdomínios.

### 3.2 Backend (N8N)
Workflows JMU (Ativos):
- **JMU - PreSEI Criar** (ID `nwV77ktZrCIawXYr`): Criação de demandas.
- **JMU - PreSEI Associar** (ID `clRfeCOLYAWBN3Qs`): Associação com SEI.
- **JMU - Bootstrap Adminlog** (ID `nfBKnnBjON6oU1NT`): Manutenção de Schema.

Nota operacional:
- Se a ativacao via API do n8n falhar, ativar manualmente pela UI (toggle "Active").

### 3.3 Banco de Dados (Supabase)
Schema `adminlog` provisionado com tabelas `pre_demanda`, `pre_to_sei_link` e funções auxiliares.

---

## 4. 🚀 COMO RETOMAR EM OUTRO COMPUTADOR

Arquivos de contexto do projeto:
- `AI_BOOTLOADER.md` (fonte da verdade do contexto)
- `boot.ps1` (Windows/PowerShell: copia o contexto para o clipboard)
- `boot.sh` (Linux/macOS: copia o contexto para o clipboard)

### 4.1 Windows (recomendado)
Executar:
```powershell
cd C:\Users\jtnas\.gemini\antigravity\scratch\sistema-gestao-jmu
.\boot.ps1
```

---

## 5. 🤖 PROMPT DE RETOMADA (Desenvolvimento Appsmith)

> **ATUE COMO DESENVOLVEDOR FRONT-END APPSMITH (LOW-CODE).**
>
> **CONTEXTO:**
> O Sistema de Gestão JMU já possui backend (N8N) e banco (Supabase) prontos.
> O Appsmith já está deployado em `https://app.johnsontn.com.br`.
>
> **MISSÃO (Fase 3):**
> Criar a interface do usuário no Appsmith para:
> 1.  Registrar novas demandas informais (Formulário -> Webhook N8N).
> 2.  Listar demandas pendentes (Consulta SQL ou via N8N).
> 3.  Associar demandas a protocolos SEI.
>
> **PRÓXIMOS PASSOS:**
> 1.  Acessar `https://app.johnsontn.com.br`.
> 2.  Configurar Datasource para o Supabase (Postgres).
> 3.  Configurar Datasource REST API para o N8N.
> 4.  Criar a página "Dashboard" e o formulário "Nova Demanda".
>
> **Aguardo instruções para conectar os datasources.**

---

## 6. 📂 ANEXOS TÉCNICOS

### 6.1 Scripts de Automação (Localizados na pasta do projeto)
- `deploy.js`: Script Node.js para deploy do Appsmith via SSH.
- `activate_n8n_ssh.js`: Script para ativar workflows do N8N via SSH.
- `verify_https.js`: Script de validação de conectividade SSL.
- `verify_n8n.js`: Script de verificação dos workflows via API do n8n.

Observacao de seguranca:
- Esses scripts NAO contem senhas/tokens hardcoded. Eles leem valores via variaveis de ambiente.

Variaveis de ambiente (local):
- `JMU_SSH_HOST`, `JMU_SSH_USER` (opcional), `JMU_SSH_PORT` (opcional), `JMU_SSH_KEY_PATH` (opcional) e/ou `JMU_SSH_PASSWORD` (opcional).
- `N8N_API_KEY` e `N8N_URL` (opcional, default `https://n8n.johnsontn.com.br/api/v1`).

### 6.2 Docker Compose do Appsmith (VPS: `/home/docker/appsmith/docker-compose.yml`)
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
