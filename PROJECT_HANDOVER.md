# 🚀 SISTEMA DE GESTÃO JMU - DOCUMENTAÇÃO DE HANDOVER

> **STATUS DO PROJETO:** EM DESENVOLVIMENTO (Fase 3: Construção do Front-end)  
> **DATA:** 10/02/2026  
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
- **IP:** (ver painel do provedor/CloudPanel; nao registrar IP fixo em repo publico)
- **Acesso:** SSH (user `root`)  
- **Docker:** Hospeda os serviços (n8n, Appsmith).
- **Nginx/CloudPanel:** Reverse proxy + TLS/SSL.

### B) Backend (Lógica & Dados)
- **n8n (self-hosted):** `https://n8n.johnsontn.com.br`
  - **Status:** Workflows de backend ATIVOS (ativados via SSH).
  - **Webhooks protegidos:** Header `x-api-key`.
- **Supabase (Postgres):**
  - **Host:** (ver painel do Supabase; nao registrar host/credenciais em repo publico)
  - **Schema:** `adminlog`

### C) Front-end (Appsmith)
- **URL Base:** `https://app.johnsontn.com.br`
- **App Principal:** "Gestão JMU"
- **Credenciais:** manter apenas no seu `MEUS_SEGREDOS.txt` (nao commitar)

---

## 3. ✅ STATUS ATUAL (O que já está pronto)

### 3.1 Infraestrutura Básica
- [x] VPS Configurada e Segura (SSH ativo).
- [x] CloudPanel Configurado (Reverse Proxy para N8N e Appsmith).
- [x] **DNS Configurado:** `app.johnsontn.com.br` apontando para a VPS (via Cloudflare).
- [x] **SSL Ativo:** Certificados Let's Encrypt instalados e válidos.

### 3.2 Backend (N8N)
Workflows JMU (Ativos):
- **JMU - PreSEI Criar** (ID `nwV77ktZrCIawXYr`): Criação de demandas.
- **JMU - PreSEI Associar** (ID `clRfeCOLYAWBN3Qs`): Associação com SEI.
- **JMU - Bootstrap Adminlog** (ID `nfBKnnBjON6oU1NT`): Manutenção de Schema.

### 3.3 Appsmith (Configurado & Em Desenvolvimento)
- **Status:** 🚧 Em Construção (Fase 3).
- **Datasources:**
  1.  **Supabase JMU:** Conectado via Session Pooler (`aws-0-us-west-2.pooler...`).
  2.  **N8N Webhooks:** Conectado.
- **Telas Prontas:**
  - [x] **Nova Demanda:** Formulário de inserção funcional (SQL `insert_demanda` ajustado com `moment()`).

---

## 4. 🚀 COMO RETOMAR EM OUTRO COMPUTADOR

Arquivos de contexto do projeto:
- `AI_BOOTLOADER.md` (fonte da verdade do contexto)
- `SESSION_LOG_2026-02-10.md` (Detalhes técnicos da última sessão)
- `boot.ps1` (Windows/PowerShell)

### 4.1 Windows (recomendado)
Executar (`Win`+`R` -> `powershell`):
```powershell
cd C:\Users\jtnas\.gemini\antigravity\scratch\sistema-gestao-jmu
.\boot.ps1
```

---

## 5. 🤖 PROMPT DE RETOMADA (Desenvolvimento Appsmith)

> **ATUE COMO DESENVOLVEDOR FRONT-END APPSMITH.**
>
> **CONTEXTO:**
> O sistema já conecta ao banco (Supabase) e insere dados (Tela "Nova Demanda" PRONTA).
>
> **MISSÃO ATUAL (Fase 3 - Continuação):**
> Criar o Dashboard para visualizar os dados inseridos.
>
> **PASSO A PASSO:**
> 1.  **Dashboard (Página Inicial/Nova Página):**
>     -   Criar Query `get_demandas`: `SELECT * FROM adminlog.pre_demanda ORDER BY criado_em DESC;`
>     -   Adicionar Widget **Table** conectado a `{{get_demandas.data}}`.
>     -   Configurar colunas (Ocultar IDs técnicos, formatar datas).
> 2.  **Integração (Opcional):**
>     -   Verificar necessidade de disparo para N8N no sucesso do formulário.
>
> **Pode começar criando a Query de listagem?**

---

## 6. 📂 ANEXOS TÉCNICOS

### 6.1 Histórico de Deploy
- **Appsmith:** Deployado via Docker Compose na porta 8081.
- **Proxy:** CloudPanel redirecionando `app.johnsontn.com.br` (443) -> `127.0.0.1:8081`.
- **SSL:** Gerado via Let's Encrypt no CloudPanel após ajuste de DNS no Cloudflare.

### 6.2 Segredos (Local)
- `MEUS_SEGREDOS.txt` existe localmente para facilitar o desenvolvimento e esta protegido por `.gitignore` (nao versionar).
