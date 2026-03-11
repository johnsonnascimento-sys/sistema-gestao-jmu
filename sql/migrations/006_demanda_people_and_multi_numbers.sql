CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

  RETURN FORMAT('DEMANDA-%s-%s', LPAD(v_num::text, 4, '0'), v_ano);
END;
$$;

INSERT INTO adminlog.setores (id, sigla, nome_completo)
VALUES (gen_random_uuid(), 'SETAD2A2CJM', 'SETAD2A2CJM')
ON CONFLICT (sigla) DO UPDATE
SET nome_completo = EXCLUDED.nome_completo;

CREATE TABLE IF NOT EXISTS adminlog.demanda_sei_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  sei_numero varchar(64) NOT NULL,
  principal boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demanda_sei_vinculos_numero
ON adminlog.demanda_sei_vinculos (pre_demanda_id, sei_numero);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demanda_sei_vinculos_principal
ON adminlog.demanda_sei_vinculos (pre_demanda_id)
WHERE principal = true;

CREATE INDEX IF NOT EXISTS idx_demanda_sei_vinculos_pre_demanda
ON adminlog.demanda_sei_vinculos (pre_demanda_id, principal DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS adminlog.demanda_numeros_judiciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  numero_judicial varchar(100) NOT NULL,
  principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demanda_numeros_judiciais_numero
ON adminlog.demanda_numeros_judiciais (pre_demanda_id, numero_judicial);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demanda_numeros_judiciais_principal
ON adminlog.demanda_numeros_judiciais (pre_demanda_id)
WHERE principal = true;

CREATE INDEX IF NOT EXISTS idx_demanda_numeros_judiciais_pre_demanda
ON adminlog.demanda_numeros_judiciais (pre_demanda_id, principal DESC, created_at DESC);

INSERT INTO adminlog.demanda_sei_vinculos (pre_demanda_id, sei_numero, principal, observacoes, created_at, created_by_user_id)
SELECT
  pd.id,
  pts.sei_numero,
  true,
  pts.observacoes,
  coalesce(pts.linked_at, pts.updated_at, now()),
  pts.linked_by_user_id
FROM adminlog.pre_demanda pd
INNER JOIN adminlog.pre_to_sei_link pts ON pts.pre_id = pd.pre_id
WHERE NOT EXISTS (
  SELECT 1
  FROM adminlog.demanda_sei_vinculos dsv
  WHERE dsv.pre_demanda_id = pd.id
    AND dsv.sei_numero = pts.sei_numero
);

INSERT INTO adminlog.demanda_numeros_judiciais (pre_demanda_id, numero_judicial, principal, created_at, created_by_user_id)
SELECT
  pd.id,
  pd.numero_judicial,
  true,
  pd.updated_at,
  pd.created_by_user_id
FROM adminlog.pre_demanda pd
WHERE pd.numero_judicial IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM adminlog.demanda_numeros_judiciais dnj
    WHERE dnj.pre_demanda_id = pd.id
      AND dnj.numero_judicial = pd.numero_judicial
  );
