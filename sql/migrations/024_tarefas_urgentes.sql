alter table if exists adminlog.tarefas_pendentes
  add column if not exists urgente boolean not null default false;
