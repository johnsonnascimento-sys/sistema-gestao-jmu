-- =====================================================
-- SCHEMA RAG (INTEGRAÇÃO 3.0) - SISTEMA DE GESTÃO JMU
-- =====================================================
-- Descrição: Tabelas para indexação de normas e modelos documentais
-- Requisito: A função adminlog.fn_set_updated_at() já deve existir
-- Criado em: 11/02/2026
-- =====================================================

-- Habilitar extensão UUID (caso não esteja habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: normas_index
-- =====================================================
-- Armazena o índice de normas jurídicas com links para chunks no Google Sheets
CREATE TABLE IF NOT EXISTS adminlog.normas_index (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assunto text NOT NULL,
  norma_vigente text NOT NULL,
  artigos_count integer NOT NULL DEFAULT 0,
  tags_pentagonais jsonb,
  normas_revogadas text,
  pdf_original_url text,
  google_sheets_atomic_link text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ck_normas_index_artigos_count CHECK (artigos_count >= 0)
);

-- Índices para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_normas_index_assunto 
  ON adminlog.normas_index USING gin(to_tsvector('portuguese', assunto));

CREATE INDEX IF NOT EXISTS idx_normas_index_norma_vigente 
  ON adminlog.normas_index (norma_vigente);

CREATE INDEX IF NOT EXISTS idx_normas_index_tags 
  ON adminlog.normas_index USING gin(tags_pentagonais);

CREATE INDEX IF NOT EXISTS idx_normas_index_created_at 
  ON adminlog.normas_index (created_at DESC);

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS trg_normas_index_updated_at ON adminlog.normas_index;
CREATE TRIGGER trg_normas_index_updated_at
BEFORE UPDATE ON adminlog.normas_index
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();

-- =====================================================
-- TABELA: modelos_index
-- =====================================================
-- Armazena o índice de modelos documentais com links para templates no Google Docs
CREATE TABLE IF NOT EXISTS adminlog.modelos_index (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assunto text NOT NULL,
  requisitos_dados text,
  normas_referenciadas text,
  google_doc_modelo_link text,
  destinatario_padrao text,
  tags_modelo jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Índices para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_modelos_index_assunto 
  ON adminlog.modelos_index USING gin(to_tsvector('portuguese', assunto));

CREATE INDEX IF NOT EXISTS idx_modelos_index_tags 
  ON adminlog.modelos_index USING gin(tags_modelo);

CREATE INDEX IF NOT EXISTS idx_modelos_index_created_at 
  ON adminlog.modelos_index (created_at DESC);

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS trg_modelos_index_updated_at ON adminlog.modelos_index;
CREATE TRIGGER trg_modelos_index_updated_at
BEFORE UPDATE ON adminlog.modelos_index
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();

-- =====================================================
-- TABELA: ai_generation_log (AUDITORIA)
-- =====================================================
-- Registra todas as gerações de documentos via IA para auditoria
CREATE TABLE IF NOT EXISTS adminlog.ai_generation_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  demanda_id bigint REFERENCES adminlog.pre_demanda(id) ON DELETE SET NULL,
  normas_utilizadas uuid[] NOT NULL DEFAULT '{}',
  modelo_id uuid REFERENCES adminlog.modelos_index(id) ON DELETE SET NULL,
  prompt_enviado text NOT NULL,
  documento_gerado_url text,
  generated_at timestamptz NOT NULL DEFAULT NOW(),
  metadata jsonb
);

-- Índices para auditoria e análise
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_demanda_id 
  ON adminlog.ai_generation_log (demanda_id);

CREATE INDEX IF NOT EXISTS idx_ai_generation_log_modelo_id 
  ON adminlog.ai_generation_log (modelo_id);

CREATE INDEX IF NOT EXISTS idx_ai_generation_log_generated_at 
  ON adminlog.ai_generation_log (generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_log_normas 
  ON adminlog.ai_generation_log USING gin(normas_utilizadas);

-- =====================================================
-- COMENTÁRIOS (DOCUMENTAÇÃO)
-- =====================================================
COMMENT ON TABLE adminlog.normas_index IS 'Índice de normas jurídicas com chunks armazenados no Google Sheets';
COMMENT ON COLUMN adminlog.normas_index.assunto IS 'Assunto principal da norma';
COMMENT ON COLUMN adminlog.normas_index.norma_vigente IS 'Identificador da norma vigente (ex: RES-001-2024)';
COMMENT ON COLUMN adminlog.normas_index.artigos_count IS 'Quantidade de artigos/dispositivos na norma';
COMMENT ON COLUMN adminlog.normas_index.tags_pentagonais IS 'Tags para busca semântica (formato JSONB)';
COMMENT ON COLUMN adminlog.normas_index.google_sheets_atomic_link IS 'Link para Google Sheet com chunks da norma';

COMMENT ON TABLE adminlog.modelos_index IS 'Índice de modelos documentais com templates no Google Docs';
COMMENT ON COLUMN adminlog.modelos_index.assunto IS 'Tipo/assunto do modelo (ex: Ofício, Parecer)';
COMMENT ON COLUMN adminlog.modelos_index.requisitos_dados IS 'Dados necessários para preencher o modelo';
COMMENT ON COLUMN adminlog.modelos_index.google_doc_modelo_link IS 'Link para template no Google Docs';
COMMENT ON COLUMN adminlog.modelos_index.tags_modelo IS 'Tags para categorização (formato JSONB)';

COMMENT ON TABLE adminlog.ai_generation_log IS 'Auditoria de gerações de documentos via IA (RAG)';
COMMENT ON COLUMN adminlog.ai_generation_log.normas_utilizadas IS 'Array de UUIDs das normas consultadas';
COMMENT ON COLUMN adminlog.ai_generation_log.prompt_enviado IS 'Prompt completo enviado para o LLM';
COMMENT ON COLUMN adminlog.ai_generation_log.documento_gerado_url IS 'Link para documento final gerado';

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
