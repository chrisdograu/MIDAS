-- ============================================================
-- MIGRAÇÃO DESKTOP: Tabela de notificações para administradores
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT CHECK (type IN ('denuncia', 'ticket', 'estoque', 'pedido', 'torneio', 'sistema', 'certificado', 'moderacao')),
  priority TEXT CHECK (priority IN ('baixa', 'media', 'alta', 'critica')) DEFAULT 'media',
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin ON admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON admin_notifications(priority);

-- RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver suas notificações" ON admin_notifications
  FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "Sistema pode criar notificações" ON admin_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins podem marcar como lidas" ON admin_notifications
  FOR UPDATE USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

-- Função para marcar todas como lidas
CREATE OR REPLACE FUNCTION mark_all_admin_notifications_read(_admin_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE admin_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE admin_id = _admin_id AND is_read = FALSE
  RETURNING id INTO updated_count;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar notificação quando uma denúncia é criada
CREATE OR REPLACE FUNCTION create_admin_notification_on_denuncia()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO admin_notifications (admin_id, title, body, type, priority, link)
    SELECT 
      ur.user_id,
      '🛡️ Nova denúncia pendente',
      'Denúncia de "' || NEW.reason || '" aguarda moderação.',
      'denuncia',
      'alta',
      '/desktop/denuncias'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'moderator');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER admin_notification_on_denuncia
AFTER INSERT ON denuncias
FOR EACH ROW
EXECUTE FUNCTION create_admin_notification_on_denuncia();

-- Trigger para criar notificação quando um ticket é criado
CREATE OR REPLACE FUNCTION create_admin_notification_on_ticket()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_notifications (admin_id, title, body, type, priority, link)
  SELECT 
    ur.user_id,
    '🎫 Novo ticket de suporte',
    'Ticket "' || NEW.subject || '" aguarda atendimento.',
    'ticket',
    'media',
    '/desktop/tickets'
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'atendente');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER admin_notification_on_ticket
AFTER INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION create_admin_notification_on_ticket();

-- Comentários
COMMENT ON TABLE admin_notifications IS 'Notificações em tempo real para administradores';
COMMENT ON COLUMN admin_notifications.type IS 'denuncia, ticket, estoque, pedido, torneio, sistema, certificado, moderacao';
COMMENT ON COLUMN admin_notifications.priority IS 'baixa, media, alta, critica';