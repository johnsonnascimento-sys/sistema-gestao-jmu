# Sistema de Gestão JMU - Arquitetura Técnica

## 1. Componentes e Responsabilidades

### A) VPS (Hostinger)
- Hospeda tudo.
- Perímetro de segurança: Firewall, Nginx, Docker.

### B) Docker
- `n8n`: Aplicação de automação e orquestração.
- `n8n_postgres`: Banco de dados principal (Single Source of Truth).
- *(Futuro)* `redis`: Fila/cache.

### C) Nginx + CloudPanel
- Termina HTTPS (SSL).
- Reverse Proxy para o n8n.
- Controle de acesso por rota (Proteção de Webhooks).

### D) PostgreSQL (Schema `adminlog` ou `public`)
- Fonte da verdade.
- Guarda eventos, demandas pré-SEI, vínculos, audiências.

### E) Clientes (Origem)
- Webhooks (HTTP POST).
- Importação em massa (CSV/Excel).
- *(Futuro)* Front-end mobile/desktop.

---

## 2. Camadas do Sistema

### Camada 1 — Entrada (Ingestão)
Transformar “fato” em dados estruturados via Webhooks ou Importação.

### Camada 2 — Normalização e Validação
Garantir consistência (Padronizar nomes, validar formato de número SEI, checar datas).

### Camada 3 — Persistência (Postgres)
Insert/Update nas tabelas. Auditoria e histórico imutável.

### Camada 4 — Contexto e Associação
Conectar itens desconexos (Ex: Associação Pré-SEI → SEI; Vínculos entre processos).

### Camada 5 — Produção Documental + IA
Gerar minutas fundamentadas. Input estruturado → Output estruturado (TXT/JSON).  
*Nota: A IA não decide, apenas prepara.*

### Camada 6 — Segurança
Nginx limitando acesso + API Key no Header. Sem acesso automático a sistemas oficiais.

---

## 3. Modelo de Dados (Schema Recomendado)

### 1) Tabela `sei_event` (Já existente como `eventos_judiciais`)
- `id` (PK)
- `sei_numero` (text, indexado)
- `tipo_evento` (text)
- `fonte` (text)
- `evento_em` (timestamptz)
- `observacoes` (text)
- `created_at` (timestamptz)

### 2) Tabela `pre_demanda` (Para demandas informais)
- `id` (PK)
- `pre_id` (text, único, ex: PRE-2026-001)
- `solicitante` (text)
- `assunto` (text)
- `status` (text: aberta, aguardando_sei, associada)
- `created_at`, `updated_at`

### 3) Tabela `pre_to_sei_link` (A Ponte)
- `id` (PK)
- `pre_id` (FK)
- `sei_numero` (Indexado)
- `linked_at` (timestamptz)  
*Regra: Uma pré-demanda vira um SEI.*

---

## 4. Endpoints (API Interna N8N)

### Existentes:
- ✅ `POST /webhook/sei/evento` (Registro de evento com número)

### Planejados:
- `POST /webhook/presei/criar` (Nova demanda informal)
- `POST /webhook/presei/associar-sei` (Vincular demanda ao processo)
- `POST /webhook/pendencias/listar` (Para o Front-end)

---

## 5. Fluxo Mental "Mundo Real"

1. **Antes do SEI:** Chega pedido informal -> Registra na tabela `pre_demanda` (Gera ID Provisório).
2. **Nascimento:** Cria processo no SEI -> Associa ID Provisório ao `sei_numero` na tabela `pre_to_sei_link`.
3. **Andamento:** Registra eventos na `sei_event` (Ofícios, Despachos).
4. **Documentos:** Solicita minuta via IA -> Sistema gera texto -> Humano revisa e usa no SEI.

---

## 6. Arquitetura RAG (Integração 3.0)

### 6.1 Visão Geral da Evolução

O sistema evoluiu de uma "Memória Administrativa" para um **Motor de Automação de Pareceres e Normas** baseado em RAG (Retrieval-Augmented Generation). Esta integração migra o ecossistema de "Gems Especializados" (ferramentas manuais baseadas em CSV/Excel) para uma arquitetura Database-First totalmente automatizada.

### 6.2 Componentes da Arquitetura RAG

#### A) Supabase como Fonte da Verdade (Índices)

**Schema:** `adminlog`

**Tabela: `normas_index`**
- `id` (PK, UUID)
- `identificador` (text, único - ex: "RES-001-2024")
- `tipo_norma` (text - Resolução, Portaria, Instrução Normativa)
- `titulo` (text)
- `ementa` (text)
- `orgao_emissor` (text)
- `data_publicacao` (date)
- `url_original` (text - link para PDF original)
- `google_sheet_chunks_url` (text - link para Google Sheet com chunks)
- `status` (text - ativo, revogado, suspenso)
- `tags` (text[] - array de tags para busca)
- `created_at`, `updated_at` (timestamptz)

**Tabela: `modelos_index`**
- `id` (PK, UUID)
- `identificador` (text, único - ex: "MOD-OFICIO-001")
- `tipo_documento` (text - Ofício, Despacho, Parecer, Informação)
- `titulo` (text)
- `descricao` (text)
- `google_doc_template_url` (text - link para Google Doc modelo)
- `variaveis_disponiveis` (jsonb - mapeamento de variáveis do template)
- `tags` (text[])
- `created_at`, `updated_at` (timestamptz)

#### B) Orquestração n8n + Google Workspace

**Autenticação: Google Service Account**

Para permitir que o n8n acesse Google Sheets e Google Drive de forma automatizada, foi configurada uma Service Account:

