alter table adminlog.interessados
  add column if not exists pai varchar(255),
  add column if not exists mae varchar(255),
  add column if not exists endereco text;

