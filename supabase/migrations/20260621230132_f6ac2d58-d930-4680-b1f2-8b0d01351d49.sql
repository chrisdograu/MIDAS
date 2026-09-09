
-- Fase 1: melhorar spoilers — vincular por NOME da conquista (que liga a user_achievements via product_id + name)
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS spoiler_achievement_name text;

ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS spoiler_achievement_name text,
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false;
