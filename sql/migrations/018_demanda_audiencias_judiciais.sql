CREATE TABLE IF NOT EXISTS adminlog.demanda_audiencias_judiciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_demanda_id bigint NOT NULL REFERENCES adminlog.pre_demanda(id) ON DELETE CASCADE,
  data_hora_inicio timestamptz NOT NULL,
  data_hora_fim timestamptz,
  descricao text NOT NULL,
  sala text,
  situacao varchar(20) NOT NULL DEFAULT 'agendada',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL,
  updated_by_user_id bigint REFERENCES adminlog.app_user(id) ON DELETE SET NULL
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'demanda_audiencias_judiciais_situacao_check'
      and connamespace = 'adminlog'::regnamespace
  ) then
    alter table adminlog.demanda_audiencias_judiciais
      add constraint demanda_audiencias_judiciais_situacao_check
      check (situacao in ('agendada', 'redesignada', 'realizada', 'cancelada', 'suspensa'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'demanda_audiencias_judiciais_intervalo_check'
      and connamespace = 'adminlog'::regnamespace
  ) then
    alter table adminlog.demanda_audiencias_judiciais
      add constraint demanda_audiencias_judiciais_intervalo_check
      check (data_hora_fim is null or data_hora_fim >= data_hora_inicio);
  end if;
end $$;

create index if not exists idx_demanda_audiencias_judiciais_pre_demanda_inicio
  on adminlog.demanda_audiencias_judiciais (pre_demanda_id, data_hora_inicio asc, created_at asc);

create index if not exists idx_demanda_audiencias_judiciais_pre_demanda_situacao
  on adminlog.demanda_audiencias_judiciais (pre_demanda_id, situacao, data_hora_inicio asc);

drop trigger if exists trg_demanda_audiencias_judiciais_updated_at on adminlog.demanda_audiencias_judiciais;
create trigger trg_demanda_audiencias_judiciais_updated_at
before update on adminlog.demanda_audiencias_judiciais
for each row
execute function adminlog.fn_set_updated_at();
