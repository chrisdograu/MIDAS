-- Rodada 5: Sync badge_completed/badge_platinum on status change + emit game_timeline_events

CREATE OR REPLACE FUNCTION public.sync_biblioteca_badges_and_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed boolean := (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status);
BEGIN
  -- Sync badges based on status
  IF NEW.status = 'platinado' THEN
    NEW.badge_platinum := true;
    NEW.badge_completed := true;
  ELSIF NEW.status = 'zerado' THEN
    NEW.badge_completed := true;
  END IF;

  -- Mark source as user-declared if no verified source yet
  IF NEW.badge_verified_source IS NULL AND (NEW.badge_completed OR NEW.badge_platinum) THEN
    NEW.badge_verified_source := 'user_declared';
  END IF;

  -- Emit timeline event on status change
  IF v_changed AND NEW.status IS NOT NULL THEN
    INSERT INTO public.game_timeline_events (user_id, product_id, event_type, payload)
    VALUES (NEW.user_id, NEW.product_id, 'status_change',
            jsonb_build_object('status', NEW.status, 'hours', NEW.hours_played));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_biblioteca_badges ON public.biblioteca_usuario;
CREATE TRIGGER trg_sync_biblioteca_badges
BEFORE INSERT OR UPDATE OF status ON public.biblioteca_usuario
FOR EACH ROW EXECUTE FUNCTION public.sync_biblioteca_badges_and_timeline();