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

### 3.3 Appsmith (Configurado)
- **Status:** ✅ Pronto para desenvolvimento.
- **Datasources Configured:**
  1.  **Supabase JMU:**
      -   Host: `db.tawymhilpwkatuglxgae.supabase.co`
      -   Database: `postgres` (⚠️ Importante: usar `postgres`, não `admin`)
      -   SSL Mode: `Require`
  2.  **N8N Webhooks:**
      -   REST API Global
      -   URL: `https://n8n.johnsontn.com.br/webhook`
      -   Header: `x-api-key` (Configurado no Datasource)

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
> O Sistema de Gestão JMU está pronto para a criação das telas.
> **Appsmith:** `https://app.johnsontn.com.br` (credenciais no `MEUS_SEGREDOS.txt`).
> **App:** "Gestão JMU".
>
> **STATUS:**
> Os Datasources ("Supabase JMU" e "N8N Webhooks") JÁ ESTÃO CONFIGURADOS.
>
> **MISSÃO (Fase 3):**
> Criar as interfaces do usuário.
>
> **PASSO A PASSO:**
> 1.  **Dashboard (Página Inicial):**
>     -   Criar uma Query SQL usando "Supabase JMU": `SELECT * FROM adminlog.pre_demanda ORDER BY criado_em DESC;`
>     -   Adicionar um Widget **Table** para exibir esses dados.
> 2.  **Formulário de Nova Demanda (Modal ou Página):**
>     -   Inputs: Solicitante (Text), Assunto (Text), Data (Datepicker), Observações (Rich Text).
>     -   Botão "Salvar": Disparar Query API usando "N8N Webhooks" -> `POST /presei/criar` com os dados do form no Body.
>
> **Pode começar criando a Query SQL para o Dashboard?**

---

## 6. 📂 ANEXOS TÉCNICOS

### 6.1 Histórico de Deploy
- **Appsmith:** Deployado via Docker Compose na porta 8081.
- **Proxy:** CloudPanel redirecionando `app.johnsontn.com.br` (443) -> `127.0.0.1:8081`.
- **SSL:** Gerado via Let's Encrypt no CloudPanel após ajuste de DNS no Cloudflare.
