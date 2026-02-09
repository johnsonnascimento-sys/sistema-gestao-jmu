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
- **IP:** `[REDACTED]`
- **Acesso:** SSH (user `root`)  
- **Docker:** Hospeda os serviços (n8n, Appsmith).
- **Nginx/CloudPanel:** Reverse proxy + TLS/SSL.

### B) Backend (Lógica & Dados)
- **n8n (self-hosted):** `https://n8n.johnsontn.com.br`
  - **Status:** Workflows de backend ATIVOS (ativados via SSH).
  - **Webhooks protegidos:** Header `x-api-key`.
- **Supabase (Postgres):**
  - **Host:** `[REDACTED]`
  - **Schema:** `adminlog`

### C) Front-end (Appsmith)
- **URL Base:** `https://app.johnsontn.com.br`
- **Hospedagem:** Docker (`[REDACTED]:8081`)
- **Pasta:** `/home/docker/appsmith`
- **Status:** Instalado, Rodando e Acessível via HTTPS (SSL Let's Encrypt).

---

## 3. ✅ STATUS ATUAL (O que já está pronto)

### 3.1 Infraestrutura Básica
- [x] VPS Configurada e Segura (SSH ativo).
- [x] CloudPanel Configurado (Reverse Proxy para N8N e Appsmith).
- [x] **DNS Configurado:** `app.johnsontn.com.br` -> `[REDACTED]`A (via Cloudflare).
- [x] **SSL Ativo:** Certificados Let's Encrypt instalados e válidos para ambos os subdomínios.

### 3.2 Backend (N8N)
Workflows JMU (Ativos):
- **JMU - PreSEI Criar** (ID `nwV77ktZrCIawXYr`): Criação de demandas.
- **JMU - PreSEI Associar** (ID `clRfeCOLYAWBN3Qs`): Associação com SEI.
- **JMU - Bootstrap Adminlog** (ID `nfBKnnBjON6oU1NT`): Manutenção de Schema.

### 3.3 Banco de Dados (Supabase)
Schema `adminlog` provisionado com tabelas `pre_demanda`, `pre_to_sei_link` e funções auxiliares.

---

## 4. 🚀 COMO RETOMAR EM OUTRO COMPUTADOR

Arquivos de contexto do projeto:
- `AI_BOOTLOADER.md` (fonte da verdade do contexto)
- `boot.ps1` (Windows/PowerShell: copia o contexto para o clipboard)
- `boot.sh` (Linux/macOS: copia o contexto para o clipboard)

### 4.1 Windows (recomendado)
Executar (`Win`+`R` -> `powershell`):
```powershell
cd C:\Users\jtnas\.gemini\antigravity\scratch\sistema-gestao-jmu
.\boot.ps1
```

---

## 5. 🤖 PROMPT DE RETOMADA (Desenvolvimento Appsmith)

> **ATUE COMO DESENVOLVEDOR FRONT-END APPSMITH (LOW-CODE).**
>
> **CONTEXTO:**
> O Sistema de Gestão JMU está com a infraestrutura pronta.
> URL do Front: `https://app.johnsontn.com.br`.
> Backend: N8N (`https://n8n.johnsontn.com.br`) e Supabase.
>
> **MISSÃO (Fase 3):**
> Configurar o Appsmith e criar as telas iniciais.
>
> **PASSO A PASSO:**
> 1.  **Configuração Inicial:** Acessar o Appsmith, criar a conta admin (se ainda não existir) e criar um novo App "Gestão JMU".
> 2.  **Datasources:**
>     -   Conectar ao **Supabase** (Postgres) usando as credenciais do `PROJECT_HANDOVER.md` (ou solicitar ao usuário).
>     -   Conectar ao **N8N** (REST API) para os webhooks de criação/associação (usando Header `x-api-key`).
> 3.  **UI - Dashboard:** Criar tabela listando dados da view/tabela `pre_demanda`.
> 4.  **UI - Nova Demanda:** Criar formulário que dispara o webhook `JMU - PreSEI Criar`.
>
> **Pode começar pela configuração dos Datasources?**

---

## 6. 📂 ANEXOS TÉCNICOS

### 6.1 Histórico de Deploy
- **Appsmith:** Deployado via Docker Compose na porta 8081.
- **Proxy:** CloudPanel redirecionando `app.johnsontn.com.br` (443) -> `127.0.0.1:8081`.
- **SSL:** Gerado via Let's Encrypt no CloudPanel após ajuste de DNS no Cloudflare.

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
