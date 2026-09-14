-- Audit trigger: log any role/position change on user_roles
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (OLD.role IS DISTINCT FROM NEW.role OR OLD.position IS DISTINCT FROM NEW.position) THEN
    INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, payload)
    VALUES (
      COALESCE(auth.uid(), NEW.user_id),
      'user_roles.change',
      'user_roles',
      NEW.user_id,
      jsonb_build_object(
        'from', jsonb_build_object('role', OLD.role, 'position', OLD.position),
        'to',   jsonb_build_object('role', NEW.role, 'position', NEW.position)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_user_role_change
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();

-- Server-side validation: tournament_match_events must not go back in time
CREATE OR REPLACE FUNCTION public.enforce_match_event_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_ts timestamptz;
BEGIN
  SELECT MAX(created_at) INTO last_ts
    FROM public.tournament_match_events
   WHERE match_id = NEW.match_id;

  IF last_ts IS NOT NULL AND NEW.created_at < last_ts THEN
    RAISE EXCEPTION 'Match event out of order: %< %', NEW.created_at, last_ts
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_match_event_order ON public.tournament_match_events;
CREATE TRIGGER trg_enforce_match_event_order
  BEFORE INSERT ON public.tournament_match_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_event_order();