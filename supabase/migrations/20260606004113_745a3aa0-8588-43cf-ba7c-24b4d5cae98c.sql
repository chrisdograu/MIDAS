
-- BLOCO A
CREATE TABLE IF NOT EXISTS public.tournament_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reminder_window text NOT NULL CHECK (reminder_window IN ('7d','1d','1h')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id, reminder_window)
);
GRANT SELECT, INSERT ON public.tournament_reminder_log TO authenticated;
GRANT ALL ON public.tournament_reminder_log TO service_role;
ALTER TABLE public.tournament_reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_select_own" ON public.tournament_reminder_log FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "log_service_all" ON public.tournament_reminder_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- BLOCO B: Opiniões
CREATE TABLE IF NOT EXISTS public.game_opinions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  images text[] DEFAULT '{}' CHECK (array_length(images,1) IS NULL OR array_length(images,1) <= 3),
  likes_count int NOT NULL DEFAULT 0,
  replies_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_opinions TO authenticated;
GRANT ALL ON public.game_opinions TO service_role;
ALTER TABLE public.game_opinions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opinions_select_friends_or_self" ON public.game_opinions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.are_mutual_friends(user_id, auth.uid()));
CREATE POLICY "opinions_insert_self" ON public.game_opinions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "opinions_update_self" ON public.game_opinions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "opinions_delete_self_or_admin" ON public.game_opinions FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_game_opinions_product ON public.game_opinions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_opinions_user ON public.game_opinions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.game_opinion_likes (
  opinion_id uuid NOT NULL REFERENCES public.game_opinions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opinion_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.game_opinion_likes TO authenticated;
GRANT ALL ON public.game_opinion_likes TO service_role;
ALTER TABLE public.game_opinion_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ol_select" ON public.game_opinion_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "ol_insert" ON public.game_opinion_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ol_delete" ON public.game_opinion_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_opinion_likes_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.game_opinions SET likes_count = likes_count+1 WHERE id = NEW.opinion_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.game_opinions SET likes_count = GREATEST(0, likes_count-1) WHERE id = OLD.opinion_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
CREATE TRIGGER trg_update_opinion_likes AFTER INSERT OR DELETE ON public.game_opinion_likes
FOR EACH ROW EXECUTE FUNCTION public.update_opinion_likes_count();

CREATE TABLE IF NOT EXISTS public.game_opinion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id uuid NOT NULL REFERENCES public.game_opinions(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  images text[] DEFAULT '{}' CHECK (array_length(images,1) IS NULL OR array_length(images,1) <= 3),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.game_opinion_replies TO authenticated;
GRANT ALL ON public.game_opinion_replies TO service_role;
ALTER TABLE public.game_opinion_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reply_select_pair" ON public.game_opinion_replies FOR SELECT TO authenticated USING (
  responder_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.game_opinions o WHERE o.id = opinion_id AND o.user_id = auth.uid())
);
CREATE POLICY "reply_insert_pair" ON public.game_opinion_replies FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND (
    (responder_id = auth.uid() AND EXISTS (SELECT 1 FROM public.game_opinions o WHERE o.id = opinion_id AND public.are_mutual_friends(o.user_id, auth.uid())))
    OR EXISTS (SELECT 1 FROM public.game_opinions o WHERE o.id = opinion_id AND o.user_id = auth.uid())
  )
);
CREATE POLICY "reply_delete_self" ON public.game_opinion_replies FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_opinion_replies ON public.game_opinion_replies(opinion_id, responder_id, created_at);

CREATE OR REPLACE FUNCTION public.update_opinion_replies_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE distinct_count int;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT COUNT(DISTINCT responder_id) INTO distinct_count FROM public.game_opinion_replies WHERE opinion_id = NEW.opinion_id;
    UPDATE public.game_opinions SET replies_count = distinct_count WHERE id = NEW.opinion_id;
  ELSIF TG_OP='DELETE' THEN
    SELECT COUNT(DISTINCT responder_id) INTO distinct_count FROM public.game_opinion_replies WHERE opinion_id = OLD.opinion_id;
    UPDATE public.game_opinions SET replies_count = distinct_count WHERE id = OLD.opinion_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
CREATE TRIGGER trg_update_opinion_replies AFTER INSERT OR DELETE ON public.game_opinion_replies
FOR EACH ROW EXECUTE FUNCTION public.update_opinion_replies_count();

