-- ============================================================
-- MIGRAÇÃO DESKTOP: Tabela de chaves de ativação (pós-venda digital)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  key_code TEXT UNIQUE NOT NULL,
  platform TEXT,
  status TEXT CHECK (status IN ('available', 'reserved', 'sold', 'expired', 'revoked')) DEFAULT 'available',
  order_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  reserved_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_keys_status ON product_keys(status);
CREATE INDEX IF NOT EXISTS idx_product_keys_product ON product_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_product_keys_order ON product_keys(order_id);
CREATE INDEX IF NOT EXISTS idx_product_keys_code ON product_keys(key_code);

-- RLS
ALTER TABLE product_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todas as chaves" ON product_keys
  FOR SELECT USING (auth.role() = 'admin');

CREATE POLICY "Admins podem inserir chaves" ON product_keys
  FOR INSERT WITH CHECK (auth.role() = 'admin');

CREATE POLICY "Admins podem atualizar chaves" ON product_keys
  FOR UPDATE USING (auth.role() = 'admin');

CREATE POLICY "Admins podem deletar chaves" ON product_keys
  FOR DELETE USING (auth.role() = 'admin');

-- Função para reservar chave para pedido
CREATE OR REPLACE FUNCTION reserve_product_key(
  _product_id UUID,
  _order_id UUID
) RETURNS TEXT AS $$
DECLARE
  _key_code TEXT;
BEGIN
  SELECT key_code INTO _key_code
  FROM product_keys
  WHERE product_id = _product_id
    AND status = 'available'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF _key_code IS NULL THEN
    RAISE EXCEPTION 'Nenhuma chave disponível para o produto %', _product_id;
  END IF;
  
  UPDATE product_keys
  SET status = 'reserved',
      order_id = _order_id,
      reserved_at = NOW()
  WHERE key_code = _key_code;
  
  RETURN _key_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para confirmar venda da chave
CREATE OR REPLACE FUNCTION confirm_product_key_sale(
  _key_code TEXT,
  _order_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE product_keys
  SET status = 'sold',
      sold_at = NOW()
  WHERE key_code = _key_code
    AND order_id = _order_id
    AND status = 'reserved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chave % não encontrada ou não reservada para este pedido', _key_code;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para cancelar reserva de chave
CREATE OR REPLACE FUNCTION cancel_product_key_reservation(
  _key_code TEXT,
  _order_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE product_keys
  SET status = 'available',
      order_id = NULL,
      reserved_at = NULL
  WHERE key_code = _key_code
    AND order_id = _order_id
    AND status = 'reserved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE product_keys IS 'Chaves de ativação para jogos digitais (pós-venda)';
COMMENT ON COLUMN product_keys.status IS 'available, reserved, sold, expired, revoked';
COMMENT ON COLUMN product_keys.platform IS 'Plataforma da chave (Steam, Epic, Xbox, PlayStation, Nintendo)';