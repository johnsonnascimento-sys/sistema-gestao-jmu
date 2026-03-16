alter table adminlog.tarefas_pendentes
  add column if not exists ordem integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by pre_demanda_id
      order by concluida asc, created_at asc, id asc
    ) as next_ordem
  from adminlog.tarefas_pendentes
)
update adminlog.tarefas_pendentes tarefa
set ordem = ranked.next_ordem
from ranked
where tarefa.id = ranked.id
  and (tarefa.ordem is null or tarefa.ordem <> ranked.next_ordem);

alter table adminlog.tarefas_pendentes
  alter column ordem set not null;

create index if not exists idx_tarefas_pendentes_pre_demanda_ordem
  on adminlog.tarefas_pendentes (pre_demanda_id, concluida, ordem asc, created_at asc);
