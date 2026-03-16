WITH ranked AS (
  SELECT
    id,
    nome,
    cargo,
    created_at,
    row_number() OVER (PARTITION BY nome, cargo ORDER BY created_at, id) AS rn,
    first_value(id) OVER (PARTITION BY nome, cargo ORDER BY created_at, id) AS keeper_id
  FROM adminlog.interessados
),
duplicate_groups AS (
  SELECT nome, cargo
  FROM adminlog.interessados
  GROUP BY nome, cargo
  HAVING count(*) > 1
),
keepers AS (
  SELECT r.id, r.nome, r.cargo
  FROM ranked r
  INNER JOIN duplicate_groups dg
    ON dg.nome = r.nome
   AND dg.cargo IS NOT DISTINCT FROM r.cargo
  WHERE r.rn = 1
),
merged_values AS (
  SELECT
    k.id AS keeper_id,
    COALESCE(
      i.matricula,
      (
        SELECT i2.matricula
        FROM adminlog.interessados i2
        WHERE i2.nome = i.nome
          AND i2.cargo IS NOT DISTINCT FROM i.cargo
          AND i2.matricula IS NOT NULL
        ORDER BY i2.created_at, i2.id
        LIMIT 1
      )
    ) AS matricula,
    COALESCE(
      i.cpf,
      (
        SELECT i2.cpf
        FROM adminlog.interessados i2
        WHERE i2.nome = i.nome
          AND i2.cargo IS NOT DISTINCT FROM i.cargo
          AND i2.cpf IS NOT NULL
        ORDER BY i2.created_at, i2.id
        LIMIT 1
      )
    ) AS cpf,
    COALESCE(
      i.data_nascimento,
      (
        SELECT i2.data_nascimento
        FROM adminlog.interessados i2
        WHERE i2.nome = i.nome
          AND i2.cargo IS NOT DISTINCT FROM i.cargo
          AND i2.data_nascimento IS NOT NULL
        ORDER BY i2.created_at, i2.id
        LIMIT 1
      )
    ) AS data_nascimento
  FROM keepers k
  INNER JOIN adminlog.interessados i ON i.id = k.id
),
repoint_links AS (
  INSERT INTO adminlog.demanda_interessados (pre_demanda_id, interessado_id, papel, created_at, created_by_user_id)
  SELECT DISTINCT
    di.pre_demanda_id,
    r.keeper_id,
    di.papel,
    di.created_at,
    di.created_by_user_id
  FROM adminlog.demanda_interessados di
  INNER JOIN ranked r ON r.id = di.interessado_id
  INNER JOIN duplicate_groups dg
    ON dg.nome = r.nome
   AND dg.cargo IS NOT DISTINCT FROM r.cargo
  WHERE r.rn > 1
  ON CONFLICT (pre_demanda_id, interessado_id) DO NOTHING
  RETURNING pre_demanda_id
),
delete_old_links AS (
  DELETE FROM adminlog.demanda_interessados di
  USING ranked r, duplicate_groups dg
  WHERE di.interessado_id = r.id
    AND dg.nome = r.nome
    AND dg.cargo IS NOT DISTINCT FROM r.cargo
    AND r.rn > 1
  RETURNING di.pre_demanda_id
),
update_keepers AS (
  UPDATE adminlog.interessados i
  SET
    matricula = mv.matricula,
    cpf = mv.cpf,
    data_nascimento = mv.data_nascimento
  FROM merged_values mv
  WHERE i.id = mv.keeper_id
  RETURNING i.id
)
DELETE FROM adminlog.interessados i
USING ranked r, duplicate_groups dg
WHERE i.id = r.id
  AND dg.nome = r.nome
  AND dg.cargo IS NOT DISTINCT FROM r.cargo
  AND r.rn > 1;
