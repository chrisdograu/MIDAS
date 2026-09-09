-- ============================================
-- DEVELOPERS TABLE (V2 - Completa)
-- ============================================

CREATE TABLE IF NOT EXISTS developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  
  -- Descrição
  description TEXT,
  bio TEXT,
  
  -- Mídia
  logo_url TEXT,
  banner_url TEXT,
  
  -- Empresa
  website TEXT,
  founded_year INTEGER,
  country TEXT,
  headquarters TEXT,
  employees INTEGER,
  parent_company TEXT,
  
  -- Conteúdo
  notable_games TEXT[],
  
  -- Redes sociais
  social_links JSONB DEFAULT '{}'::JSONB,
  
  -- Metadados
  wikipedia_url TEXT,
  wiki_data JSONB,
  
  -- Auditoria
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_developers_slug ON developers(slug);
CREATE INDEX IF NOT EXISTS idx_developers_name ON developers(name);
CREATE INDEX IF NOT EXISTS idx_developers_country ON developers(country);
CREATE INDEX IF NOT EXISTS idx_developers_founded_year ON developers(founded_year);

-- Adicionar coluna developer_id em produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES developers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_developer_id ON produtos(developer_id);

-- RLS
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers públicos" ON developers
  FOR SELECT USING (true);

CREATE POLICY "Admins podem criar" ON developers
  FOR INSERT WITH CHECK (auth.role() = 'admin');

CREATE POLICY "Admins podem atualizar" ON developers
  FOR UPDATE USING (auth.role() = 'admin');

CREATE POLICY "Admins podem deletar" ON developers
  FOR DELETE USING (auth.role() = 'admin');