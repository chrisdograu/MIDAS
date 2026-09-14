
CREATE TABLE IF NOT EXISTS public.forum_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.forum_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post likes" ON public.forum_post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON public.forum_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_user_banned(auth.uid()));
CREATE POLICY "Users can unlike posts" ON public.forum_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.forum_reply_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, user_id)
);
ALTER TABLE public.forum_reply_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reply likes" ON public.forum_reply_likes FOR SELECT USING (true);
CREATE POLICY "Users can like replies" ON public.forum_reply_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_user_banned(auth.uid()));
CREATE POLICY "Users can unlike replies" ON public.forum_reply_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_forum_post_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_forum_post_likes_count ON public.forum_post_likes;
CREATE TRIGGER trg_forum_post_likes_count
AFTER INSERT OR DELETE ON public.forum_post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_forum_post_likes_count();

CREATE OR REPLACE FUNCTION public.update_forum_reply_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_replies SET likes_count = likes_count + 1 WHERE id = NEW.reply_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_replies SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.reply_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_forum_reply_likes_count ON public.forum_reply_likes;
CREATE TRIGGER trg_forum_reply_likes_count
AFTER INSERT OR DELETE ON public.forum_reply_likes
FOR EACH ROW EXECUTE FUNCTION public.update_forum_reply_likes_count();
