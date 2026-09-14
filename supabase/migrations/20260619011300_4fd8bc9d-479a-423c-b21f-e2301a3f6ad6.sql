
ALTER TABLE public.user_titles
  ADD COLUMN IF NOT EXISTS unlock_rule jsonb;

CREATE OR REPLACE FUNCTION public.can_equip_title(_user uuid, _title uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule jsonb;
  v_owner uuid;
  v_type text;
BEGIN
  SELECT user_id, unlock_rule INTO v_owner, v_rule
  FROM public.user_titles
  WHERE id = _title;

  IF v_owner IS NULL THEN
    RETURN false;
  END IF;

  IF v_owner <> _user THEN
    RETURN false;
  END IF;

  IF v_rule IS NULL THEN
    RETURN true;
  END IF;

  v_type := v_rule->>'type';

  IF v_type IS NULL OR v_type = 'none' THEN
    RETURN true;
  END IF;

  IF v_type = 'achievement' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_achievements
      WHERE user_id = _user
        AND achievement_name = v_rule->>'achievement_name'
    );
  END IF;

  IF v_type = 'achievement_id' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_achievements
      WHERE user_id = _user
        AND id = (v_rule->>'achievement_id')::uuid
    );
  END IF;

  IF v_type = 'playtime' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_playtime
      WHERE user_id = _user
        AND product_id = (v_rule->>'product_id')::uuid
        AND hours_played >= COALESCE((v_rule->>'min_hours')::numeric, 0)
    );
  END IF;

  IF v_type = 'xp' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user
        AND COALESCE(xp, 0) >= COALESCE((v_rule->>'min_xp')::int, 0)
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_active_title_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active_title_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.can_equip_title(NEW.id, NEW.active_title_id) THEN
    RAISE EXCEPTION 'Título bloqueado: requisitos não cumpridos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_active_title_lock ON public.profiles;
CREATE TRIGGER trg_enforce_active_title_lock
  BEFORE UPDATE OF active_title_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_title_lock();
