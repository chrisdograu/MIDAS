-- ============================================================
-- MIGRAÇÃO DESKTOP: Adicionar developer_id e publisher_id em produtos
-- ============================================================

-- Adicionar colunas
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES developers(id) ON DELETE SET NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_developer_id ON produtos(developer_id);
CREATE INDEX IF NOT EXISTS idx_produtos_publisher_id ON produtos(publisher_id);

-- Comentários
COMMENT ON COLUMN produtos.developer_id IS 'ID do desenvolvedor do jogo (relacionamento com developers)';
COMMENT ON COLUMN produtos.publisher_id IS 'ID da publicadora do jogo (relacionamento com publishers)';