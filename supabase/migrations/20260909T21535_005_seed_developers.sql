-- ============================================
-- SEED DEVELOPERS (Dados da Wikipedia)
-- ============================================

INSERT INTO developers (
  id, name, slug, description, bio, logo_url, website, founded_year,
  country, headquarters, employees, parent_company, notable_games,
  wikipedia_url, social_links, created_at
) VALUES
(
  gen_random_uuid(),
  'FromSoftware',
  'fromsoftware',
  E'FromSoftware, Inc. é uma desenvolvedora e publicadora japonesa de jogos eletrônicos fundada em 1º de novembro de 1986. A empresa é conhecida por suas franquias de jogos de ação e RPG, como Dark Souls, Bloodborne, Sekiro: Shadows Die Twice e Elden Ring.\n\nOs jogos da FromSoftware são caracterizados por sua dificuldade desafiadora, design de mundo interconectado, narrativa ambiental e combate tático. A empresa é liderada por Hidetaka Miyazaki, que se tornou presidente em 2014 e é considerado um dos diretores de jogos mais influentes da atualidade.\n\nA FromSoftware foi adquirida pela Kadokawa Corporation em 2014, mantendo sua independência criativa.',
  E'Desenvolvedora japonesa famosa por Dark Souls, Elden Ring e Bloodborne. Fundada em 1986, é conhecida por jogos com dificuldade desafiadora e design de mundo interconectado.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/5/51/FromSoftware_logo.svg/200px-FromSoftware_logo.svg.png',
  'https://www.fromsoftware.jp/',
  1986,
  'Japão',
  'Tóquio, Japão',
  384,
  'Kadokawa Corporation',
  ARRAY['Elden Ring', 'Dark Souls', 'Bloodborne', 'Sekiro: Shadows Die Twice', 'Demon''s Souls'],
  'https://en.wikipedia.org/wiki/FromSoftware',
  '{"twitter": "https://twitter.com/fromsoftware_pr", "youtube": "https://www.youtube.com/user/fromsoftware"}',
  NOW()
),
(
  gen_random_uuid(),
  'Nintendo',
  'nintendo',
  E'Nintendo Co., Ltd. é uma empresa japonesa de jogos eletrônicos fundada em 23 de setembro de 1889. É uma das mais influentes da indústria, criando franquias como Super Mario, The Legend of Zelda, Pokémon, Metroid e Animal Crossing.\n\nA Nintendo é conhecida por sua inovação em hardware e jogabilidade, tendo criado consoles como Nintendo Entertainment System, Super Nintendo, Nintendo 64, Game Boy, Nintendo DS, Wii e Nintendo Switch. A empresa tem sua sede em Quioto, Japão.',
  E'Fundada em 1889, a Nintendo é a criadora de Super Mario, Zelda, Pokémon e outras franquias icônicas.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/3/39/Nintendo_logo.svg/200px-Nintendo_logo.svg.png',
  'https://www.nintendo.com/',
  1889,
  'Japão',
  'Quioto, Japão',
  7900,
  NULL,
  ARRAY['Super Mario', 'The Legend of Zelda', 'Pokémon', 'Metroid', 'Animal Crossing'],
  'https://en.wikipedia.org/wiki/Nintendo',
  '{"twitter": "https://twitter.com/NintendoAmerica", "youtube": "https://www.youtube.com/Nintendo", "instagram": "https://www.instagram.com/nintendo/"}',
  NOW()
),
(
  gen_random_uuid(),
  'CD Projekt Red',
  'cd-projekt-red',
  E'CD Projekt Red (ou CDPR) é uma desenvolvedora polonesa de jogos eletrônicos fundada em 2002, conhecida principalmente pela série The Witcher e o jogo Cyberpunk 2077.\n\nA CD Projekt Red é uma divisão da CD Projekt, publicadora polonesa. O estúdio é conhecido por seus jogos de mundo aberto com narrativa profunda, escolhas morais e finais múltiplos.',
  E'Estúdio polonês criador da série The Witcher e Cyberpunk 2077. Fundado em 2002.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/3/31/CD_Projekt_Red_logo.svg/200px-CD_Projekt_Red_logo.svg.png',
  'https://www.cdprojektred.com/',
  2002,
  'Polônia',
  'Varsóvia, Polônia',
  600,
  'CD Projekt Group',
  ARRAY['The Witcher 3: Wild Hunt', 'Cyberpunk 2077', 'The Witcher 2'],
  'https://en.wikipedia.org/wiki/CD_Projekt_Red',
  '{"twitter": "https://twitter.com/CDPROJEKTRED", "youtube": "https://www.youtube.com/CDPROJEKTRED"}',
  NOW()
),
(
  gen_random_uuid(),
  'Rockstar Games',
  'rockstar-games',
  E'Rockstar Games é uma desenvolvedora e publicadora americana fundada em 1998, conhecida pela série Grand Theft Auto, Red Dead Redemption e Max Payne.\n\nA Rockstar é conhecida por seus jogos de mundo aberto com narrativa cinematográfica, sátira social e liberdade de exploração.',
  E'Criadora de Grand Theft Auto e Red Dead Redemption. Conhecida por mundos abertos detalhados.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/6/61/Rockstar_Games_logo.svg/200px-Rockstar_Games_logo.svg.png',
  'https://www.rockstargames.com/',
  1998,
  'EUA',
  'Nova York, EUA',
  2000,
  'Take-Two Interactive',
  ARRAY['Grand Theft Auto V', 'Red Dead Redemption 2', 'Grand Theft Auto IV'],
  'https://en.wikipedia.org/wiki/Rockstar_Games',
  '{"twitter": "https://twitter.com/RockstarGames", "youtube": "https://www.youtube.com/RockstarGames"}',
  NOW()
),
(
  gen_random_uuid(),
  'Ubisoft',
  'ubisoft',
  E'Ubisoft Entertainment SA é uma desenvolvedora e publicadora francesa fundada em 1986, conhecida por franquias como Assassin''s Creed, Far Cry, Watch Dogs, Rainbow Six e Just Dance.\n\nA Ubisoft tem estúdios em todo o mundo, com mais de 20.000 funcionários. A empresa é conhecida por seus jogos de mundo aberto, com ênfase em exploração e liberdade.',
  E'Publicadora francesa criadora de Assassin''s Creed, Far Cry e Rainbow Six. Fundada em 1986.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/2/2c/Ubisoft_logo.svg/200px-Ubisoft_logo.svg.png',
  'https://www.ubisoft.com/',
  1986,
  'França',
  'Saint-Mandé, França',
  21000,
  NULL,
  ARRAY['Assassin''s Creed', 'Far Cry', 'Watch Dogs', 'Rainbow Six Siege'],
  'https://en.wikipedia.org/wiki/Ubisoft',
  '{"twitter": "https://twitter.com/Ubisoft", "youtube": "https://www.youtube.com/Ubisoft"}',
  NOW()
);