CREATE OR REPLACE FUNCTION public.notify_opinion_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE op_author uuid; op_product uuid; sender_name text;
BEGIN
  SELECT user_id, product_id INTO op_author, op_product FROM public.game_opinions WHERE id = NEW.opinion_id;
  IF op_author IS NULL OR op_author = NEW.sender_id THEN RETURN NEW; END IF;
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
  VALUES (op_author, 'nova_mensagem', COALESCE(sender_name,'Alguém') || ' respondeu sua opinião',
          substring(NEW.text from 1 for 120), 'opinion_reply', NEW.opinion_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_opinion_reply AFTER INSERT ON public.game_opinion_replies
FOR EACH ROW EXECUTE FUNCTION public.notify_opinion_reply();

-- Screenshots
CREATE TABLE IF NOT EXISTS public.game_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  caption text CHECK (caption IS NULL OR length(caption) <= 500),
  images text[] NOT NULL CHECK (array_length(images,1) >= 1 AND array_length(images,1) <= 10),
  likes_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_screenshots TO authenticated;
GRANT ALL ON public.game_screenshots TO service_role;
ALTER TABLE public.game_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_select" ON public.game_screenshots FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.are_mutual_friends(user_id, auth.uid()));
CREATE POLICY "ss_insert" ON public.game_screenshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ss_delete" ON public.game_screenshots FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.game_screenshot_likes (
  screenshot_id uuid NOT NULL REFERENCES public.game_screenshots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (screenshot_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.game_screenshot_likes TO authenticated;
GRANT ALL ON public.game_screenshot_likes TO service_role;
ALTER TABLE public.game_screenshot_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ssl_select" ON public.game_screenshot_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssl_insert" ON public.game_screenshot_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ssl_delete" ON public.game_screenshot_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_screenshot_likes_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.game_screenshots SET likes_count = likes_count+1 WHERE id = NEW.screenshot_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.game_screenshots SET likes_count = GREATEST(0, likes_count-1) WHERE id = OLD.screenshot_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
CREATE TRIGGER trg_update_ss_likes AFTER INSERT OR DELETE ON public.game_screenshot_likes
FOR EACH ROW EXECUTE FUNCTION public.update_screenshot_likes_count();

-- BLOCO C: Privacidade
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS library_visibility text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS privacy_exceptions uuid[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.privacy_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('reviews_completas','screenshots','opinions','stats','achievements','library_items','full')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, viewer_id, scope)
);
GRANT SELECT, INSERT, DELETE ON public.privacy_grants TO authenticated;
GRANT ALL ON public.privacy_grants TO service_role;
ALTER TABLE public.privacy_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pg_owner_all" ON public.privacy_grants FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "pg_viewer_select" ON public.privacy_grants FOR SELECT TO authenticated USING (viewer_id = auth.uid());

-- BLOCO E: mutes
CREATE TABLE IF NOT EXISTS public.user_game_mutes (
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'both' CHECK (scope IN ('feed','social_library','both')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_game_mutes TO authenticated;
GRANT ALL ON public.user_game_mutes TO service_role;
ALTER TABLE public.user_game_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_self" ON public.user_game_mutes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.opinion_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid,
  target_product_id uuid,
  kind text NOT NULL CHECK (kind IN ('opinion_user','opinion_game','screenshot_user','screenshot_game')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_opinion_mutes ON public.opinion_mutes (user_id, kind, COALESCE(target_user_id,'00000000-0000-0000-0000-000000000000'::uuid), COALESCE(target_product_id,'00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, DELETE ON public.opinion_mutes TO authenticated;
GRANT ALL ON public.opinion_mutes TO service_role;
ALTER TABLE public.opinion_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "om_self" ON public.opinion_mutes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Atualiza checagens de visibilidade
CREATE OR REPLACE FUNCTION public.can_view_friend_content(_owner uuid, _viewer uuid, _visibility text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _owner = _viewer
    OR _visibility = 'public'
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _owner AND _viewer = ANY(p.privacy_exceptions))
    OR (_visibility = 'friends' AND public.are_mutual_friends(_owner, _viewer))
    OR (_visibility = 'private' AND public.is_close_friend(_owner, _viewer));
$$;

CREATE OR REPLACE FUNCTION public.can_view_scope(_owner uuid, _viewer uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _owner = _viewer
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _owner AND _viewer = ANY(p.privacy_exceptions))
    OR EXISTS (SELECT 1 FROM public.privacy_grants g WHERE g.owner_id=_owner AND g.viewer_id=_viewer AND g.scope IN (_scope,'full'));
$$;

-- BLOCO D: menções restritas
CREATE OR REPLACE FUNCTION public.notify_mention() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allowed boolean := false; group_id_v uuid;
BEGIN
  IF NEW.mentioned_user_id = NEW.mentioned_by THEN RETURN NEW; END IF;
  IF NEW.source_type IN ('forum_post','forum_reply','review','review_comment') THEN
    allowed := true;
  ELSIF NEW.source_type = 'group_message' THEN
    SELECT m.group_id INTO group_id_v FROM public.mensagens m WHERE m.id = NEW.source_id;
    IF group_id_v IS NOT NULL AND public.is_group_member(group_id_v, NEW.mentioned_user_id) THEN
      allowed := true;
    END IF;
  END IF;
  IF NOT allowed THEN RETURN NEW; END IF;

  INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
  VALUES (NEW.mentioned_user_id, 'nova_mensagem', 'Você foi mencionado',
          COALESCE(NEW.context_preview,'Alguém te mencionou'), NEW.source_type, NEW.source_id);
  RETURN NEW;
END;$$;

-- BLOCO F: galeria de bundles
ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

CREATE TRIGGER trg_opinions_updated_at BEFORE UPDATE ON public.game_opinions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
