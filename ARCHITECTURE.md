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
- **Atualização 12/02/2026:** rota `/webhook/` do domínio n8n liberada para encaminhamento ao n8n (remoção de bloqueio por `deny all`), restabelecendo execuções externas.

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

### 6.2 Fluxos de Ingestão (Pipelines)

#### 6.2.1 Pipeline A: Normas Internas (JMU)
* **Alvo:** Portarias, Atos e Resoluções próprias da JMU.
* **Entrada:** Arquivo PDF (Upload Manual).
* **Armazenamento:** Arquivo original salvo no Google Drive (Pasta `00_JMU_Normas_Originais`).
* **Processamento:** Extração de texto via OCR/Loader -> Chunking por caracteres/tokens -> Vetorização.

#### 6.2.2 Pipeline B: Legislação Federal (Planalto)
* **Alvo:** Leis Federais (8.112, CPM, CPPM) hospedadas no Planalto.gov.
* **Entrada:** URL (Link da Web).
* **Armazenamento:** Apenas metadados e link de referência (não salvamos HTML estático).
* **Processamento:** Parseamento do DOM HTML -> Remoção de tags de revogação (`<strike>`) -> Chunking Semântico (por Artigo) -> Vetorização.

### 6.3 Banco de Dados (Supabase + Google Drive)

#### 6.3.1 Estrutura Híbrida
O sistema utiliza uma abordagem híbrida:
1.  **Dados Estruturados & Vetoriais (Supabase):** O "Cérebro". Armazena textos processados e vetores de IA.
2.  **Arquivos Não-Estruturados (Google Drive):** O "Arquivo Morto". Armazena PDFs originais para segurança jurídica.

#### 6.3.2 Schema do Banco de Dados (Supabase - PostgreSQL)

##### Tabela: `adminlog.normas_index` (Memória de Longo Prazo)
Tabela principal do RAG.
* `id` (BigInt, PK): Identificador único do fragmento.
* `norma_id` (Text): ID da norma (ex: "PORTARIA-123-2026" ou "LEI-8112").
* `chunk_index` (Int): Sequencial do fragmento (0, 1, 2...).
* `conteudo_texto` (Text): O texto real do fragmento.
* `embedding` (Vector[768]): O vetor matemático gerado pelo Gemini.
* `metadata` (JSONB): Dados flexíveis (Ex: `{"origem": "pipeline_a", "drive_id": "xyz", "vigencia": "ativa"}`).
* `created_at` (Timestamp): Data de indexação.

##### Tabela: `adminlog.ai_generation_log` (Auditoria)
Registra interações para controle de custos e análise de uso.
* `id` (BigInt, PK): Identificador da transação.
* `input_prompt` (Text): O que foi pedido à IA.
* `output_response` (Text): O que a IA respondeu.
* `model_used` (Text): Modelo utilizado (ex: "gemini-2.0-flash").
* `tokens_used` (Int): Consumo de tokens.
* `created_at` (Timestamp): Data da geração.

#### 6.3.3 Estrutura de Pastas (Google Drive)
* **Pasta Raiz:** `00_JMU_Normas_Originais`
* **ID da Pasta:** `1QEZGPtlmg2ladDSyFdv7S7foNSpgiaqk`
* **Conteúdo:** Apenas arquivos PDF originais do Pipeline A.

### 6.4 Regras de Negócio RAG

1. **Chunking Inteligente:** Respeitar estrutura de artigos/parágrafos (não quebrar no meio de dispositivo).
2. **Versionamento:** Normas revogadas mantêm `status='revogado'` mas permanecem no índice (histórico).
3. **Auditoria de Geração:** Toda geração de documento via IA registra em tabela `adminlog.ai_generation_log`.
4. **Validação Humana:** Documentos gerados são sempre **sugestões** - humano revisa antes de usar oficialmente.

### 6.5 Busca (Appsmith)

O painel de busca RAG é implementado no Appsmith (Fase 2) com 2 caminhos:

1. **Busca semântica (vetorial):**
   - Appsmith chama o Gemini Embeddings e recebe `embedding.values` (768 dims).
   - Appsmith chama a RPC `match_documents(query_embedding, threshold, count)` no Supabase.

2. **Fallback "no-billing" (lexical/FTS):**
   - Se não existir API key (ou semântica falhar), Appsmith chama `match_documents_lexical(query_text, count)`.
   - Objetivo: manter a busca funcionando mesmo sem embeddings.

Observação sobre modelos:
- Com API key do Google AI Studio, o modelo usado para `embedContent` foi `models/gemini-embedding-001` com `outputDimensionality=768`.
- `text-embedding-004` não estava disponível para `embedContent` no endpoint `v1beta` nesse setup.
