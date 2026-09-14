-- ============================================
-- SEED PUBLISHERS (Dados da Wikipedia)
-- ============================================

INSERT INTO publishers (
  id, name, slug, description, bio, logo_url, website, founded_year,
  country, headquarters, notable_games, wikipedia_url
) VALUES
(
  gen_random_uuid(),
  'Bandai Namco Entertainment',
  'bandai-namco',
  E'Bandai Namco Entertainment é uma publicadora japonesa de jogos eletrônicos formada pela fusão da Bandai e da Namco em 2005. A empresa publica jogos de várias franquias populares, incluindo Tekken, Soulcalibur, Tales, Pac-Man e jogos licenciados de anime como Dragon Ball e Naruto.',
  E'Publicadora japonesa criada em 2005 pela fusão de Bandai e Namco. Publica jogos como Tekken, Soulcalibur e Dragon Ball.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/Bandai_Namco_Entertainment_logo.svg/200px-Bandai_Namco_Entertainment_logo.svg.png',
  'https://www.bandainamcoent.com/',
  2005,
  'Japão',
  'Tóquio, Japão',
  ARRAY['Tekken 8', 'Elden Ring', 'Dragon Ball: Sparking! Zero'],
  'https://en.wikipedia.org/wiki/Bandai_Namco_Entertainment'
),
(
  gen_random_uuid(),
  'Electronic Arts',
  'electronic-arts',
  E'Electronic Arts (EA) é uma publicadora americana fundada em 1982, conhecida por franquias como FIFA, Madden NFL, Battlefield, The Sims, Need for Speed e Star Wars: Jedi.',
  E'Publicadora americana fundada em 1982. Criadora de FIFA, Battlefield, The Sims e Need for Speed.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/Electronic_Arts_logo.svg/200px-Electronic_Arts_logo.svg.png',
  'https://www.ea.com/',
  1982,
  'EUA',
  'Redwood City, EUA',
  ARRAY['FIFA 23', 'Battlefield 2042', 'The Sims 4'],
  'https://en.wikipedia.org/wiki/Electronic_Arts'
),
(
  gen_random_uuid(),
  'Activision',
  'activision',
  E'Activision Publishing é uma publicadora americana fundada em 1979, atualmente parte da Activision Blizzard. A empresa publica franquias como Call of Duty, Tony Hawk''s Pro Skater, Guitar Hero e Skylanders.',
  E'Publicadora americana fundada em 1979. Criadora de Call of Duty, Tony Hawk e Guitar Hero.',
  'https://upload.wikimedia.org/wikipedia/en/thumb/2/24/Activision_logo.svg/200px-Activision_logo.svg.png',
  'https://www.activision.com/',
  1979,
  'EUA',
  'Santa Monica, EUA',
  ARRAY['Call of Duty: Modern Warfare II', 'Tony Hawk''s Pro Skater 1+2'],
  'https://en.wikipedia.org/wiki/Activision'
);