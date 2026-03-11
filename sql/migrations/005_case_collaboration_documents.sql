CREATE TABLE IF NOT EXISTS adminlog.demanda_setores_fluxo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  setor_id uuid NOT NULL REFERENCES adminlog.setores(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'ativo',
  origem_setor_id uuid REFERENCES adminlog.setores(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  concluida_em timestamptz,
  concluida_por_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demanda_setores_fluxo_ativo
ON adminlog.demanda_setores_fluxo (pre_demanda_id, setor_id)
WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_demanda_setores_fluxo_pre_demanda
ON adminlog.demanda_setores_fluxo (pre_demanda_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS adminlog.demanda_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  nome_arquivo varchar(255) NOT NULL,
  mime_type varchar(160) NOT NULL,
  tamanho_bytes integer NOT NULL,
  descricao text,
  conteudo bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_demanda_documentos_pre_demanda
ON adminlog.demanda_documentos (pre_demanda_id, created_at DESC);

CREATE TABLE IF NOT EXISTS adminlog.demanda_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  formato varchar(20) NOT NULL DEFAULT 'markdown',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  edited_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_demanda_comentarios_pre_demanda
ON adminlog.demanda_comentarios (pre_demanda_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_demanda_comentarios_updated_at ON adminlog.demanda_comentarios;
CREATE TRIGGER trg_demanda_comentarios_updated_at
BEFORE UPDATE ON adminlog.demanda_comentarios
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();

INSERT INTO adminlog.demanda_setores_fluxo (pre_demanda_id, setor_id, status, created_at)
SELECT pd.id, pd.setor_atual_id, 'ativo', pd.updated_at
FROM adminlog.pre_demanda pd
WHERE pd.setor_atual_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM adminlog.demanda_setores_fluxo fluxo
    WHERE fluxo.pre_demanda_id = pd.id
      AND fluxo.setor_id = pd.setor_atual_id
      AND fluxo.status = 'ativo'
  );
