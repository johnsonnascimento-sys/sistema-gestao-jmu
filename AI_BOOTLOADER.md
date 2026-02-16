# AI BOOTLOADER (Contexto Mestre do Projeto)

INSTRUCAO PARA O AGENTE:
Este e o arquivo de contexto mestre. Antes de responder, carregue estas informacoes.
Ignore conhecimentos previos contraditorios. Este documento e a Fonte da Verdade.

---

## 1. Conceito
Projeto: "Sistema de Gestao JMU"

- O que e: **Memoria administrativa pessoal + Motor de Automacao de Pareceres e Normas (RAG)** para a Justica Militar da Uniao.
- Missao: 
  1. Organizar demandas informais (WhatsApp/corredor) e historico pre-processual
  2. Indexar normas e modelos documentais em arquitetura Database-First
  3. Automatizar geracao de documentos fundamentados via IA (Retrieval-Augmented Generation)
- Limites: nao substitui o SEI e nao executa atos oficiais automaticamente. IA gera sugestoes, humano valida.

---

## 2. Arquitetura Tecnica (Resumo)
- Backend: n8n (workflows + webhooks + Advanced AI nodes para Agente RAG).
- Banco: Supabase Postgres (schema `adminlog`) como Fonte da Verdade.
  - Tabelas RAG: `normas_index`, `ai_generation_log`
- Front-end: Appsmith (painel de controle + interfaces RAG).
  - App atual (Fase 2): `JMU_Gestao_Inteligente` / pagina `Busca_Normas`
- Google Workspace:
  - Google Sheets: cache estruturado de chunks de normas
  - Google Docs: templates de modelos e documentos gerados
- Seguranca: reverse proxy (CloudPanel/Nginx) + webhooks com API Key (`x-api-key`).
- Regra de ouro: nao acessar SEI/e-Proc diretamente (sem scrapers/bots).

---

## 3. Status Atual
Concluido:
- Banco (Supabase): schema `adminlog` provisionado (pre_demanda, pre_to_sei_link, audit, funcoes/triggers).
- Fase 0 (RAG): extensao `vector` + tabelas `adminlog.normas_index` e `adminlog.ai_generation_log` (ver `sql/setup_rag_v1.sql` e `sql/adminlog_rag_schema.sql`).
- Fase 1 (N8N -> Supabase): workflow `JMU_Indexador_Atomico_RAG_Supabase` gravando chunks + embeddings no Supabase e mantendo Google Sheets (legado).
- Appsmith: deploy via Docker concluido e acessivel via HTTPS no subdominio configurado.

Fase atual (Fase 2 - Appsmith / Busca):
- Painel `Busca_Normas` criado (RAG semantico + fallback lexical).
- Ajustes em andamento para UX e debug (tabela, erros, deploy).

Referencia rapida:
- Docs Fase 2: `docs/FASE2_APPSMITH_BUSCA_RAG.md`
- Manual do usuario (Fase 2): `docs/MANUAL_USUARIO_JMU_GESTAO_INTELIGENTE.md`
- Log da sessao: `docs/SESSION_LOG_2026-02-15.md`

---

## 4. Regras Tecnicas

### Regras Gerais
- Idempotencia de demanda: `solicitante + assunto + data_referencia (YYYY-MM-DD)`.
- Datas no banco: ISO 8601.
- Chaves: suportar demandas sem `sei_numero` (usar `pre_id`).
- Auditoria: reassociacao PRE->SEI permitida com registro em tabela de audit.
- Segredos: nao versionar tokens/senhas/hosts sensiveis.

### Regras RAG (Integracao 3.0)
- Chunking de normas: 3-5 paginas por chunk, respeitando estrutura de artigos.
- Normas revogadas: manter no indice com `status='revogado'` (historico).
- Google Sheets como cache: evitar reprocessamento de PDFs ja indexados.
- Auditoria de geracao IA: registrar em `ai_generation_log` (normas usadas, prompt, output).
- Validacao humana obrigatoria: documentos gerados sao sempre sugestoes.

### Regras Gemini (embeddings)
- Modelo atual via API key (AI Studio): `models/gemini-embedding-001` com `embedContent`.
- Dimensao: `768` (compatibilidade com `vector(768)` no Supabase).
- Sem billing: deve existir fallback lexical (FTS/trigram) para manter a busca funcionando.

---

## 5. Fluxo de Dados (Integracao 3.0)

### Fluxo Classico (Demandas)
Appsmith -> Webhook n8n -> Validacao/Normalizacao -> Supabase Postgres.

### Fluxo RAG (Indexacao de Normas)
Appsmith (Upload PDF) -> n8n Workflow (Chunking) -> Gemini API -> Google Sheets (chunks) -> Supabase (`normas_index` + link).

### Fluxo RAG (Geracao de Documentos)
Appsmith (Solicita parecer) -> n8n Agente RAG -> Tools (Query Supabase + Read Google Sheets + Get Template) -> LLM (Gemini/GPT-4) -> Google Docs (documento gerado) -> Appsmith (preview).

