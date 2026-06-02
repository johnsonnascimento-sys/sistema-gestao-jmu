alter table adminlog.andamentos
  add column if not exists motivo text,
  add column if not exists observacoes text;
