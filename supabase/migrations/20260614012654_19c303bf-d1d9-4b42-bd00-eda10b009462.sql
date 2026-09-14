
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#14B8A6',
  ADD COLUMN IF NOT EXISTS profile_cover_url TEXT,
  ADD COLUMN IF NOT EXISTS trophy_showcase TEXT[] DEFAULT '{}'::TEXT[];

CREATE TABLE IF NOT EXISTS public.library_custom_covers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  cover_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

GRANT SELECT ON public.library_custom_covers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_custom_covers TO authenticated;
GRANT ALL ON public.library_custom_covers TO service_role;

ALTER TABLE public.library_custom_covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view custom covers"
  ON public.library_custom_covers FOR SELECT
  USING (true);

CREATE POLICY "Users manage own custom covers"
  ON public.library_custom_covers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tutorials_seen
  ADD COLUMN IF NOT EXISTS step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
