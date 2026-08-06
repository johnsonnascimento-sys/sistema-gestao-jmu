drop index if exists adminlog.uq_tarefas_pendentes_procedimento_por_demanda;

create unique index if not exists uq_tarefas_pendentes_procedimento_por_demanda
  on adminlog.tarefas_pendentes (pre_demanda_id, procedimento_id)
  where procedimento_id is not null and concluida = false;
