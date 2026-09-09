-- ============================================
-- TEAM MEMBERS TABLE (V2 - Completa)
-- ============================================

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  
  -- Mídia
  photo_url TEXT,
  banner_url TEXT,
  
  -- Conteúdo
  bio TEXT,
  long_description TEXT,
  
  -- Redes sociais
  social_links JSONB DEFAULT '{}'::JSONB,
  
  -- Metadados
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_slug ON team_members(slug);
CREATE INDEX IF NOT EXISTS idx_team_members_display_order ON team_members(display_order);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da equipe são públicos" ON team_members
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins podem gerenciar membros" ON team_members
  FOR ALL USING (auth.role() = 'admin');