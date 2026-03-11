create extension if not exists pgcrypto;

create table if not exists adminlog.normas (
  id uuid primary key default gen_random_uuid(),
  numero varchar(120) not null,
  data_norma date not null,
  origem varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_normas_numero on adminlog.normas (numero);
create index if not exists idx_normas_origem on adminlog.normas (origem);
create unique index if not exists uq_normas_numero_origem_data on adminlog.normas (numero, origem, data_norma);
