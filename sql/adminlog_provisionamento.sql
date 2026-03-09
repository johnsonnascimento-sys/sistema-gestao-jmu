CREATE SCHEMA IF NOT EXISTS adminlog;

CREATE OR REPLACE FUNCTION adminlog.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS adminlog.pre_id_counter (
  ano integer PRIMARY KEY,
  ultimo_numero integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION adminlog.fn_generate_pre_id(p_data date)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_ano integer := EXTRACT(YEAR FROM p_data)::integer;
  v_num integer;
BEGIN
  INSERT INTO adminlog.pre_id_counter (ano, ultimo_numero)
  VALUES (v_ano, 1)
  ON CONFLICT (ano)
  DO UPDATE SET
    ultimo_numero = adminlog.pre_id_counter.ultimo_numero + 1,
    updated_at = NOW()
  RETURNING ultimo_numero INTO v_num;

  RETURN FORMAT('PRE-%s-%s', v_ano, LPAD(v_num::text, 3, '0'));
END;
$$;

CREATE TABLE IF NOT EXISTS adminlog.pre_demanda (
  id bigserial PRIMARY KEY,
  pre_id text NOT NULL UNIQUE,
  solicitante text NOT NULL,
  assunto text NOT NULL,
  data_referencia date NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  descricao text,
  fonte text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  solicitante_norm text GENERATED ALWAYS AS (
    lower(regexp_replace(trim(solicitante), '\s+', ' ', 'g'))
  ) STORED,
  assunto_norm text GENERATED ALWAYS AS (
    lower(regexp_replace(trim(assunto), '\s+', ' ', 'g'))
  ) STORED,
  CONSTRAINT ck_pre_demanda_status
    CHECK (status IN ('aberta', 'aguardando_sei', 'associada', 'encerrada'))
);

ALTER TABLE adminlog.pre_demanda
  ADD COLUMN IF NOT EXISTS created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pre_demanda_idempotencia
  ON adminlog.pre_demanda (solicitante_norm, assunto_norm, data_referencia);

CREATE INDEX IF NOT EXISTS idx_pre_demanda_status_data
  ON adminlog.pre_demanda (status, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_pre_demanda_created_at
  ON adminlog.pre_demanda (created_at DESC);

DROP TRIGGER IF EXISTS trg_pre_demanda_updated_at ON adminlog.pre_demanda;
CREATE TRIGGER trg_pre_demanda_updated_at
BEFORE UPDATE ON adminlog.pre_demanda
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();

CREATE TABLE IF NOT EXISTS adminlog.pre_to_sei_link (
  id bigserial PRIMARY KEY,
  pre_id text NOT NULL UNIQUE REFERENCES adminlog.pre_demanda(pre_id) ON UPDATE CASCADE ON DELETE CASCADE,
  sei_numero text NOT NULL,
  sei_numero_inicial text,
  linked_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  observacoes text
);

ALTER TABLE adminlog.pre_to_sei_link
  ADD COLUMN IF NOT EXISTS sei_numero_inicial text;

ALTER TABLE adminlog.pre_to_sei_link
  ADD COLUMN IF NOT EXISTS linked_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL;

UPDATE adminlog.pre_to_sei_link
SET sei_numero_inicial = coalesce(sei_numero_inicial, sei_numero);

CREATE INDEX IF NOT EXISTS idx_pre_to_sei_link_sei_numero
  ON adminlog.pre_to_sei_link (sei_numero);

DROP TRIGGER IF EXISTS trg_pre_to_sei_link_updated_at ON adminlog.pre_to_sei_link;
CREATE TRIGGER trg_pre_to_sei_link_updated_at
BEFORE UPDATE ON adminlog.pre_to_sei_link
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();

CREATE TABLE IF NOT EXISTS adminlog.pre_to_sei_link_audit (
  id bigserial PRIMARY KEY,
  pre_id text NOT NULL REFERENCES adminlog.pre_demanda(pre_id) ON DELETE CASCADE,
  sei_numero_anterior text NOT NULL,
  sei_numero_novo text NOT NULL,
  motivo text,
  registrado_em timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE adminlog.pre_to_sei_link_audit
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE adminlog.pre_to_sei_link_audit
  ADD COLUMN IF NOT EXISTS changed_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pre_to_sei_link_audit_pre_id
  ON adminlog.pre_to_sei_link_audit (pre_id, registrado_em DESC);

CREATE TABLE IF NOT EXISTS adminlog.pre_demanda_status_audit (
  id bigserial PRIMARY KEY,
  pre_id text NOT NULL REFERENCES adminlog.pre_demanda(pre_id) ON DELETE CASCADE,
  status_anterior text NOT NULL,
  status_novo text NOT NULL,
  motivo text,
  observacoes text,
  changed_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  registrado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pre_demanda_status_audit_anterior
    CHECK (status_anterior IN ('aberta', 'aguardando_sei', 'associada', 'encerrada')),
  CONSTRAINT ck_pre_demanda_status_audit_novo
    CHECK (status_novo IN ('aberta', 'aguardando_sei', 'associada', 'encerrada'))
);

CREATE INDEX IF NOT EXISTS idx_pre_demanda_status_audit_pre_id
  ON adminlog.pre_demanda_status_audit (pre_id, registrado_em DESC);

CREATE TABLE IF NOT EXISTS adminlog.admin_user_audit (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  actor_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  target_user_id bigint NOT NULL REFERENCES adminlog.app_user(id) ON DELETE RESTRICT,
  target_email text NOT NULL,
  target_name text NOT NULL,
  target_role text NOT NULL CHECK (target_role IN ('admin', 'operador')),
  target_active boolean NOT NULL,
  name_anterior text,
  name_novo text,
  role_anterior text CHECK (role_anterior IN ('admin', 'operador')),
  role_novo text CHECK (role_novo IN ('admin', 'operador')),
  active_anterior boolean,
  active_novo boolean,
  registrado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_admin_user_audit_action
    CHECK (action IN ('user_created', 'user_name_changed', 'user_role_changed', 'user_activated', 'user_deactivated', 'user_password_reset'))
);

CREATE INDEX IF NOT EXISTS idx_admin_user_audit_registrado_em
  ON adminlog.admin_user_audit (registrado_em DESC);

CREATE INDEX IF NOT EXISTS idx_admin_user_audit_target_user
  ON adminlog.admin_user_audit (target_user_id, registrado_em DESC);
