
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS narrative TEXT,
  ADD COLUMN IF NOT EXISTS prize_pool_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS stream_url TEXT,
  ADD COLUMN IF NOT EXISTS event_state TEXT NOT NULL DEFAULT 'registration',
  ADD COLUMN IF NOT EXISTS bracket_type TEXT NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS winner_id UUID,
  ADD COLUMN IF NOT EXISTS runner_up_id UUID,
  ADD COLUMN IF NOT EXISTS third_place_id UUID,
  ADD COLUMN IF NOT EXISTS forum_thread_id UUID,
  ADD COLUMN IF NOT EXISTS hype_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS score_a INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_b INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stream_url TEXT,
  ADD COLUMN IF NOT EXISTS momentum INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mvp_user_id UUID,
  ADD COLUMN IF NOT EXISTS bracket_side TEXT NOT NULL DEFAULT 'upper',
  ADD COLUMN IF NOT EXISTS round_label TEXT;

ALTER TABLE public.forum_posts
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tournament_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.forum_posts DROP CONSTRAINT IF EXISTS forum_posts_target_check;
ALTER TABLE public.forum_posts ADD CONSTRAINT forum_posts_target_check
  CHECK (product_id IS NOT NULL OR tournament_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_forum_posts_tournament ON public.forum_posts(tournament_id);

CREATE TABLE IF NOT EXISTS public.tournament_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL, match_id UUID, user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'message', content TEXT NOT NULL DEFAULT '',
  payload JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_chat_messages TO anon;
GRANT SELECT, INSERT, DELETE ON public.tournament_chat_messages TO authenticated;
GRANT ALL ON public.tournament_chat_messages TO service_role;
ALTER TABLE public.tournament_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view tournament chat" ON public.tournament_chat_messages;
CREATE POLICY "view tournament chat" ON public.tournament_chat_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "send tournament chat" ON public.tournament_chat_messages;
CREATE POLICY "send tournament chat" ON public.tournament_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));
DROP POLICY IF EXISTS "delete own tournament chat" ON public.tournament_chat_messages;
CREATE POLICY "delete own tournament chat" ON public.tournament_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());
CREATE INDEX IF NOT EXISTS idx_tchat_tournament ON public.tournament_chat_messages(tournament_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tournament_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL, match_id UUID NOT NULL, user_id UUID NOT NULL,
  predicted_winner_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);
GRANT SELECT ON public.tournament_predictions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_predictions TO authenticated;
GRANT ALL ON public.tournament_predictions TO service_role;
ALTER TABLE public.tournament_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view predictions" ON public.tournament_predictions;
CREATE POLICY "view predictions" ON public.tournament_predictions FOR SELECT USING (true);
DROP POLICY IF EXISTS "create own prediction" ON public.tournament_predictions;
CREATE POLICY "create own prediction" ON public.tournament_predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update own prediction" ON public.tournament_predictions;
CREATE POLICY "update own prediction" ON public.tournament_predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete own prediction" ON public.tournament_predictions;
CREATE POLICY "delete own prediction" ON public.tournament_predictions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tournament_mvp_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL, match_id UUID NOT NULL,
  voter_id UUID NOT NULL, voted_for_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, voter_id)
);
GRANT SELECT ON public.tournament_mvp_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_mvp_votes TO authenticated;
GRANT ALL ON public.tournament_mvp_votes TO service_role;
ALTER TABLE public.tournament_mvp_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view mvp votes" ON public.tournament_mvp_votes;
CREATE POLICY "view mvp votes" ON public.tournament_mvp_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "vote mvp" ON public.tournament_mvp_votes;
CREATE POLICY "vote mvp" ON public.tournament_mvp_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);
DROP POLICY IF EXISTS "change own mvp vote" ON public.tournament_mvp_votes;
CREATE POLICY "change own mvp vote" ON public.tournament_mvp_votes FOR UPDATE TO authenticated USING (auth.uid() = voter_id);

CREATE TABLE IF NOT EXISTS public.tournament_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL, match_id UUID,
  title TEXT NOT NULL, description TEXT, video_url TEXT, image_url TEXT,
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_highlights TO anon;
GRANT SELECT ON public.tournament_highlights TO authenticated;
GRANT ALL ON public.tournament_highlights TO service_role;
ALTER TABLE public.tournament_highlights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view highlights" ON public.tournament_highlights;
CREATE POLICY "view highlights" ON public.tournament_highlights FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin manage highlights" ON public.tournament_highlights;
CREATE POLICY "admin manage highlights" ON public.tournament_highlights FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.tournament_storylines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL, match_id UUID,
  kind TEXT NOT NULL, narrative TEXT NOT NULL,
  auto_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_storylines TO anon;
