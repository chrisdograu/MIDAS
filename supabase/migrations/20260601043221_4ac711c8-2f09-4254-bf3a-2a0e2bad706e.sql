
DROP FUNCTION IF EXISTS public.are_mutual_friends(uuid, uuid);

CREATE TABLE IF NOT EXISTS public.close_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.close_friends TO authenticated;
GRANT ALL ON public.close_friends TO service_role;

ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User manages own close friends" ON public.close_friends;
CREATE POLICY "User manages own close friends" ON public.close_friends
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.review_screenshots
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS owner_id uuid;

ALTER TABLE public.game_clips
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'friends';

ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

UPDATE public.review_screenshots rs
SET owner_id = a.user_id
FROM public.avaliacoes a
WHERE rs.review_id = a.id AND rs.owner_id IS NULL;

CREATE OR REPLACE FUNCTION public.are_mutual_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.status = 'accepted'
      AND ((c.participant_1 = _a AND c.participant_2 = _b)
        OR (c.participant_1 = _b AND c.participant_2 = _a))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_close_friend(_owner uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.close_friends
    WHERE user_id = _owner AND friend_id = _viewer
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_friend_content(_owner uuid, _viewer uuid, _visibility text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _owner = _viewer
    OR _visibility = 'public'
    OR (_visibility = 'friends' AND public.are_mutual_friends(_owner, _viewer))
    OR (_visibility = 'private' AND public.is_close_friend(_owner, _viewer));
$$;

CREATE OR REPLACE FUNCTION public.notify_friends_game_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid; v_product uuid; v_title text; v_body text;
  v_type notification_type; v_ref_type text; v_ref_id uuid;
  v_friend uuid; v_product_title text;
BEGIN
  IF TG_TABLE_NAME = 'avaliacoes' THEN
    v_actor := NEW.user_id; v_product := NEW.product_id;
    v_type := 'nova_mensagem'; v_ref_type := 'review'; v_ref_id := NEW.id;
    v_title := 'Novo review de amigo';
  ELSIF TG_TABLE_NAME = 'game_clips' THEN
    v_actor := NEW.user_id; v_product := NEW.product_id;
    v_type := 'nova_mensagem'; v_ref_type := 'clip'; v_ref_id := NEW.id;
    v_title := 'Novo clipe de amigo';
  ELSIF TG_TABLE_NAME = 'biblioteca_usuario' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
    v_actor := NEW.user_id; v_product := NEW.product_id;
    v_type := 'nova_mensagem'; v_ref_type := 'library'; v_ref_id := NEW.id;
    v_title := 'Amigo atualizou biblioteca';
  ELSIF TG_TABLE_NAME = 'forum_posts' THEN
    IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
    v_actor := NEW.user_id; v_product := NEW.product_id;
    v_type := 'nova_mensagem'; v_ref_type := 'forum_post'; v_ref_id := NEW.id;
    v_title := 'Nova discussão de amigo';
  ELSE
    RETURN NEW;
  END IF;

  SELECT title INTO v_product_title FROM public.produtos WHERE id = v_product;
  v_body := COALESCE(v_product_title, 'Jogo');

  FOR v_friend IN
    SELECT CASE WHEN c.participant_1 = v_actor THEN c.participant_2 ELSE c.participant_1 END
    FROM public.conversas c
    WHERE c.status = 'accepted'
      AND (c.participant_1 = v_actor OR c.participant_2 = v_actor)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (v_friend, v_type, v_title, v_body, v_ref_type, v_ref_id);
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_friends_review ON public.avaliacoes;
CREATE TRIGGER trg_notify_friends_review AFTER INSERT ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.notify_friends_game_activity();

DROP TRIGGER IF EXISTS trg_notify_friends_clip ON public.game_clips;
CREATE TRIGGER trg_notify_friends_clip AFTER INSERT ON public.game_clips
  FOR EACH ROW EXECUTE FUNCTION public.notify_friends_game_activity();

DROP TRIGGER IF EXISTS trg_notify_friends_library ON public.biblioteca_usuario;
CREATE TRIGGER trg_notify_friends_library AFTER INSERT OR UPDATE ON public.biblioteca_usuario
  FOR EACH ROW EXECUTE FUNCTION public.notify_friends_game_activity();

DROP TRIGGER IF EXISTS trg_notify_friends_post ON public.forum_posts;
CREATE TRIGGER trg_notify_friends_post AFTER INSERT ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_friends_game_activity();
