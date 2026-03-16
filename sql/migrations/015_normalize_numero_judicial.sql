update adminlog.pre_demanda
set numero_judicial = regexp_replace(
  regexp_replace(numero_judicial, '\D', '', 'g'),
  '^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$',
  '\1-\2.\3.\4.\5.\6'
)
where numero_judicial is not null
  and length(regexp_replace(numero_judicial, '\D', '', 'g')) = 20
  and numero_judicial <> regexp_replace(
    regexp_replace(numero_judicial, '\D', '', 'g'),
    '^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$',
    '\1-\2.\3.\4.\5.\6'
  );

update adminlog.demanda_numeros_judiciais
set numero_judicial = regexp_replace(
  regexp_replace(numero_judicial, '\D', '', 'g'),
  '^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$',
  '\1-\2.\3.\4.\5.\6'
)
where numero_judicial is not null
  and length(regexp_replace(numero_judicial, '\D', '', 'g')) = 20
  and numero_judicial <> regexp_replace(
    regexp_replace(numero_judicial, '\D', '', 'g'),
    '^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$',
    '\1-\2.\3.\4.\5.\6'
  );
