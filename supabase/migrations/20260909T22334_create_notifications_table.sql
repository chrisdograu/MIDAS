-- ============================================================
-- MIGRAÇÃO: Tabela de Notificações (Mobile)
-- ============================================================

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('forum_reply', 'forum_mention', 'trade_update', 'follow', 'review_reply', 'system', 'like', 'comment')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  reference_type TEXT CHECK (reference_type IN ('forum_post', 'forum_reply', 'trade_proposal', 'profile', 'review', 'comment', 'anuncio')),
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuários podem ver apenas suas notificações" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir notificações" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuários podem marcar como lidas" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND (is_read = TRUE OR read_at IS NOT NULL));

-- Função para marcar todas como lidas
CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = user_uuid AND is_read = FALSE
  RETURNING id INTO updated_count;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE notifications IS 'Central de notificações do usuário (Mobile)';
COMMENT ON COLUMN notifications.type IS 'Tipo: forum_reply, forum_mention, trade_update, follow, review_reply, system, like, comment';
COMMENT ON COLUMN notifications.reference_type IS 'Tipo de referência: forum_post, forum_reply, trade_proposal, profile, review, comment, anuncio';