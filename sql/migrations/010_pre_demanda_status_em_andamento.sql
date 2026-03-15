alter table adminlog.pre_demanda
  drop constraint if exists ck_pre_demanda_status;

alter table adminlog.pre_demanda_status_audit
  drop constraint if exists ck_pre_demanda_status_audit_anterior;

alter table adminlog.pre_demanda_status_audit
  drop constraint if exists ck_pre_demanda_status_audit_novo;

update adminlog.pre_demanda
set status = 'em_andamento'
where status in ('aberta', 'associada');

update adminlog.pre_demanda_status_audit
set status_anterior = 'em_andamento'
where status_anterior in ('aberta', 'associada');

update adminlog.pre_demanda_status_audit
set status_novo = 'em_andamento'
where status_novo in ('aberta', 'associada');

alter table adminlog.pre_demanda
  add constraint ck_pre_demanda_status
  check (status in ('em_andamento', 'aguardando_sei', 'encerrada'));

alter table adminlog.pre_demanda
  alter column status set default 'em_andamento';

alter table adminlog.pre_demanda_status_audit
  add constraint ck_pre_demanda_status_audit_anterior
  check (status_anterior in ('em_andamento', 'aguardando_sei', 'encerrada'));

alter table adminlog.pre_demanda_status_audit
  add constraint ck_pre_demanda_status_audit_novo
  check (status_novo in ('em_andamento', 'aguardando_sei', 'encerrada'));
