CREATE TABLE IF NOT EXISTS adminlog.pre_demanda_delete_audit (
  id bigserial PRIMARY KEY,
  pre_id text NOT NULL,
  assunto text NOT NULL,
  solicitante text NOT NULL,
  status text NOT NULL,
  sei_numero text,
  numero_judicial text,
  motivo text NOT NULL,
  confirmacao text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  deleted_by_name text NOT NULL,
  deleted_by_email text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pre_demanda_delete_audit_deleted_at
  ON adminlog.pre_demanda_delete_audit (deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_demanda_delete_audit_pre_id
  ON adminlog.pre_demanda_delete_audit (pre_id, deleted_at DESC);
