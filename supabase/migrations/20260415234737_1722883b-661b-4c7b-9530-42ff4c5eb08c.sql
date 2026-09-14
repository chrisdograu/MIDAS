
-- 1. Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks" ON public.blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others" ON public.blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock" ON public.blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

CREATE POLICY "Admins can manage blocks" ON public.blocked_users
  FOR ALL USING (public.is_admin());

-- 2. Add notification preferences to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT false;

-- 3. Add plataformas array and user_id to anuncios
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS plataformas TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT NULL;

-- 4. Make game_title and platform nullable in anuncios
ALTER TABLE public.anuncios ALTER COLUMN game_title DROP NOT NULL;
ALTER TABLE public.anuncios ALTER COLUMN platform DROP NOT NULL;

-- 5. Make product_id nullable in certificados
ALTER TABLE public.certificados ALTER COLUMN product_id DROP NOT NULL;
