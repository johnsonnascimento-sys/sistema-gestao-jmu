# 🚀 SISTEMA DE GESTÃO JMU - DOCUMENTAÇÃO DE HANDOVER

> **STATUS DO PROJETO:** EM DESENVOLVIMENTO (Fase 3: Construção do Front-end + Integração RAG 3.0)  
> **DATA:** 11/02/2026  
> **PRÓXIMA AÇÃO:** Construção do Dashboard e Criação do Schema RAG no Supabase (`normas_index`, `modelos_index`, `ai_generation_log`)

---

## 1. 🧠 CONCEITO DO SISTEMA
Sistema de memória administrativa pessoal + Motor de Automação de Pareceres e Normas (RAG) para a Justiça Militar da União.

- **Objetivo:** 
  1. Organizar demandas informais (WhatsApp, corredor) e apoiar preparação documental
  2. Indexar normas e modelos em arquitetura Database-First
  3. Automatizar geração de documentos fundamentados via IA (RAG)
- **Regra de Ouro:** Não substitui o SEI e não executa atos oficiais automaticamente. IA gera sugestões, humano valida.
- **Fluxo Clássico:** `Fato Informal` -> `Appsmith` -> `N8N` -> `Supabase (Postgres)` -> `Monitoramento/Consulta`
- **Fluxo RAG:** `Appsmith` -> `N8N Agente RAG` -> `Supabase + Google Workspace` -> `Documento Gerado` -> `Validação Humana`

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

### D) Google Workspace (Service Account)
- **Projeto Google Cloud:** `JMU-Automation`
- **Service Account:** `n8n-bot`
- **E-mail do Robô:** (ver arquivo JSON de credenciais - campo `client_email`)
- **Permissão:** Editor
- **APIs Ativadas:**
  - Google Sheets API (leitura/escrita de normas)
  - Google Drive API (manipulação de PDFs)
- **Planilha Mestre:** `Normas_Atomicas_JMU` (ID: `1Emu8IWDuS4yIS_8vQ_wPrZPqCNTkUBfMQFuVYWvFHVI`)
- **Status:** VALIDADO (11/02/2026) - Teste de conexão via n8n bem-sucedido

---

## 3. ✅ STATUS ATUAL (O que já está pronto)

### 3.1 Infraestrutura Básica
- [x] VPS Configurada e Segura (SSH ativo).
- [x] CloudPanel Configurado (Reverse Proxy para N8N e Appsmith).
- [x] **DNS Configurado:** `app.johnsontn.com.br` apontando para a VPS (via Cloudflare).
- [x] **SSL Ativo:** Certificados Let's Encrypt instalados e válidos.
- [x] **Google Service Account:** Configurada e validada (Sheets API + Drive API ativas).

### 3.2 Backend (N8N)
Workflows JMU (Ativos):
- **JMU - PreSEI Criar** (ID `nwV77ktZrCIawXYr`): Criação de demandas.
- **JMU - PreSEI Associar** (ID `clRfeCOLYAWBN3Qs`): Associação com SEI.
- **JMU - Bootstrap Adminlog** (ID `nfBKnnBjON6oU1NT`): Manutenção de Schema.

### 3.3 Appsmith (Configurado & Em Desenvolvimento)
- **Status:** 🚧 Em Construção (Fase 3 + Integração RAG 3.0).
- **Datasources:**
  1.  **Supabase JMU:** Conectado via Session Pooler (`aws-0-us-west-2.pooler...`).
  2.  **N8N Webhooks:** Conectado.
- **Telas Prontas:**
  - [x] **Nova Demanda:** Formulário de inserção funcional (SQL `insert_demanda` ajustado com `moment()`).
- **Telas Planejadas (RAG 3.0):**
  - [ ] **Biblioteca de Normas:** Listagem, upload e visualização de chunks
  - [ ] **Gerador de Documentos:** Interface para geração assistida por IA

### 3.4 Workflows RAG Planejados (N8N)
- [ ] **JMU - Indexador de Normas:** Upload PDF -> Chunking via Gemini -> Google Sheets -> Supabase
- [ ] **JMU - Gerador de Modelos:** Criar templates em Google Docs com variáveis
- [ ] **JMU - Agente RAG (Assessor de Elite):** Advanced AI nodes com Tools (Query Supabase + Read Sheets + LLM)
- [ ] **JMU - Auditoria de Geração:** Registrar uso de IA em `ai_generation_log`

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

## 5. 🤖 PROMPT DE RETOMADA (Desenvolvimento Appsmith + RAG)

> **ATUE COMO ARQUITETO DE SOFTWARE E DESENVOLVEDOR FULL-STACK.**
>
> **CONTEXTO:**
> O sistema já conecta ao banco (Supabase) e insere dados (Tela "Nova Demanda" PRONTA).
> Estamos evoluindo para a **Integração 3.0 (RAG)**: migração dos "Gems Especializados" para arquitetura Database-First.
>
> **MISSÃO ATUAL (Fase 3 - Continuação + RAG):**
> 1. Criar o Dashboard para visualizar demandas inseridas
> 2. Criar Schema RAG no Supabase (`normas_index`, `modelos_index`, `ai_generation_log`)
> 3. Desenvolver Workflows N8N para indexação e geração
>
> **PASSO A PASSO:**
> 1.  **Dashboard (Página Inicial/Nova Página):**
>     -   Criar Query `get_demandas`: `SELECT * FROM adminlog.pre_demanda ORDER BY criado_em DESC;`
>     -   Adicionar Widget **Table** conectado a `{{get_demandas.data}}`.
>     -   Configurar colunas (Ocultar IDs técnicos, formatar datas).
> 2.  **Schema RAG (Supabase):**
>     -   Criar tabelas `normas_index`, `modelos_index`, `ai_generation_log` (ver `ARCHITECTURE.md` seção 6.2)
>     -   Adicionar índices em campos de busca (`tags`, `tipo_norma`, `tipo_documento`)
> 3.  **Workflows N8N (Planejamento):**
>     -   Documentar estrutura dos 3 workflows RAG principais
>     -   Preparar credenciais Google Workspace (Sheets + Docs API)
>
> **Pode começar criando o Schema RAG no Supabase?**

---

## 6. 📂 ANEXOS TÉCNICOS

### 6.1 Histórico de Deploy
- **Appsmith:** Deployado via Docker Compose na porta 8081.
- **Proxy:** CloudPanel redirecionando `app.johnsontn.com.br` (443) -> `127.0.0.1:8081`.
- **SSL:** Gerado via Let's Encrypt no CloudPanel após ajuste de DNS no Cloudflare.

### 6.2 Segredos (Local)
- `MEUS_SEGREDOS.txt` existe localmente para facilitar o desenvolvimento e esta protegido por `.gitignore` (nao versionar).