- **Projeto Google Cloud:** `JMU-Automation`
- **Service Account:** `n8n-bot` (Editor)
- **E-mail do Robô:** (campo `client_email` no arquivo JSON de credenciais)
- **Autenticação:** Chave JSON armazenada como credencial no n8n
- **APIs Ativadas:**
  - **Google Sheets API:** Leitura e escrita de chunks de normas
  - **Google Drive API:** Upload e manipulação de PDFs
- **Planilha Mestre Compartilhada:**
  - Nome: `Normas_Atomicas_JMU`
  - ID: `1Emu8IWDuS4yIS_8vQ_wPrZPqCNTkUBfMQFuVYWvFHVI`
  - Permissão: Service Account adicionada como **Editor**
- **Status:** ✅ VALIDADO (11/02/2026) - Teste de conexão bem-sucedido

**Workflow 1: Indexador de Normas (Chunking)**
- **Status:** ✅ ATIVO E CORRIGIDO EM PRODUÇÃO (12/02/2026)
- **Workflow ID ativo:** `KbaYi3M7DMm3FhPe`
- **Referência de código:** [Ver JSON](../docs/n8n/JMU_Indexador_Atomico.json)
- **Trigger:** Upload de PDF via Appsmith ou Webhook
- **Processamento:**
  1. Recebe PDF da norma
  2. Envia para Gemini API para chunking (3-5 páginas por chunk)
  3. Gemini retorna estrutura com 8 colunas
  4. Normaliza o JSON de saída em 8 colunas (Code node de parse)
  5. Escreve em `Normas_Atomicas_JMU` (`Página1`) com `append` + `autoMapInputData`
  6. Salva link do Google Sheet em `normas_index.google_sheet_chunks_url`

**Correções aplicadas em 12/02/2026 (produção)**
- Nó Google Sheets apontado para planilha real `Normas_Atomicas_JMU` (ID `1Emu8IWDuS4yIS_8vQ_wPrZPqCNTkUBfMQFuVYWvFHVI`), aba `Página1`, operação `append`.
- Nó Gemini com body JSON estruturado (antes incompleto).
- Nó de parse robusto para normalizar chaves de saída antes da escrita.
- Bloqueio do caminho direto `Fatiador -> Salvar na Planilha` para evitar escrita indevida sem normalização.

**Workflow 2: Gerador de Modelos**
- **Trigger:** Webhook `POST /webhook/modelo/criar`
- **Processamento:**
  1. Recebe dados do modelo (tipo, título, template base)
  2. Cria Google Doc formatado
  3. Insere marcadores de variáveis (ex: `{{numero_sei}}`, `{{interessado}}`)
  4. Salva link em `modelos_index.google_doc_template_url`

**Workflow 3: Agente RAG (Assessor de Elite)**
- **Trigger:** Solicitação de parecer/documento via Appsmith
- **Processamento (Advanced AI nodes):**
  1. Recebe contexto da demanda (número SEI, assunto, tipo de documento)
  2. **Tool 1 - Query Supabase:** Busca normas relevantes em `normas_index` por tags/assunto
  3. **Tool 2 - Read Google Sheets:** Lê chunks específicos das normas encontradas
  4. **Tool 3 - Get Template:** Busca modelo adequado em `modelos_index`
  5. **Tool 4 - Read Google Doc:** Lê template do Google Doc
  6. **Geração:** LLM (Gemini/GPT-4) gera documento fundamentado
  7. **Output:** Cria novo Google Doc ou retorna texto para Appsmith

#### C) Integração com Appsmith

**Nova Interface: "Biblioteca de Normas"**
- Listagem de normas indexadas (query em `normas_index`)
- Upload de novas normas (trigger workflow de chunking)
- Visualização de chunks (iframe do Google Sheet)

**Nova Interface: "Gerador de Documentos"**
- Seleção de tipo de documento
- Preenchimento de variáveis
- Botão "Gerar com IA" (chama Agente RAG)
- Preview e edição do documento gerado

### 6.3 Fluxo de Dados RAG

```
┌─────────────┐
│  Appsmith   │ (Upload PDF norma)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ n8n Workflow│ (Indexador)
│   Chunking  │
└──────┬──────┘
       │
       ├──► Gemini API (Chunking 3-5 páginas)
       │
       ├──► Google Sheets (Salva chunks estruturados)
       │
       ▼
┌─────────────┐
│  Supabase   │ (normas_index + link para Sheet)
└─────────────┘

--- GERAÇÃO DE DOCUMENTO ---

┌─────────────┐
│  Appsmith   │ (Solicita parecer)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ n8n Agente  │ (Advanced AI)
│     RAG     │
└──────┬──────┘
       │
       ├──► Tool: SELECT em normas_index (Supabase)
       ├──► Tool: Read Google Sheets (chunks relevantes)
       ├──► Tool: Get Template (modelos_index)
       ├──► LLM: Gera documento fundamentado
       │
       ▼
┌─────────────┐
│ Google Docs │ (Documento final) ──► Appsmith (preview)
└─────────────┘
```

### 6.4 Regras de Negócio RAG

1. **Chunking Inteligente:** Respeitar estrutura de artigos/parágrafos (não quebrar no meio de dispositivo).
2. **Versionamento:** Normas revogadas mantêm `status='revogado'` mas permanecem no índice (histórico).
3. **Cache de Chunks:** Google Sheets funcionam como cache estruturado (evita re-processar PDFs).
4. **Auditoria de Geração:** Toda geração de documento via IA registra em tabela `ai_generation_log`:
   - `id`, `demanda_id`, `normas_utilizadas` (array de IDs), `modelo_id`, `prompt_enviado`, `documento_gerado_url`, `generated_at`
5. **Validação Humana:** Documentos gerados são sempre **sugestões** - humano revisa antes de usar oficialmente.