-- Vincular produtos existentes aos desenvolvedores
UPDATE produtos SET developer_id = (SELECT id FROM developers WHERE slug = 'fromsoftware')
WHERE title ILIKE '%Dark Souls%' 
   OR title ILIKE '%Elden Ring%' 
   OR title ILIKE '%Bloodborne%' 
   OR title ILIKE '%Sekiro%';

UPDATE produtos SET developer_id = (SELECT id FROM developers WHERE slug = 'nintendo')
WHERE title ILIKE '%Super Mario%' 
   OR title ILIKE '%Zelda%' 
   OR title ILIKE '%Pokémon%' 
   OR title ILIKE '%Metroid%';

UPDATE produtos SET developer_id = (SELECT id FROM developers WHERE slug = 'cd-projekt-red')
WHERE title ILIKE '%Witcher%' 
   OR title ILIKE '%Cyberpunk%';

UPDATE produtos SET developer_id = (SELECT id FROM developers WHERE slug = 'rockstar-games')
WHERE title ILIKE '%Grand Theft Auto%' 
   OR title ILIKE '%Red Dead%';

UPDATE produtos SET developer_id = (SELECT id FROM developers WHERE slug = 'ubisoft')
WHERE title ILIKE '%Assassin''s Creed%' 
   OR title ILIKE '%Far Cry%' 
   OR title ILIKE '%Watch Dogs%';