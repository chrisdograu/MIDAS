ALTER TABLE public.game_screenshots
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spoiler_achievement_name text;

ALTER TABLE public.game_clips
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spoiler_achievement_name text;

ALTER TABLE public.game_opinions
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spoiler_achievement_name text;