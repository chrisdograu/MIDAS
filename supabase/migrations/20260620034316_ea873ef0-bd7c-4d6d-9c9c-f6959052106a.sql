
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS achievement_lock uuid REFERENCES public.user_achievements(id) ON DELETE SET NULL;

ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS achievement_lock uuid REFERENCES public.user_achievements(id) ON DELETE SET NULL;

ALTER TABLE public.game_timeline_events
  ADD COLUMN IF NOT EXISTS user_note text;
