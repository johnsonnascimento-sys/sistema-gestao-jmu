alter table adminlog.pre_demanda
  add column if not exists idempotencia_sei_norm text not null default '';

-- O trigger geral de updated_at nao deve transformar o backfill tecnico em
-- atividade recente das demandas existentes.
alter table adminlog.pre_demanda disable trigger trg_pre_demanda_updated_at;

update adminlog.pre_demanda pd
set idempotencia_sei_norm = regexp_replace(
  coalesce(nullif(trim(link.sei_numero_inicial), ''), link.sei_numero),
  '[^0-9]',
  '',
  'g'
)
from adminlog.pre_to_sei_link link
where link.pre_id = pd.pre_id
  and pd.idempotencia_sei_norm = '';

alter table adminlog.pre_demanda enable trigger trg_pre_demanda_updated_at;

drop index if exists adminlog.uq_pre_demanda_idempotencia;

create unique index uq_pre_demanda_idempotencia
  on adminlog.pre_demanda (
    solicitante_norm,
    assunto_norm,
    data_referencia,
    idempotencia_sei_norm
  );
