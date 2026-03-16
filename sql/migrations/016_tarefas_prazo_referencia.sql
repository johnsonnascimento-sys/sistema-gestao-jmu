alter table if exists adminlog.tarefas_pendentes
  add column if not exists prazo_referencia varchar(32);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tarefas_pendentes_prazo_referencia_check'
      and connamespace = 'adminlog'::regnamespace
  ) then
    alter table adminlog.tarefas_pendentes
      add constraint tarefas_pendentes_prazo_referencia_check
      check (
        prazo_referencia is null
        or prazo_referencia in ('prazoInicial', 'prazoIntermediario', 'prazoFinal')
      );
  end if;
end $$;

create index if not exists tarefas_pendentes_prazo_referencia_idx
  on adminlog.tarefas_pendentes (pre_demanda_id, concluida, prazo_referencia);
