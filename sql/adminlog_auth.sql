create table if not exists adminlog.app_user (
  id bigserial primary key,
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'operador')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_app_user_email_lower
  on adminlog.app_user (lower(email));

drop trigger if exists trg_app_user_updated_at on adminlog.app_user;
create trigger trg_app_user_updated_at
before update on adminlog.app_user
for each row
execute function adminlog.fn_set_updated_at();
