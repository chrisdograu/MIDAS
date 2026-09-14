ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.forum_replies ADD COLUMN IF NOT EXISTS is_solution boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_forum_posts_cat_pinned_created ON public.forum_posts (category_slug, is_pinned DESC, created_at DESC);