-- ============================================================
-- MIGRAÇÃO DESKTOP: Histórico de configurações (Audit Trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_config_history_changed_by ON config_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_config_history_changed_at ON config_history(changed_at DESC);

-- RLS
ALTER TABLE config_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver histórico" ON config_history
  FOR SELECT USING (auth.role() = 'admin');

CREATE POLICY "Sistema pode inserir histórico" ON config_history
  FOR INSERT WITH CHECK (true);

-- Trigger para versionar alterações em site_settings
CREATE OR REPLACE FUNCTION version_config_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO config_history (
      config_key,
      old_value,
      new_value,
      changed_by,
      changed_at
    ) VALUES (
      NEW.key,
      OLD.value,
      NEW.value,
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER version_config
AFTER UPDATE ON site_settings
FOR EACH ROW
WHEN (OLD.value IS DISTINCT FROM NEW.value)
EXECUTE FUNCTION version_config_trigger();

-- Função para reverter configuração
CREATE OR REPLACE FUNCTION revert_config(
  _history_id UUID,
  _reason TEXT
) RETURNS VOID AS $$
DECLARE
  _history_record config_history%ROWTYPE;
BEGIN
  SELECT * INTO _history_record
  FROM config_history
  WHERE id = _history_id;
  
  IF _history_record IS NULL THEN
    RAISE EXCEPTION 'Registro de histórico não encontrado';
  END IF;
  
  IF _history_record.old_value IS NULL THEN
    RAISE EXCEPTION 'Não é possível reverter: valor antigo é NULL';
  END IF;
  
  UPDATE site_settings
  SET value = _history_record.old_value
  WHERE key = _history_record.config_key;
  
  -- Registrar a reversão como um novo histórico
  INSERT INTO config_history (
    config_key,
    old_value,
    new_value,
    changed_by,
    reason
  ) VALUES (
    _history_record.config_key,
    _history_record.new_value,
    _history_record.old_value,
    auth.uid(),
    'Revertido para versão anterior. Motivo: ' || _reason
  );
  
  -- Marcar o registro original como revertido (opcional)
  -- Poderíamos adicionar uma coluna reverted_at, mas por simplicidade,
  -- registramos a reversão como um novo registro
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE config_history IS 'Histórico de alterações nas configurações do sistema (Audit Trail)';
COMMENT ON COLUMN config_history.config_key IS 'Chave da configuração (ex: business_params, store_info)';
COMMENT ON COLUMN config_history.old_value IS 'Valor antes da alteração (JSON)';
COMMENT ON COLUMN config_history.new_value IS 'Valor depois da alteração (JSON)';