
-- =========================================================
-- 1) opinion_conversations: conversa privada por opinião + respondente
-- =========================================================
CREATE TABLE IF NOT EXISTS public.opinion_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id uuid NOT NULL REFERENCES public.game_opinions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  responder_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opinion_id, responder_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opinion_conversations TO authenticated;
GRANT ALL ON public.opinion_conversations TO service_role;

ALTER TABLE public.opinion_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants view opinion conv"
  ON public.opinion_conversations FOR SELECT TO authenticated
  USING (auth.uid() = author_id OR auth.uid() = responder_id);

CREATE POLICY "responder creates opinion conv"
  ON public.opinion_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = responder_id);

CREATE INDEX IF NOT EXISTS idx_opinion_conv_opinion ON public.opinion_conversations(opinion_id);
CREATE INDEX IF NOT EXISTS idx_opinion_conv_author ON public.opinion_conversations(author_id);
CREATE INDEX IF NOT EXISTS idx_opinion_conv_responder ON public.opinion_conversations(responder_id);

-- Vincular replies existentes
ALTER TABLE public.game_opinion_replies
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.opinion_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_opinion_replies_conv ON public.game_opinion_replies(conversation_id);

-- Backfill: criar conversas para replies legadas
INSERT INTO public.opinion_conversations (opinion_id, author_id, responder_id, created_at)
SELECT DISTINCT r.opinion_id, o.user_id, r.responder_id, MIN(r.created_at)
  FROM public.game_opinion_replies r
  JOIN public.game_opinions o ON o.id = r.opinion_id
  WHERE r.conversation_id IS NULL
  GROUP BY r.opinion_id, o.user_id, r.responder_id
ON CONFLICT (opinion_id, responder_id) DO NOTHING;

UPDATE public.game_opinion_replies r
   SET conversation_id = c.id
  FROM public.opinion_conversations c
 WHERE r.conversation_id IS NULL
   AND c.opinion_id = r.opinion_id
   AND c.responder_id = r.responder_id;

-- =========================================================
-- 2) friend_favorites: amigo favorito (gerido só pelo dono)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.friend_favorites (
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);

GRANT SELECT, INSERT, DELETE ON public.friend_favorites TO authenticated;
GRANT ALL ON public.friend_favorites TO service_role;

ALTER TABLE public.friend_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own favorites"
  ON public.friend_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 3) profile_highlights: itens fixados no perfil
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profile_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('game','review','screenshot','opinion','review_completa')),
  ref_id uuid NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, ref_id)
);

GRANT SELECT ON public.profile_highlights TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_highlights TO authenticated;
GRANT ALL ON public.profile_highlights TO service_role;

ALTER TABLE public.profile_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "highlights are public read"
  ON public.profile_highlights FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "user manages own highlights"
  ON public.profile_highlights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user updates own highlights"
  ON public.profile_highlights FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user deletes own highlights"
  ON public.profile_highlights FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_highlights_user ON public.profile_highlights(user_id, position);

-- =========================================================
-- 4) tutorials_seen
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tutorials_seen (
  user_id uuid NOT NULL,
  tutorial_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tutorial_key)
);

GRANT SELECT, INSERT, DELETE ON public.tutorials_seen TO authenticated;
GRANT ALL ON public.tutorials_seen TO service_role;

ALTER TABLE public.tutorials_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own tutorials_seen"
  ON public.tutorials_seen FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 5) View v_friendships (follow mútuo)
-- =========================================================
CREATE OR REPLACE VIEW public.v_friendships AS
  SELECT a.follower_id AS user_id, a.following_id AS friend_id, GREATEST(a.created_at, b.created_at) AS since
    FROM public.user_follows a
    JOIN public.user_follows b
      ON b.follower_id = a.following_id AND b.following_id = a.follower_id;

GRANT SELECT ON public.v_friendships TO authenticated, anon;

-- =========================================================
-- 6) Trigger: notificação ao promover da fila de torneio
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_waitlist_promoted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_title text;
BEGIN
  SELECT title INTO v_title FROM public.tournaments WHERE id = NEW.tournament_id;
  INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
  VALUES (NEW.user_id, 'nova_mensagem',
          '🎟️ Vaga liberada no torneio!',
          format('Você saiu da fila de espera e foi inscrito em "%s". Confirme sua participação.', COALESCE(v_title,'torneio')),
          'tournament', NEW.tournament_id);
  RETURN NEW;
END;
$$;

-- Triggers em tournament_waitlist: detectar promoção via coluna status='promoted'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tournament_waitlist' AND column_name='status') THEN
    DROP TRIGGER IF EXISTS trg_notify_waitlist_promoted ON public.tournament_waitlist;
    CREATE TRIGGER trg_notify_waitlist_promoted
      AFTER UPDATE OF status ON public.tournament_waitlist
      FOR EACH ROW
      WHEN (NEW.status = 'promoted' AND (OLD.status IS DISTINCT FROM 'promoted'))
      EXECUTE FUNCTION public.notify_waitlist_promoted();
  END IF;
END$$;

-- Também notifica quando entra como participante vindo de waitlist
CREATE OR REPLACE FUNCTION public.notify_promoted_to_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_title text; v_was_waitlisted boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tournament_waitlist
                 WHERE tournament_id = NEW.tournament_id AND user_id = NEW.user_id)
    INTO v_was_waitlisted;
  IF NOT v_was_waitlisted THEN RETURN NEW; END IF;

  SELECT title INTO v_title FROM public.tournaments WHERE id = NEW.tournament_id;
  INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
  VALUES (NEW.user_id, 'nova_mensagem',
          '🎟️ Vaga liberada no torneio!',
          format('Você saiu da fila de espera e foi inscrito em "%s".', COALESCE(v_title,'torneio')),
          'tournament', NEW.tournament_id);
  DELETE FROM public.tournament_waitlist
    WHERE tournament_id = NEW.tournament_id AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_promoted_participant ON public.tournament_participants;
CREATE TRIGGER trg_notify_promoted_participant
  AFTER INSERT ON public.tournament_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_promoted_to_participant();
