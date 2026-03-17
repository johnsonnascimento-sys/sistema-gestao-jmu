alter table if exists adminlog.pre_demanda
  add column if not exists prazo_processo date;

update adminlog.pre_demanda
set prazo_processo = prazo_final
where prazo_processo is null;

do $$
begin
  if exists (
    select 1
    from adminlog.pre_demanda
    where prazo_processo is null
  ) then
    raise exception 'Existem processos sem prazo_final historico; nao foi possivel preencher prazo_processo.';
  end if;
end $$;

alter table if exists adminlog.tarefas_pendentes
  add column if not exists prazo_conclusao date,
  add column if not exists recorrencia_tipo varchar(20),
  add column if not exists recorrencia_dias_semana jsonb,
  add column if not exists recorrencia_dia_mes integer;

update adminlog.tarefas_pendentes tarefa
set prazo_conclusao = coalesce(tarefa.prazo_data, pd.prazo_processo)
from adminlog.pre_demanda pd
where pd.id = tarefa.pre_demanda_id
  and tarefa.prazo_conclusao is null;

do $$
begin
  if exists (
    select 1
    from adminlog.tarefas_pendentes
    where prazo_conclusao is null
  ) then
    raise exception 'Existem tarefas sem prazo_conclusao e sem prazo do processo para backfill.';
  end if;
end $$;

alter table if exists adminlog.pre_demanda
  alter column prazo_processo set not null;

alter table if exists adminlog.tarefas_pendentes
  alter column prazo_conclusao set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tarefas_pendentes_recorrencia_tipo_check'
      and connamespace = 'adminlog'::regnamespace
  ) then
    alter table adminlog.tarefas_pendentes
      add constraint tarefas_pendentes_recorrencia_tipo_check
      check (
        recorrencia_tipo is null
        or recorrencia_tipo in ('diaria', 'semanal', 'mensal')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tarefas_pendentes_recorrencia_detalhes_check'
      and connamespace = 'adminlog'::regnamespace
  ) then
    alter table adminlog.tarefas_pendentes
      add constraint tarefas_pendentes_recorrencia_detalhes_check
      check (
        (recorrencia_tipo is null and recorrencia_dias_semana is null and recorrencia_dia_mes is null)
        or (recorrencia_tipo = 'diaria' and recorrencia_dias_semana is null and recorrencia_dia_mes is null)
        or (recorrencia_tipo = 'semanal' and jsonb_typeof(recorrencia_dias_semana) = 'array' and jsonb_array_length(recorrencia_dias_semana) > 0 and recorrencia_dia_mes is null)
        or (recorrencia_tipo = 'mensal' and recorrencia_dias_semana is null and recorrencia_dia_mes between 1 and 31)
      );
  end if;
end $$;

create index if not exists idx_pre_demanda_prazo_processo
  on adminlog.pre_demanda (prazo_processo);

create index if not exists idx_tarefas_pendentes_pre_demanda_prazo_conclusao
  on adminlog.tarefas_pendentes (pre_demanda_id, concluida, prazo_conclusao);
