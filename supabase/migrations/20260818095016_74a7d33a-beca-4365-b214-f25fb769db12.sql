ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS catalog_game_id uuid REFERENCES public.games_catalog(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_catalog_game_id ON public.produtos(catalog_game_id);

-- Backfill por titulo normalizado (remove sufixos de edicao/plataforma)
WITH norm AS (
  SELECT p.id AS produto_id, g.id AS game_id,
         row_number() OVER (PARTITION BY p.id ORDER BY g.popularity DESC) AS rn
  FROM public.produtos p
  JOIN public.games_catalog g
    ON lower(regexp_replace(split_part(p.title, ' - ', 1), '\s*\((.*)\)\s*$', '', 'g')) = lower(g.title)
  WHERE p.catalog_game_id IS NULL
)
UPDATE public.produtos p SET catalog_game_id = n.game_id
FROM norm n WHERE n.produto_id = p.id AND n.rn = 1;