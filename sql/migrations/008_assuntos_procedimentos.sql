create table if not exists adminlog.assuntos (
  id uuid primary key default gen_random_uuid(),
  nome varchar(255) not null,
  descricao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_assuntos_nome on adminlog.assuntos (lower(nome));

create table if not exists adminlog.assunto_normas (
  assunto_id uuid not null references adminlog.assuntos(id) on delete cascade,
  norma_id uuid not null references adminlog.normas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assunto_id, norma_id)
);

create table if not exists adminlog.assunto_procedimentos (
  id uuid primary key default gen_random_uuid(),
  assunto_id uuid not null references adminlog.assuntos(id) on delete cascade,
  ordem integer not null,
  descricao text not null,
  setor_destino_id uuid null references adminlog.setores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_assunto_procedimentos_ordem on adminlog.assunto_procedimentos (assunto_id, ordem);
create index if not exists idx_assunto_procedimentos_assunto on adminlog.assunto_procedimentos (assunto_id, ordem asc);

create table if not exists adminlog.demanda_assuntos (
  pre_demanda_id bigint not null references adminlog.pre_demanda(id) on delete cascade,
  assunto_id uuid not null references adminlog.assuntos(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by_user_id bigint null references adminlog.app_user(id) on delete set null,
  primary key (pre_demanda_id, assunto_id)
);

alter table adminlog.tarefas_pendentes
  add column if not exists assunto_id uuid null references adminlog.assuntos(id) on delete set null;

alter table adminlog.tarefas_pendentes
  add column if not exists procedimento_id uuid null references adminlog.assunto_procedimentos(id) on delete set null;

alter table adminlog.tarefas_pendentes
  add column if not exists setor_destino_id uuid null references adminlog.setores(id) on delete set null;

alter table adminlog.tarefas_pendentes
  add column if not exists gerada_automaticamente boolean not null default false;

create unique index if not exists uq_tarefas_pendentes_procedimento_por_demanda
  on adminlog.tarefas_pendentes (pre_demanda_id, procedimento_id)
  where procedimento_id is not null;
