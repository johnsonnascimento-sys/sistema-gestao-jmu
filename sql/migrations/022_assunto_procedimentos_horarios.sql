alter table if exists adminlog.assunto_procedimentos
  add column if not exists horario_inicio time,
  add column if not exists horario_fim time;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assunto_procedimentos_horarios_check'
      and connamespace = 'adminlog'::regnamespace
  ) then
    alter table adminlog.assunto_procedimentos
      add constraint assunto_procedimentos_horarios_check
      check (
        horario_inicio is null
        or horario_fim is null
        or horario_fim >= horario_inicio
      );
  end if;
end $$;
