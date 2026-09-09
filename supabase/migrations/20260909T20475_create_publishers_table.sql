-- Criar tabela de publicadoras
CREATE TABLE IF NOT EXISTS publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS publisher_id UUID REFERENCES publishers(id);

CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers(name);
CREATE INDEX IF NOT EXISTS idx_produtos_publisher_id ON produtos(publisher_id);

ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers são públicos" ON publishers FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem criar publishers" ON publishers FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem atualizar publishers" ON publishers FOR UPDATE USING (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem deletar publishers" ON publishers FOR DELETE USING (auth.role() = 'admin');