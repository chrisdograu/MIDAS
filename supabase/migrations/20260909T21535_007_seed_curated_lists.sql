-- ============================================
-- SEED CURATED LISTS (Oficiais MIDIAS)
-- ============================================

DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- Pegar o ID do administrador
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;
  
  IF admin_id IS NULL THEN
    admin_id := NULL;
  END IF;

  -- Lista 1: Os Melhores Jogos de Todos os Tempos
  INSERT INTO curated_lists (
    id, title, slug, description, long_description,
    category, is_official, is_featured, is_public,
    created_by, approved_by, approved_at, created_at
  ) VALUES (
    gen_random_uuid(),
    'Os Melhores Jogos de Todos os Tempos',
    'melhores-jogos-todos-tempos',
    E'Uma seleção dos jogos mais aclamados pela crítica e pelo público, que definiram gerações.',
    E'Esta lista reúne os jogos que receberam as maiores notas da crítica, que venderam milhões de cópias, que influenciaram outros desenvolvedores e que continuam sendo jogados e amados por fãs ao redor do mundo.',
    'oficial',
    true,
    true,
    true,
    admin_id,
    admin_id,
    NOW(),
    NOW()
  );

  -- Lista 2: Indie Games que Você Precisa Jogar
  INSERT INTO curated_lists (
    id, title, slug, description, long_description,
    category, is_official, is_featured, is_public,
    created_by, approved_by, approved_at, created_at
  ) VALUES (
    gen_random_uuid(),
    'Indie Games que Você Precisa Jogar',
    'indie-essenciais',
    E'Jogos independentes que provam que inovação e criatividade não dependem de grandes orçamentos.',
    E'O cenário indie tem produzido alguns dos jogos mais criativos e emocionantes dos últimos anos. Esta lista reúne os melhores jogos independentes.',
    'indie',
    true,
    true,
    true,
    admin_id,
    admin_id,
    NOW(),
    NOW()
  );

  -- Lista 3: Clássicos que Definiram Gerações
  INSERT INTO curated_lists (
    id, title, slug, description, long_description,
    category, is_official, is_featured, is_public,
    created_by, approved_by, approved_at, created_at
  ) VALUES (
    gen_random_uuid(),
    'Clássicos que Definiram Gerações',
    'classicos-geracoes',
    E'Os jogos que moldaram a história dos videogames e continuam sendo referência até hoje.',
    E'Esta lista celebra os clássicos que criaram gêneros, que apresentaram inovações revolucionárias e que ainda hoje são lembrados com carinho por milhões de jogadores.',
    'classicos',
    true,
    false,
    true,
    admin_id,
    admin_id,
    NOW(),
    NOW()
  );

  -- Lista 4: Recomendações da Comunidade
  INSERT INTO curated_lists (
    id, title, slug, description, long_description,
    category, is_official, is_featured, is_public,
    created_by, approved_by, approved_at, created_at
  ) VALUES (
    gen_random_uuid(),
    'Recomendações da Comunidade MIDIAS',
    'recomendacoes-comunidade',
    E'Os jogos mais recomendados pela nossa comunidade de gamers.',
    E'Quem melhor para recomendar jogos do que outros jogadores? Esta lista é alimentada pelas recomendações dos usuários da MIDIAS.',
    'recomendados',
    false,
    false,
    true,
    admin_id,
    NULL,
    NULL,
    NOW()
  );

END $$;