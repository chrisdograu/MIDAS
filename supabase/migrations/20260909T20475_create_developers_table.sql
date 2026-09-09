-- Criar tabela de desenvolvedores
CREATE TABLE IF NOT EXISTS developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT,
  logo_url TEXT,
  website TEXT,
  founded_year INTEGER,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES developers(id);

CREATE INDEX IF NOT EXISTS idx_developers_name ON developers(name);
CREATE INDEX IF NOT EXISTS idx_produtos_developer_id ON produtos(developer_id);

ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers são públicos" ON developers FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem criar desenvolvedores" ON developers FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem atualizar desenvolvedores" ON developers FOR UPDATE USING (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem deletar desenvolvedores" ON developers FOR DELETE USING (auth.role() = 'admin');