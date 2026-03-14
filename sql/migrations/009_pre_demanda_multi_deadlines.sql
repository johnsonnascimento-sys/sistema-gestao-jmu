ALTER TABLE adminlog.pre_demanda
  ADD COLUMN IF NOT EXISTS prazo_inicial date,
  ADD COLUMN IF NOT EXISTS prazo_intermediario date;

CREATE INDEX IF NOT EXISTS idx_pre_demanda_prazo_inicial ON adminlog.pre_demanda (prazo_inicial);
CREATE INDEX IF NOT EXISTS idx_pre_demanda_prazo_intermediario ON adminlog.pre_demanda (prazo_intermediario);
