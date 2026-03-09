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
