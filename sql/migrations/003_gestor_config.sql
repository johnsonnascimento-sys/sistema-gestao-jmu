CREATE TABLE IF NOT EXISTS adminlog.gestor_config (
  id smallint PRIMARY KEY DEFAULT 1,
  queue_attention_days integer NOT NULL CHECK (queue_attention_days > 0),
  queue_critical_days integer NOT NULL CHECK (queue_critical_days >= queue_attention_days),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  CONSTRAINT ck_gestor_config_singleton CHECK (id = 1)
);

INSERT INTO adminlog.gestor_config (
  id,
  queue_attention_days,
  queue_critical_days
)
VALUES (1, 2, 5)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_gestor_config_updated_at ON adminlog.gestor_config;
CREATE TRIGGER trg_gestor_config_updated_at
BEFORE UPDATE ON adminlog.gestor_config
FOR EACH ROW
EXECUTE FUNCTION adminlog.fn_set_updated_at();
