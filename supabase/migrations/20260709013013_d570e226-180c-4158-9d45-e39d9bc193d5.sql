
-- =====================================================================
-- 1) OWNER DE GRUPO
-- =====================================================================
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill: quem criou o grupo é o dono.
UPDATE public.groups SET owner_id = created_by WHERE owner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);

-- Garante que o owner é sempre admin no group_members.
INSERT INTO public.group_members (group_id, user_id, role)
SELECT g.id, g.owner_id, 'admin'::group_role
FROM public.groups g
WHERE g.owner_id IS NOT NULL
ON CONFLICT (group_id, user_id) DO UPDATE
  SET role = 'admin'::group_role;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group AND owner_id = _user);
$$;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated;

-- Nova trigger de sucessão que respeita o owner:
CREATE OR REPLACE FUNCTION public.group_members_prevent_orphan()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_next_admin uuid;
  v_next_member uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.groups WHERE id = OLD.group_id;

  -- Se o que saiu era o owner, precisa promover sucessor.
  IF v_owner = OLD.user_id THEN
    SELECT user_id INTO v_next_admin
      FROM public.group_members
     WHERE group_id = OLD.group_id AND role = 'admin' AND user_id <> OLD.user_id
     ORDER BY joined_at ASC LIMIT 1;

    IF v_next_admin IS NOT NULL THEN
      UPDATE public.groups SET owner_id = v_next_admin WHERE id = OLD.group_id;
      RETURN OLD;
    END IF;

    -- Sem admin restante — promove o membro mais antigo a admin+owner.
    SELECT user_id INTO v_next_member
      FROM public.group_members
     WHERE group_id = OLD.group_id AND user_id <> OLD.user_id
     ORDER BY joined_at ASC LIMIT 1;

    IF v_next_member IS NOT NULL THEN
      UPDATE public.group_members SET role = 'admin'
        WHERE group_id = OLD.group_id AND user_id = v_next_member;
      UPDATE public.groups SET owner_id = v_next_member WHERE id = OLD.group_id;
      RETURN OLD;
    END IF;

    -- Grupo ficou vazio.
    DELETE FROM public.groups WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;

  -- Não era owner mas era admin: se não sobrar admin, promove o mais antigo.
  IF OLD.role = 'admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.group_members
       WHERE group_id = OLD.group_id AND role = 'admin' AND user_id <> OLD.user_id
    ) THEN
      SELECT user_id INTO v_next_member
        FROM public.group_members
       WHERE group_id = OLD.group_id AND user_id <> OLD.user_id
       ORDER BY joined_at ASC LIMIT 1;
      IF v_next_member IS NOT NULL THEN
        UPDATE public.group_members SET role = 'admin'
          WHERE group_id = OLD.group_id AND user_id = v_next_member;
      END IF;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Policy adicional: dono pode deletar o próprio grupo
DROP POLICY IF EXISTS "Owner deletes group" ON public.groups;
CREATE POLICY "Owner deletes group"
  ON public.groups FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

-- =====================================================================
-- 2) TORNEIOS — MODO LIVE
-- =====================================================================
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS live_state text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS live_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_current_topic text,
  ADD COLUMN IF NOT EXISTS live_stream_platform text;

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_live_state_check;
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_live_state_check
  CHECK (live_state IN ('idle','live','paused','ended'));

