ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS proof_a text,
  ADD COLUMN IF NOT EXISTS proof_b text;

COMMENT ON COLUMN public.tournament_matches.proof_a IS 'Optional proof image URL for player A; one current proof per side, without a separate proof timestamp.';
COMMENT ON COLUMN public.tournament_matches.proof_b IS 'Optional proof image URL for player B; one current proof per side, without a separate proof timestamp.';

-- Initially nullable so existing events can retain their original creation time.
ALTER TABLE public.game_timeline_events
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.game_timeline_events
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_game_timeline_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_game_timeline_updated_at() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_game_timeline_updated_at
  BEFORE UPDATE ON public.game_timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.set_game_timeline_updated_at();