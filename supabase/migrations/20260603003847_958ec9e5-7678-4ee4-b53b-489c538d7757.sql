
-- ============ FASE 4: Player Journey ============
ALTER TABLE public.biblioteca_usuario
  ADD COLUMN IF NOT EXISTS hours_played integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS personal_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS mood_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS my_screenshots text[] NOT NULL DEFAULT '{}';

-- ============ FASE 5: Tournament moderation ============
CREATE TABLE IF NOT EXISTS public.tournament_moderators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'mod', -- 'creator' | 'mod'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);
GRANT SELECT ON public.tournament_moderators TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_moderators TO authenticated;
GRANT ALL ON public.tournament_moderators TO service_role;
ALTER TABLE public.tournament_moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view tournament mods" ON public.tournament_moderators FOR SELECT USING (true);
CREATE POLICY "Creators add mods" ON public.tournament_moderators FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
    OR public.is_admin()
  );
CREATE POLICY "Creators remove mods" ON public.tournament_moderators FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
    OR public.is_admin()
  );

CREATE TABLE IF NOT EXISTS public.tournament_chat_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  muted_by uuid NOT NULL,
  muted_until timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_chat_mutes TO authenticated;
GRANT INSERT, DELETE ON public.tournament_chat_mutes TO authenticated;
GRANT ALL ON public.tournament_chat_mutes TO service_role;
ALTER TABLE public.tournament_chat_mutes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_tournament_mod(_t uuid, _u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tournament_moderators WHERE tournament_id = _t AND user_id = _u)
    OR EXISTS (SELECT 1 FROM public.tournaments WHERE id = _t AND created_by = _u)
    OR public.is_admin();
$$;

CREATE POLICY "Mods manage mutes" ON public.tournament_chat_mutes FOR ALL TO authenticated
  USING (public.is_tournament_mod(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_mod(tournament_id, auth.uid()));
CREATE POLICY "Users see own mutes" ON public.tournament_chat_mutes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Auto-add creator as moderator
CREATE OR REPLACE FUNCTION public.tournament_register_creator_mod()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.tournament_moderators (tournament_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'creator')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tournament_register_creator ON public.tournaments;
CREATE TRIGGER trg_tournament_register_creator
AFTER INSERT ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.tournament_register_creator_mod();

-- Allow authenticated users to create tournaments (creator)
DROP POLICY IF EXISTS "Users create tournaments" ON public.tournaments;
CREATE POLICY "Users create tournaments" ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND NOT public.is_user_banned(auth.uid()));
DROP POLICY IF EXISTS "Creators update own tournaments" ON public.tournaments;
CREATE POLICY "Creators update own tournaments" ON public.tournaments FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());

-- Group chat: tournament participants can read messages tied to their tournament
DROP POLICY IF EXISTS "Tournament participants read group chat" ON public.mensagens;
CREATE POLICY "Tournament participants read group chat" ON public.mensagens FOR SELECT TO authenticated
  USING (
    tournament_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = mensagens.tournament_id AND tp.user_id = auth.uid()
    )
  );

-- Mods can delete tournament chat messages
DROP POLICY IF EXISTS "Mods delete tournament messages" ON public.mensagens;
CREATE POLICY "Mods delete tournament messages" ON public.mensagens FOR DELETE TO authenticated
  USING (tournament_id IS NOT NULL AND public.is_tournament_mod(tournament_id, auth.uid()));

-- Block sending if muted
CREATE OR REPLACE FUNCTION public.check_tournament_mute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tournament_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tournament_chat_mutes
    WHERE tournament_id = NEW.tournament_id AND user_id = NEW.sender_id AND muted_until > now()
  ) THEN
    RAISE EXCEPTION 'Você está silenciado neste torneio';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_check_tournament_mute ON public.mensagens;
CREATE TRIGGER trg_check_tournament_mute
BEFORE INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.check_tournament_mute();

-- Mods can kick (delete participants)
DROP POLICY IF EXISTS "Mods kick participants" ON public.tournament_participants;
CREATE POLICY "Mods kick participants" ON public.tournament_participants FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_tournament_mod(tournament_id, auth.uid())
  );
