create extension if not exists pgcrypto;

create table if not exists adminlog.pre_demanda_pacotes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text null,
  ativo boolean not null default true,
  created_by_user_id bigint references adminlog.app_user(id) on delete set null,
  updated_by_user_id bigint references adminlog.app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists adminlog.pre_demanda_pacote_assuntos (
  pacote_id uuid not null references adminlog.pre_demanda_pacotes(id) on delete cascade,
  assunto_id uuid not null references adminlog.assuntos(id),
  ordem integer not null,
  created_at timestamptz not null default now(),
  unique (pacote_id, assunto_id)
);

create index if not exists idx_pre_demanda_pacote_assuntos_pacote_ordem
  on adminlog.pre_demanda_pacote_assuntos (pacote_id, ordem asc);

drop trigger if exists trg_pre_demanda_pacotes_updated_at on adminlog.pre_demanda_pacotes;
create trigger trg_pre_demanda_pacotes_updated_at
before update on adminlog.pre_demanda_pacotes
for each row
execute function adminlog.fn_set_updated_at();
