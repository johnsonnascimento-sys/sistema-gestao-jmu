ALTER TABLE adminlog.interessados
  ADD COLUMN IF NOT EXISTS cargo varchar(255);

CREATE INDEX IF NOT EXISTS idx_interessados_cargo ON adminlog.interessados (cargo);

CREATE TEMP TABLE tmp_pessoa_alias_map (
  alias_nome varchar(255) NOT NULL,
  canonical_nome varchar(255) NOT NULL,
  cargo varchar(255) NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_pessoa_alias_map (alias_nome, canonical_nome, cargo)
VALUES
  ('ALEX', 'Alex Fabianny Lemos Quintão', 'Analista Judiciário'),
  ('ALEX FABIANNY LEMOS QUINTÃO', 'Alex Fabianny Lemos Quintão', 'Analista Judiciário'),
  ('ALEXANDRE', 'Alexandre Sousa da Silva', 'Militar'),
  ('ALEXANDRE (MILITAR)', 'Alexandre Sousa da Silva', 'Militar'),
  ('ALEXANDRE SOUSA DA SILVA', 'Alexandre Sousa da Silva', 'Militar'),
  ('ANDRÉ', 'André Luis Oliveira de Santana', 'Técnico Judiciário'),
  ('ANDRE', 'André Luis Oliveira de Santana', 'Técnico Judiciário'),
  ('ANDRÉ LUIS OLIVEIRA DE SANTANA', 'André Luis Oliveira de Santana', 'Técnico Judiciário'),
  ('ANDRESSA', 'Andressa Cristiny Lima Nascimento', 'Estagiário'),
  ('ANDRESSA CRISTINY LIMA NASCIMENTO', 'Andressa Cristiny Lima Nascimento', 'Estagiário'),
  ('BRENO', 'Breno Araújo Rosa', 'Militar'),
  ('BRENO (MILITAR)', 'Breno Araújo Rosa', 'Militar'),
  ('BRENO ARAÚJO ROSA', 'Breno Araújo Rosa', 'Militar'),
  ('BRENO ARAUJO ROSA', 'Breno Araújo Rosa', 'Militar'),
  ('BRUNO', 'Bruno Burman', 'Analista Judiciário'),
  ('BRUNO BURMAN', 'Bruno Burman', 'Analista Judiciário'),
  ('BRUNO (1ª AUDITORIA)', 'Bruno Giovannetti', 'Técnico Judiciário'),
  ('BRUNO (1A AUDITORIA)', 'Bruno Giovannetti', 'Técnico Judiciário'),
  ('BRUNO GIOVANNETTI', 'Bruno Giovannetti', 'Técnico Judiciário'),
  ('BRUNO (MILITAR)', 'Bruno Rafael dos Santos Souza', 'Militar'),
  ('BRUNO RAFAEL DOS SANTOS SOUZA', 'Bruno Rafael dos Santos Souza', 'Militar'),
  ('CLAUDIA', 'Cláudia Maria de Freitas Fontes', 'Técnico Judiciário'),
  ('CLÁUDIA', 'Cláudia Maria de Freitas Fontes', 'Técnico Judiciário'),
  ('CLÁUDIA MARIA DE FREITAS FONTES', 'Cláudia Maria de Freitas Fontes', 'Técnico Judiciário'),
  ('CLAUDIA MARIA DE FREITAS FONTES', 'Cláudia Maria de Freitas Fontes', 'Técnico Judiciário'),
  ('DONI', 'Jefferson Donizeti de Oliveira', 'Técnico Judiciário'),
  ('DONIZETI', 'Jefferson Donizeti de Oliveira', 'Técnico Judiciário'),
  ('JEFFERSON DONIZETI DE OLIVEIRA', 'Jefferson Donizeti de Oliveira', 'Técnico Judiciário'),
  ('DR. EDUARDO', 'Eduardo Martins Neiva Monteiro', 'Juiz Federal Substituto da Justiça Militar'),
  ('EDUARDO MARTINS NEIVA MONTEIRO', 'Eduardo Martins Neiva Monteiro', 'Juiz Federal Substituto da Justiça Militar'),
  ('DR. RICARDO', 'Ricardo Vergueiro Figueiredo', 'Juiz Federal da Justiça Militar'),
  ('RICARDO VERGUEIRO FIGUEIREDO', 'Ricardo Vergueiro Figueiredo', 'Juiz Federal da Justiça Militar'),
  ('DR. VITOR', 'Vitor de Luca', 'Juiz Federal Substituto da Justiça Militar'),
  ('VITOR DE LUCA', 'Vitor de Luca', 'Juiz Federal Substituto da Justiça Militar'),
  ('DRA. VERA', 'Vera Lúcia da Silva Conceição', 'Juíza Federal da Justiça Militar'),
  ('VERA LÚCIA DA SILVA CONCEIÇÃO', 'Vera Lúcia da Silva Conceição', 'Juíza Federal da Justiça Militar'),
  ('VERA LUCIA DA SILVA CONCEICAO', 'Vera Lúcia da Silva Conceição', 'Juíza Federal da Justiça Militar'),
  ('EDUARDO', 'Eduardo Cesar Castro Ricci', 'Técnico Judiciário'),
  ('EDUARDO CESAR CASTRO RICCI', 'Eduardo Cesar Castro Ricci', 'Técnico Judiciário'),
  ('EMANUEL', 'Emanuel Corrêa Mergulhão', 'Técnico Judiciário'),
  ('EMANUL', 'Emanuel Corrêa Mergulhão', 'Técnico Judiciário'),
  ('EMANUEL CORRÊA MERGULHÃO', 'Emanuel Corrêa Mergulhão', 'Técnico Judiciário'),
  ('EMANUEL CORREA MERGULHAO', 'Emanuel Corrêa Mergulhão', 'Técnico Judiciário'),
  ('ESTER', 'Ester Lemes de Souza', 'Residente Jurídico'),
  ('ESTER LEMES', 'Ester Lemes de Souza', 'Residente Jurídico'),
  ('ESTER LEMES DE SOUZA', 'Ester Lemes de Souza', 'Residente Jurídico'),
  ('EWERTON', 'Ewerton David Silva', 'Militar'),
  ('EWERTON (MILITAR)', 'Ewerton David Silva', 'Militar'),
  ('EWERTON DAVID SILVA', 'Ewerton David Silva', 'Militar'),
  ('FLÁVIA', 'FLÁVIA SILVA BRITO', 'Estagiário'),
  ('FLAVIA', 'FLÁVIA SILVA BRITO', 'Estagiário'),
  ('FLÁVIA SILVA BRITO', 'FLÁVIA SILVA BRITO', 'Estagiário'),
  ('FLAVIA SILVA BRITO', 'FLÁVIA SILVA BRITO', 'Estagiário'),
  ('FRANÇA', 'Gustavo Gonçalves França', 'Militar'),
  ('FRANCA', 'Gustavo Gonçalves França', 'Militar'),
  ('GUSTAVO', 'Gustavo Gonçalves França', 'Militar'),
  ('GUSTAVO GONÇALVES FRANÇA', 'Gustavo Gonçalves França', 'Militar'),
  ('GUSTAVO GONCALVES FRANCA', 'Gustavo Gonçalves França', 'Militar'),
  ('GALVÃO', 'Matheus Galvão da Silva', 'Militar'),
  ('GALVAO', 'Matheus Galvão da Silva', 'Militar'),
  ('MATHEUS GALVÃO DA SILVA', 'Matheus Galvão da Silva', 'Militar'),
  ('MATHEUS GALVAO DA SILVA', 'Matheus Galvão da Silva', 'Militar'),
  ('HIGOR (MILITAR)', 'Higor Daniel Prado', 'Militar'),
  ('HIGOR DANIEL PRADO', 'Higor Daniel Prado', 'Militar'),
  ('ISAIAS', 'Isaias Rosa de Abreu', 'Militar'),
  ('ISAÍAS', 'Isaias Rosa de Abreu', 'Militar'),
  ('ISAIAS ROSA DE ABREU', 'Isaias Rosa de Abreu', 'Militar'),
  ('JEFF', 'Jefferson Faria Hernandes', 'Técnico Judiciário'),
  ('JEFFERSON', 'Jefferson Faria Hernandes', 'Técnico Judiciário'),
  ('JEFFERSON FARIA HERNANDES', 'Jefferson Faria Hernandes', 'Técnico Judiciário'),
  ('JOAQUIM', 'Joaquim Carlos de Arruda Junior', 'Técnico Judiciário'),
  ('JOAQUIM CARLOS DE ARRUDA JUNIOR', 'Joaquim Carlos de Arruda Junior', 'Técnico Judiciário'),
  ('JOHNSON', 'Johnson Teixeira do Nascimento', 'Técnico Judiciário'),
  ('JOHNSON TEIXEIRA DO NASCIMENTO', 'Johnson Teixeira do Nascimento', 'Técnico Judiciário'),
  ('JULIA', 'Julia Cristina Vieira', 'Residente Jurídico'),
  ('JULIA CRISTINA VIEIRA', 'Julia Cristina Vieira', 'Residente Jurídico'),
  ('LAUREANO', 'Mike Laureano Silva', 'Militar'),
  ('MIKE LAUREANO SILVA', 'Mike Laureano Silva', 'Militar'),
  ('LUCAS', 'Lucas Matos Archangelo Peres Poce', 'Técnico Judiciário'),
  ('LUCAS MATOS ARCHANGELO PERES POCE', 'Lucas Matos Archangelo Peres Poce', 'Técnico Judiciário'),
  ('MALU', 'Maria Lúcia Del Nery', 'Técnico Judiciário'),
  ('MARIA LÚCIA DEL NERY', 'Maria Lúcia Del Nery', 'Técnico Judiciário'),
  ('MARIA LUCIA DEL NERY', 'Maria Lúcia Del Nery', 'Técnico Judiciário'),
  ('MARCELLO', 'Marcello Jose dos Santos', 'Militar'),
  ('MARCELLO JOSE DOS SANTOS', 'Marcello Jose dos Santos', 'Militar');

WITH aliases AS (
  SELECT
    upper(translate(trim(alias_nome), 'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) AS alias_key,
    canonical_nome,
    cargo
  FROM tmp_pessoa_alias_map
),
matched AS (
  SELECT
    i.id,
    a.canonical_nome,
    a.cargo
  FROM adminlog.interessados i
  INNER JOIN aliases a
    ON upper(translate(trim(i.nome), 'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) = a.alias_key
)
UPDATE adminlog.interessados i
SET
  nome = m.canonical_nome,
  cargo = m.cargo
FROM matched m
WHERE i.id = m.id;

WITH aliases AS (
  SELECT
    upper(translate(trim(alias_nome), 'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) AS alias_key,
    canonical_nome,
    cargo
  FROM tmp_pessoa_alias_map
)
UPDATE adminlog.pre_demanda pd
SET solicitante = a.canonical_nome
FROM aliases a
WHERE upper(translate(trim(pd.solicitante), 'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) = a.alias_key;