-- Log/feed de eventos ao vivo
CREATE TABLE IF NOT EXISTS public.tournament_live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN (
    'live_started','live_paused','live_resumed','live_ended',
    'stream_changed','topic_changed','commentary','highlight','announcement'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.tournament_live_events TO authenticated;
GRANT ALL ON public.tournament_live_events TO service_role;

ALTER TABLE public.tournament_live_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads live events" ON public.tournament_live_events;
CREATE POLICY "Anyone reads live events"
  ON public.tournament_live_events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Mods insert live events" ON public.tournament_live_events;
CREATE POLICY "Mods insert live events"
  ON public.tournament_live_events FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid() AND public.is_tournament_mod(tournament_id, auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_tournament_live_events_tid
  ON public.tournament_live_events(tournament_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_live_events;
ALTER TABLE public.tournament_live_events REPLICA IDENTITY FULL;

-- Detectar plataforma pela URL do stream (twitch/youtube/kick)
CREATE OR REPLACE FUNCTION public._detect_stream_platform(_url text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN _url IS NULL OR _url = '' THEN NULL
    WHEN _url ~* 'twitch\.tv' THEN 'twitch'
    WHEN _url ~* '(youtube\.com|youtu\.be)' THEN 'youtube'
    WHEN _url ~* 'kick\.com' THEN 'kick'
    ELSE 'other'
  END;
$$;

-- RPC principal: admin/mod controla o estado da live
CREATE OR REPLACE FUNCTION public.tournament_set_live_state(
  _tournament_id uuid,
  _state text,
  _stream_url text DEFAULT NULL,
  _topic text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prev text;
  v_url text;
  v_topic text;
BEGIN
  IF NOT public.is_tournament_mod(_tournament_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _state NOT IN ('idle','live','paused','ended') THEN
    RAISE EXCEPTION 'invalid state';
  END IF;

  SELECT live_state, stream_url, live_current_topic
    INTO v_prev, v_url, v_topic
    FROM public.tournaments WHERE id = _tournament_id;

  UPDATE public.tournaments
     SET live_state = _state,
         stream_url = COALESCE(_stream_url, stream_url),
         live_stream_platform = public._detect_stream_platform(COALESCE(_stream_url, stream_url)),
         live_current_topic = COALESCE(_topic, live_current_topic),
         live_started_at = CASE
           WHEN _state = 'live' AND v_prev <> 'live' THEN now()
           WHEN _state = 'ended' THEN live_started_at
           ELSE live_started_at
         END
   WHERE id = _tournament_id;

  INSERT INTO public.tournament_live_events (tournament_id, actor_id, kind, payload)
  VALUES (
    _tournament_id, auth.uid(),
    CASE _state
      WHEN 'live'   THEN CASE WHEN v_prev = 'paused' THEN 'live_resumed' ELSE 'live_started' END
      WHEN 'paused' THEN 'live_paused'
      WHEN 'ended'  THEN 'live_ended'
      ELSE 'topic_changed'
    END,
    jsonb_build_object('state', _state, 'stream_url', _stream_url, 'topic', _topic)
  );

  IF _stream_url IS NOT NULL AND _stream_url IS DISTINCT FROM v_url THEN
    INSERT INTO public.tournament_live_events (tournament_id, actor_id, kind, payload)
    VALUES (_tournament_id, auth.uid(), 'stream_changed',
            jsonb_build_object('stream_url', _stream_url));
  END IF;

  IF _topic IS NOT NULL AND _topic IS DISTINCT FROM v_topic THEN
    INSERT INTO public.tournament_live_events (tournament_id, actor_id, kind, payload)
    VALUES (_tournament_id, auth.uid(), 'topic_changed',
            jsonb_build_object('topic', _topic));
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tournament_set_live_state(uuid, text, text, text) TO authenticated;

-- RPC: comentário / destaque / anúncio
CREATE OR REPLACE FUNCTION public.tournament_post_live_message(
  _tournament_id uuid,
  _kind text,
  _text text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF _kind NOT IN ('commentary','highlight','announcement') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;
  IF NOT public.is_tournament_mod(_tournament_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(COALESCE(_text,'')) = 0 OR length(_text) > 500 THEN
    RAISE EXCEPTION 'text length invalid';
  END IF;

  INSERT INTO public.tournament_live_events (tournament_id, actor_id, kind, payload)
  VALUES (_tournament_id, auth.uid(), _kind, jsonb_build_object('text', _text))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tournament_post_live_message(uuid, text, text) TO authenticated;

-- =====================================================================
-- 3) NOTIFICATION_PREFERENCES RESPEITADO
-- =====================================================================
CREATE OR REPLACE FUNCTION public.should_notify(_uid uuid, _pref text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.notification_preferences;
BEGIN
  SELECT * INTO r FROM public.notification_preferences WHERE user_id = _uid;
  IF NOT FOUND THEN RETURN true; END IF;
  RETURN COALESCE(CASE _pref
    WHEN 'social_likes' THEN r.social_likes
    WHEN 'social_replies' THEN r.social_replies
    WHEN 'social_follows' THEN r.social_follows
    WHEN 'forum_replies' THEN r.forum_replies
    WHEN 'forum_mentions' THEN r.forum_mentions
    WHEN 'forum_topics' THEN r.forum_topics
    WHEN 'tournament_signup' THEN r.tournament_signup
    WHEN 'tournament_7d' THEN r.tournament_7d
    WHEN 'tournament_1d' THEN r.tournament_1d
    WHEN 'tournament_1h' THEN r.tournament_1h
    WHEN 'tournament_match' THEN r.tournament_match
    WHEN 'tournament_result' THEN r.tournament_result
    WHEN 'library_review_completa' THEN r.library_review_completa
    WHEN 'library_opinion' THEN r.library_opinion
    WHEN 'library_screenshot' THEN r.library_screenshot
    WHEN 'library_activity' THEN r.library_activity
    WHEN 'midias_especiais' THEN r.midias_especiais
    ELSE true
  END, true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.should_notify(uuid, text) TO authenticated;

-- Triggers de notificação passam a checar preferência antes de inserir.

CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  IF NOT public.should_notify(NEW.mentioned_user_id, 'forum_mentions') THEN RETURN NEW; END IF;
  INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
  VALUES (NEW.mentioned_user_id, 'nova_mensagem', 'Você foi mencionado',
          COALESCE(NEW.context_preview,'Alguém te mencionou'), NEW.source_type, NEW.source_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_review_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE review_author UUID; review_product UUID;
BEGIN
  SELECT user_id, product_id INTO review_author, review_product FROM public.avaliacoes WHERE id = NEW.review_id;
  IF review_author IS NOT NULL AND review_author != NEW.user_id
     AND public.should_notify(review_author, 'social_replies') THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (review_author, 'comentario_review', 'Alguém comentou na sua review',
            substring(NEW.content from 1 for 120), 'produto', review_product);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_opinion_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE op_author uuid; op_product uuid; sender_name text;
BEGIN
  SELECT user_id, product_id INTO op_author, op_product FROM public.game_opinions WHERE id = NEW.opinion_id;
  IF op_author IS NULL OR op_author = NEW.sender_id THEN RETURN NEW; END IF;
  IF NOT public.should_notify(op_author, 'library_opinion') THEN RETURN NEW; END IF;
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
  VALUES (op_author, 'nova_mensagem', COALESCE(sender_name,'Alguém') || ' respondeu sua opinião',
          substring(NEW.text from 1 for 120), 'opinion_reply', NEW.opinion_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_friends_review_completa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE friend_record record; game_title text; author_name text;
BEGIN
  IF NEW.visibility = 'private' THEN RETURN NEW; END IF;
  SELECT title INTO game_title FROM public.produtos WHERE id = NEW.product_id;
  SELECT display_name INTO author_name FROM public.profiles WHERE id = NEW.user_id;
  FOR friend_record IN SELECT friend_id FROM public.get_mutual_friends(NEW.user_id) LOOP
    IF public.should_notify(friend_record.friend_id, 'library_review_completa') THEN
      INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (friend_record.friend_id, 'nova_mensagem', 'Nova Review Completa',
              COALESCE(author_name, 'Um amigo') || ' publicou uma review completa de ' || COALESCE(game_title, 'um jogo'),
              NEW.id, 'review_completa');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_waitlist_promoted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_title text;
BEGIN
  IF NOT public.should_notify(NEW.user_id, 'tournament_signup') THEN RETURN NEW; END IF;
  SELECT title INTO v_title FROM public.tournaments WHERE id = NEW.tournament_id;
  INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
  VALUES (NEW.user_id, 'nova_mensagem',
          '🎟️ Vaga liberada no torneio!',
          format('Você saiu da fila de espera e foi inscrito em "%s". Confirme sua participação.', COALESCE(v_title,'torneio')),
          'tournament', NEW.tournament_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_promoted_to_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_title text; v_was_waitlisted boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tournament_waitlist
                 WHERE tournament_id = NEW.tournament_id AND user_id = NEW.user_id)
    INTO v_was_waitlisted;
  IF NOT v_was_waitlisted THEN RETURN NEW; END IF;
  IF public.should_notify(NEW.user_id, 'tournament_signup') THEN
    SELECT title INTO v_title FROM public.tournaments WHERE id = NEW.tournament_id;
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.user_id, 'nova_mensagem',
            '🎟️ Vaga liberada no torneio!',
            format('Você saiu da fila de espera e foi inscrito em "%s".', COALESCE(v_title,'torneio')),
            'tournament', NEW.tournament_id);
  END IF;
  DELETE FROM public.tournament_waitlist
    WHERE tournament_id = NEW.tournament_id AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