GRANT SELECT ON public.tournament_storylines TO authenticated;
GRANT ALL ON public.tournament_storylines TO service_role;
ALTER TABLE public.tournament_storylines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view storylines" ON public.tournament_storylines;
CREATE POLICY "view storylines" ON public.tournament_storylines FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin manage storylines" ON public.tournament_storylines;
CREATE POLICY "admin manage storylines" ON public.tournament_storylines FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.tournament_match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL, tournament_id UUID NOT NULL,
  kind TEXT NOT NULL, payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_match_events TO anon;
GRANT SELECT ON public.tournament_match_events TO authenticated;
GRANT ALL ON public.tournament_match_events TO service_role;
ALTER TABLE public.tournament_match_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view match events" ON public.tournament_match_events;
CREATE POLICY "view match events" ON public.tournament_match_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin manage match events" ON public.tournament_match_events;
CREATE POLICY "admin manage match events" ON public.tournament_match_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_tme_match ON public.tournament_match_events(match_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tournament_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL, match_id UUID,
  user_id UUID NOT NULL, emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_reactions TO anon;
GRANT SELECT, INSERT ON public.tournament_reactions TO authenticated;
GRANT ALL ON public.tournament_reactions TO service_role;
ALTER TABLE public.tournament_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view reactions" ON public.tournament_reactions;
CREATE POLICY "view reactions" ON public.tournament_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "send reactions" ON public.tournament_reactions;
CREATE POLICY "send reactions" ON public.tournament_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_treact_t ON public.tournament_reactions(tournament_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.generate_match_storylines()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT; v_streak_a INT; v_streak_b INT; v_name_a TEXT; v_name_b TEXT;
BEGIN
  IF NEW.player_a IS NULL OR NEW.player_b IS NULL THEN RETURN NEW; END IF;
  SELECT display_name INTO v_name_a FROM public.profiles WHERE id = NEW.player_a;
  SELECT display_name INTO v_name_b FROM public.profiles WHERE id = NEW.player_b;
  v_name_a := COALESCE(v_name_a, 'Jogador A');
  v_name_b := COALESCE(v_name_b, 'Jogador B');
  SELECT COUNT(*) INTO v_count FROM public.tournament_matches
   WHERE id <> NEW.id
     AND ((player_a = NEW.player_a AND player_b = NEW.player_b)
       OR (player_a = NEW.player_b AND player_b = NEW.player_a))
     AND ended_at IS NOT NULL;
  IF v_count >= 1 THEN
    INSERT INTO public.tournament_storylines (tournament_id, match_id, kind, narrative)
    VALUES (NEW.tournament_id, NEW.id, 'rivalry',
      format('Esse é o %sº encontro entre %s e %s.', v_count + 1, v_name_a, v_name_b));
  END IF;
  SELECT COUNT(*) INTO v_streak_a FROM public.tournament_matches
   WHERE winner_id = NEW.player_a AND tournament_id = NEW.tournament_id;
  IF v_streak_a >= 3 THEN
    INSERT INTO public.tournament_storylines (tournament_id, match_id, kind, narrative)
    VALUES (NEW.tournament_id, NEW.id, 'streak',
      format('%s vem de %s vitórias consecutivas no torneio.', v_name_a, v_streak_a));
  END IF;
  SELECT COUNT(*) INTO v_streak_b FROM public.tournament_matches
   WHERE winner_id = NEW.player_b AND tournament_id = NEW.tournament_id;
  IF v_streak_b >= 3 THEN
    INSERT INTO public.tournament_storylines (tournament_id, match_id, kind, narrative)
    VALUES (NEW.tournament_id, NEW.id, 'streak',
      format('%s vem de %s vitórias consecutivas no torneio.', v_name_b, v_streak_b));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_generate_match_storylines ON public.tournament_matches;
CREATE TRIGGER trg_generate_match_storylines AFTER INSERT ON public.tournament_matches
FOR EACH ROW EXECUTE FUNCTION public.generate_match_storylines();

CREATE OR REPLACE FUNCTION public.create_tournament_forum_thread()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post_id UUID; v_winner_name TEXT;
BEGIN
  IF NEW.event_state = 'finished' AND (OLD.event_state IS DISTINCT FROM 'finished')
     AND NEW.forum_thread_id IS NULL THEN
    SELECT display_name INTO v_winner_name FROM public.profiles WHERE id = NEW.winner_id;
    INSERT INTO public.forum_posts (user_id, tournament_id, title, content, is_pinned)
    VALUES (
      COALESCE(NEW.winner_id, (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)),
      NEW.id, format('🏆 %s — discussão do torneio', NEW.title),
      format('O torneio %s acabou! %s Compartilhem reações, memes, análises e melhores momentos.',
        NEW.title, CASE WHEN v_winner_name IS NOT NULL THEN format('Campeão: %s.', v_winner_name) ELSE '' END),
      true
    ) RETURNING id INTO v_post_id;
    NEW.forum_thread_id := v_post_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_create_tournament_forum_thread ON public.tournaments;
CREATE TRIGGER trg_create_tournament_forum_thread BEFORE UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.create_tournament_forum_thread();

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_match_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_mvp_votes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
