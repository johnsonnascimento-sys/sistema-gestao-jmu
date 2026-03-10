CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS adminlog.interessados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(255) NOT NULL,
  matricula varchar(50),
  cpf varchar(14),
  data_nascimento date,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interessados_nome ON adminlog.interessados (nome);
CREATE INDEX IF NOT EXISTS idx_interessados_cpf ON adminlog.interessados (cpf);

DROP TRIGGER IF EXISTS trg_interessados_updated_at ON adminlog.interessados;
CREATE TRIGGER trg_interessados_updated_at
BEFORE UPDATE ON adminlog.interessados
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();

CREATE TABLE IF NOT EXISTS adminlog.setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla varchar(30) NOT NULL UNIQUE,
  nome_completo varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setores_nome_completo ON adminlog.setores (nome_completo);

DROP TRIGGER IF EXISTS trg_setores_updated_at ON adminlog.setores;
CREATE TRIGGER trg_setores_updated_at
BEFORE UPDATE ON adminlog.setores
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();

ALTER TABLE adminlog.pre_demanda
  ADD COLUMN IF NOT EXISTS prazo_final date,
  ADD COLUMN IF NOT EXISTS data_conclusao date,
  ADD COLUMN IF NOT EXISTS numero_judicial varchar(100),
  ADD COLUMN IF NOT EXISTS anotacoes text,
  ADD COLUMN IF NOT EXISTS setor_atual_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_pre_demanda_setor_atual'
      AND connamespace = 'adminlog'::regnamespace
  ) THEN
    ALTER TABLE adminlog.pre_demanda
      ADD CONSTRAINT fk_pre_demanda_setor_atual
      FOREIGN KEY (setor_atual_id)
      REFERENCES adminlog.setores(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pre_demanda_metadata_gin ON adminlog.pre_demanda USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_pre_demanda_setor_atual_id ON adminlog.pre_demanda (setor_atual_id);
CREATE INDEX IF NOT EXISTS idx_pre_demanda_prazo_final ON adminlog.pre_demanda (prazo_final);

CREATE TABLE IF NOT EXISTS adminlog.demanda_interessados (
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  interessado_id uuid NOT NULL REFERENCES adminlog.interessados(id) ON DELETE RESTRICT,
  papel varchar(50) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  PRIMARY KEY (pre_demanda_id, interessado_id)
);

CREATE INDEX IF NOT EXISTS idx_demanda_interessados_interessado_id ON adminlog.demanda_interessados (interessado_id);

CREATE TABLE IF NOT EXISTS adminlog.demanda_vinculos (
  origem_pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  destino_pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  PRIMARY KEY (origem_pre_demanda_id, destino_pre_demanda_id),
  CONSTRAINT chk_demanda_vinculos_self CHECK (origem_pre_demanda_id <> destino_pre_demanda_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demanda_vinculos_normalized
ON adminlog.demanda_vinculos (
  LEAST(origem_pre_demanda_id, destino_pre_demanda_id),
  GREATEST(origem_pre_demanda_id, destino_pre_demanda_id)
);

CREATE TABLE IF NOT EXISTS adminlog.andamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  data_hora timestamptz NOT NULL DEFAULT NOW(),
  descricao text NOT NULL,
  tipo varchar(30) NOT NULL DEFAULT 'manual',
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_andamentos_pre_demanda_data_hora
ON adminlog.andamentos (pre_demanda_id, data_hora DESC);

CREATE TABLE IF NOT EXISTS adminlog.tarefas_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo varchar(20) NOT NULL,
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  concluida_por_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tarefas_pendentes_pre_demanda
ON adminlog.tarefas_pendentes (pre_demanda_id, concluida, created_at DESC);

CREATE OR REPLACE FUNCTION adminlog.fn_sync_pre_demanda_data_conclusao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'encerrada' AND COALESCE(OLD.status, '') <> 'encerrada' THEN
    NEW.data_conclusao = CURRENT_DATE;
  ELSIF NEW.status <> 'encerrada' AND COALESCE(OLD.status, '') = 'encerrada' THEN
    NEW.data_conclusao = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_demanda_data_conclusao ON adminlog.pre_demanda;
CREATE TRIGGER trg_pre_demanda_data_conclusao
BEFORE UPDATE OF status ON adminlog.pre_demanda
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_sync_pre_demanda_data_conclusao();

INSERT INTO adminlog.setores (sigla, nome_completo)
VALUES
  ('DIPES', 'Diretoria de Pessoal'),
  ('GADIR', 'Gabinete da Diretoria')
ON CONFLICT (sigla) DO NOTHING;
