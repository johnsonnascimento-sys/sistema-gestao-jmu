alter table if exists adminlog.tarefas_pendentes
  drop constraint if exists tarefas_pendentes_recorrencia_tipo_check;

alter table if exists adminlog.tarefas_pendentes
  drop constraint if exists tarefas_pendentes_recorrencia_detalhes_check;

alter table if exists adminlog.tarefas_pendentes
  add constraint tarefas_pendentes_recorrencia_tipo_check
  check (
    recorrencia_tipo is null
    or recorrencia_tipo in ('diaria', 'semanal', 'mensal', 'trimestral', 'quadrimestral', 'semestral', 'anual')
  );

alter table if exists adminlog.tarefas_pendentes
  add constraint tarefas_pendentes_recorrencia_detalhes_check
  check (
    (recorrencia_tipo is null and recorrencia_dias_semana is null and recorrencia_dia_mes is null)
    or (recorrencia_tipo = 'diaria' and recorrencia_dias_semana is null and recorrencia_dia_mes is null)
    or (
      recorrencia_tipo = 'semanal'
      and jsonb_typeof(recorrencia_dias_semana) = 'array'
      and jsonb_array_length(recorrencia_dias_semana) > 0
      and recorrencia_dia_mes is null
    )
    or (
      recorrencia_tipo in ('mensal', 'trimestral', 'quadrimestral', 'semestral', 'anual')
      and recorrencia_dias_semana is null
      and recorrencia_dia_mes between 1 and 31
    )
  );
