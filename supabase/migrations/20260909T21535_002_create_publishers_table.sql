-- ============================================
-- PUBLISHERS TABLE (V2 - Completa)
-- ============================================

CREATE TABLE IF NOT EXISTS publishers (
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
  social_links JSONB DEFAULT '{}'::JSONB,
  
  -- Metadados
  wikipedia_url TEXT,
  wiki_data JSONB,
  
  -- Auditoria
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishers_slug ON publishers(slug);
CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers(name);
CREATE INDEX IF NOT EXISTS idx_publishers_country ON publishers(country);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_publisher_id ON produtos(publisher_id);

ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers públicos" ON publishers FOR SELECT USING (true);
CREATE POLICY "Admins podem criar" ON publishers FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "Admins podem atualizar" ON publishers FOR UPDATE USING (auth.role() = 'admin');
CREATE POLICY "Admins podem deletar" ON publishers FOR DELETE USING (auth.role() = 'admin');