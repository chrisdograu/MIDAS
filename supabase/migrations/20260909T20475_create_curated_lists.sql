-- Criar tabela de listas curadas
CREATE TABLE IF NOT EXISTS curated_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curated_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES curated_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, product_id)
);

CREATE TABLE IF NOT EXISTS curated_list_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES curated_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES curated_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX idx_curated_lists_created_by ON curated_lists(created_by);
CREATE INDEX idx_curated_lists_is_public ON curated_lists(is_public);
CREATE INDEX idx_curated_list_items_list_id ON curated_list_items(list_id);
CREATE INDEX idx_curated_list_follows_list_id ON curated_list_follows(list_id);
CREATE INDEX idx_curated_list_follows_user_id ON curated_list_follows(user_id);

ALTER TABLE curated_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_list_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listas públicas são visíveis" ON curated_lists FOR SELECT USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "Usuários podem criar listas" ON curated_lists FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Usuários podem editar suas listas" ON curated_lists FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Usuários podem deletar suas listas" ON curated_lists FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Itens de listas públicas são visíveis" ON curated_list_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM curated_lists WHERE id = list_id AND (is_public = true OR created_by = auth.uid())));

CREATE POLICY "Usuários podem gerenciar itens de suas listas" ON curated_list_items
  FOR ALL USING (EXISTS (SELECT 1 FROM curated_lists WHERE id = list_id AND created_by = auth.uid()));

CREATE POLICY "Usuários podem seguir listas" ON curated_list_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem ver seguidores" ON curated_list_follows FOR SELECT USING (true);
CREATE POLICY "Usuários podem deixar de seguir" ON curated_list_follows FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem gerenciar suas listas salvas" ON saved_lists FOR ALL USING (auth.uid() = user_id);