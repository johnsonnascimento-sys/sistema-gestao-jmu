# 🚀 SISTEMA DE GESTÃO JMU - DOCUMENTAÇÃO DE HANDOVER

> **STATUS DO PROJETO:** EM DESENVOLVIMENTO (Fase 3-B: Central de Ingestao PDF)  
> **DATA:** 16/02/2026  
> **PROXIMA ACAO:** construir pipeline de upload PDF (Appsmith + n8n + Google Drive) para normas internas da JMU

> **FOCO TEMPORARIO DECIDIDO:** priorizar somente o modulo Gestor JMU (pre-SEI/SEI) e pausar evolucao de RAG/indexacao ate nova decisao.
> **RESUMO GESTOR-ONLY:** `docs/RESUMO_PARA_GEMINI_GESTOR_ONLY_2026-02-16.md`

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

## 3. 🚦 Status Atual (16/02/2026)
* **Fase 0 (Fundação RAG):** ✅ CONCLUÍDO.
  * Banco de Dados (Supabase) estruturado com vetores (`adminlog.normas_index`).
  * Google Drive configurado para arquivos originais.
* **Fase 1 (Cérebro/N8N):** ✅ CONCLUÍDO.
  * Workflow de Produção (`JMU_Indexador_Atomico_RAG_Supabase`) rodando.
  * Fluxo Híbrido: Salva no Google Sheets (Legado) e no Supabase (Vetores) simultaneamente.
  * Correção de "Amnésia HTTP" aplicada via nó Merge.
* **Fase 2 (Interface Visual / Busca):** ✅ CONCLUÍDO.
  * Appsmith `Busca_Normas` em produção com busca híbrida, cache client-side e fallback lexical.
  * Tabela de resultados com contexto jurídico: `norma_id` + `artigo` (extração por regex de `conteudo_texto`).
  * Botão `Limpar Busca` ativo para evitar resultado residual na tela.
* **Fase 3-A (Ingestão Web):** ✅ CONCLUÍDO.
  * Workflow Web em produção: `JMU_Indexador_Web_RAG_Supabase (FASE3-A-ATIVO)` (`index-norma-web-v3`).
  * Página Appsmith criada: `Upload_Normas` (Aba Web funcional + Aba PDF placeholder).
  * Action `IngerirNormaWeb` conectada ao datasource `N8N Webhooks` (correção de erro `DEFAULT_REST_DATASOURCE`).
  * Parser HTML no n8n ajustado para resposta binária + detecção de charset (`utf8`/`latin1`/`windows-1252`) para evitar texto corrompido.
  * Validação E2E concluída: inserção em `adminlog.normas_index` e `adminlog.ai_generation_log`.
  * QA Lei 8112 reindexada (`LEI_8112_1990`): 269 chunks, 14 ocorrências de "férias", sem caractere inválido `�`.

### 3.1 🛠️ Stack Tecnológico Atual
* **N8N:** 
  * `index-norma` (pipeline principal atual)
  * `index-norma-web-v3` (Fase 3-A, operacional e validado)
* **Appsmith:**
  * `Busca_Normas` (consulta híbrida RAG)
  * `Upload_Normas` (ingestão web pronta; ingestão PDF pendente)
* **Supabase:** Projeto `jmu-db` (Tabelas `normas_index` e `ai_generation_log`).
* **Google Drive:** Pasta `00_JMU_Normas_Originais`.

---

## 4. 🚀 COMO RETOMAR EM OUTRO COMPUTADOR

Arquivos de contexto do projeto:
- `AI_BOOTLOADER.md` (fonte da verdade do contexto)
- `SESSION_LOG_2026-02-10.md` (Detalhes técnicos da última sessão)
- `boot.ps1` (Windows/PowerShell)

### 4.1 Windows (recomendado)
Executar (`Win`+`R` -> `powershell`):
```powershell
cd C:\Users\jtnas\OneDrive\Documentos\sistema-gestao-jmu
.\boot.ps1
```

---

## 5. 🤖 PROMPT DE RETOMADA (Desenvolvimento Appsmith + RAG)

> **ATUE COMO ARQUITETO DE SOFTWARE E DESENVOLVEDOR FULL-STACK.**
>
> **CONTEXTO:**
> - Fase 0 (Supabase RAG) concluida: `adminlog.normas_index` + `adminlog.ai_generation_log`.
> - Fase 1 (N8N -> Supabase) concluida: workflow `JMU_Indexador_Atomico_RAG_Supabase` gravando chunks e embeddings.
> - Fase 2 (Appsmith) em andamento: app `JMU_Gestao_Inteligente`, pagina `Busca_Normas` (busca semantica + fallback lexical).
>
> **MISSAO ATUAL (Fase 3-B - Ingestao PDF):**
> 1. Criar aba PDF funcional na pagina `Upload_Normas`.
> 2. Receber upload binario e enviar para webhook dedicado no n8n.
> 3. Salvar PDF no Google Drive (pasta `00_JMU_Normas_Originais`) e indexar chunks no Supabase.
> 4. Manter auditoria em `adminlog.ai_generation_log`.
>
> **ARQUIVOS/FONTES DA VERDADE:**
> - `AI_BOOTLOADER.md`
> - `ARCHITECTURE.md` (secao RAG)
> - `docs/FASE3_INGESTAO_WEB.md`
> - `docs/SESSION_LOG_2026-02-16_FASE3A.md`
> - `docs/MANUAL_USUARIO_JMU_GESTAO_INTELIGENTE.md`
>
> **O QUE NAO FAZER:**
> - Nao commitar API keys/senhas/JSON de service account.
> - Se algum segredo vazou em chat/logs, trate como comprometido e rotacione.

---

## 6. 📂 ANEXOS TÉCNICOS

### 6.1 Histórico de Deploy
- **Appsmith:** Deployado via Docker Compose na porta 8081.
- **Proxy:** CloudPanel redirecionando `app.johnsontn.com.br` (443) -> `127.0.0.1:8081`.
- **SSL:** Gerado via Let's Encrypt no CloudPanel após ajuste de DNS no Cloudflare.

### 6.2 Segredos (Local)
- `MEUS_SEGREDOS.txt` existe localmente para facilitar o desenvolvimento e esta protegido por `.gitignore` (nao versionar).
