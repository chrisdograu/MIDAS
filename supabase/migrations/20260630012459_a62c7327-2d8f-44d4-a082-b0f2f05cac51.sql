
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS stream_url text;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS default_format text NOT NULL DEFAULT 'single_elimination';
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS default_bo int NOT NULL DEFAULT 1;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS walkover_minutes int NOT NULL DEFAULT 15;

CREATE TABLE IF NOT EXISTS public.tournament_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  banned_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.tournament_bans TO authenticated;
GRANT ALL ON public.tournament_bans TO service_role;

ALTER TABLE public.tournament_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mods manage bans" ON public.tournament_bans
  FOR ALL TO authenticated
  USING (public.is_tournament_mod(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_mod(tournament_id, auth.uid()));

CREATE POLICY "User sees own ban" ON public.tournament_bans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_banned_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tournament_bans WHERE tournament_id = NEW.tournament_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Você foi banido deste torneio' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prevent_banned_signup_trg ON public.tournament_participants;
CREATE TRIGGER prevent_banned_signup_trg
  BEFORE INSERT ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_banned_signup();

-- Remove participation when banned
CREATE OR REPLACE FUNCTION public.remove_on_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.tournament_participants WHERE tournament_id = NEW.tournament_id AND user_id = NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS remove_on_ban_trg ON public.tournament_bans;
CREATE TRIGGER remove_on_ban_trg AFTER INSERT ON public.tournament_bans
  FOR EACH ROW EXECUTE FUNCTION public.remove_on_ban();
