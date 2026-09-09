
-- 1. Conversas
CREATE TABLE public.conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 uuid NOT NULL,
  participant_2 uuid NOT NULL,
  anuncio_id uuid REFERENCES public.anuncios(id),
  last_message text,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage conversations" ON public.conversas FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Participants can view own conversations" ON public.conversas FOR SELECT TO authenticated USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Users can create conversations" ON public.conversas FOR INSERT TO authenticated WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Participants can update own conversations" ON public.conversas FOR UPDATE TO authenticated USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- 2. Forum Posts
CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.produtos(id),
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view forum posts" ON public.forum_posts FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage forum posts" ON public.forum_posts FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can create forum posts" ON public.forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own forum posts" ON public.forum_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own forum posts" ON public.forum_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Forum Replies
CREATE TABLE public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view forum replies" ON public.forum_replies FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage forum replies" ON public.forum_replies FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can create forum replies" ON public.forum_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own forum replies" ON public.forum_replies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own forum replies" ON public.forum_replies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger para updated_at no forum_posts
CREATE TRIGGER update_forum_posts_updated_at
BEFORE UPDATE ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
