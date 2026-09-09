ALTER TABLE public.reviews_completas
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spoiler_achievement_name text;