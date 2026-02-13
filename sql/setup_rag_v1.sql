-- =====================================================
-- SETUP RAG V1 (Fundacao) - SISTEMA DE GESTAO JMU
-- =====================================================
-- Objetivo:
-- - Criar base minima para RAG: adminlog.normas_index (chunks + embeddings)
-- - Criar auditoria: adminlog.ai_generation_log
-- - Garantir pgvector (extension vector) habilitada
--
-- Observacao:
-- - Se tabelas antigas existirem, elas serao preservadas via rename *_legacy_20260213.
-- - Script idempotente: pode ser executado mais de uma vez.
-- =====================================================

-- 0) Schema base
create schema if not exists adminlog;

-- 1) Habilitar a extensao de Vetores (pgvector)
create extension if not exists vector with schema extensions;

-- 2) Preservar tabelas antigas (se existirem) para evitar conflito de schema
alter table if exists adminlog.normas_index rename to normas_index_legacy_20260213;
alter table if exists adminlog.ai_generation_log rename to ai_generation_log_legacy_20260213;

-- 3) Criar a tabela de Indexacao (Memoria de Longo Prazo)
create table if not exists adminlog.normas_index (
  id bigint primary key generated always as identity,
  norma_id text not null,
  chunk_index int not null default 0,
  conteudo_texto text,
  embedding vector(768),
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4) Criar indice de busca rapida (HNSW)
create index if not exists normas_index_embedding_hnsw_idx
  on adminlog.normas_index using hnsw (embedding vector_cosine_ops);

-- 5) Criar tabela de Auditoria de Geracao
create table if not exists adminlog.ai_generation_log (
  id bigint primary key generated always as identity,
  input_prompt text,
  output_response text,
  model_used text,
  tokens_used int,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

