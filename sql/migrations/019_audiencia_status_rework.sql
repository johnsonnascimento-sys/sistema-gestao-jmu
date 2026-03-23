update adminlog.demanda_audiencias_judiciais
set situacao = case situacao
  when 'agendada' then 'designada'
  when 'redesignada' then 'designada'
  when 'suspensa' then 'nao_realizada'
  else situacao
end
where situacao in ('agendada', 'redesignada', 'suspensa');

alter table adminlog.demanda_audiencias_judiciais
  drop constraint if exists demanda_audiencias_judiciais_situacao_check;

alter table adminlog.demanda_audiencias_judiciais
  add constraint demanda_audiencias_judiciais_situacao_check
  check (situacao in ('designada', 'convertida_diligencia', 'nao_realizada', 'realizada', 'cancelada'));
