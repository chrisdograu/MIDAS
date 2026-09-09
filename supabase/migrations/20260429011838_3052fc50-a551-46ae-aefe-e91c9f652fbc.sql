
-- ============================
-- 1) USER FOLLOWS
-- ============================
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT user_follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows"
  ON public.user_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow"
  ON public.user_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id AND NOT public.is_user_banned(auth.uid()));

CREATE POLICY "Users can unfollow"
  ON public.user_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ============================
-- 2) NOTIFICATION TYPE: novo_seguidor
-- ============================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'novo_seguidor'
      AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'novo_seguidor';
  END IF;
END$$;
