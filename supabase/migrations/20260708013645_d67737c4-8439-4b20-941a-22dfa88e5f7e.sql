
-- =====================================================================
-- SPRINT 0.1 — Fechar vazamento de PII em profiles
-- =====================================================================

DROP POLICY IF EXISTS "Anyone can view profiles publicly" ON public.profiles;

DROP POLICY IF EXISTS "Authenticated view profiles" ON public.profiles;
CREATE POLICY "Authenticated view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, display_name, avatar_url, bio, banner_url, username, is_private,
  active_title_id, seller_bio, gamer_personality, favorite_genres,
  current_game_id, monthly_favorites, backlog_note, library_visibility,
  theme_color, profile_cover_url, trophy_showcase, always_hide_spoilers,
  created_at, updated_at, banned_until, require_follow_approval
) ON public.profiles TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_admin(_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO result FROM public.profiles WHERE id = _id;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_profile_admin(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.public_profiles_view
WITH (security_invoker = true) AS
SELECT
  id, display_name, avatar_url, bio, banner_url, username,
  active_title_id, seller_bio, gamer_personality, favorite_genres,
  current_game_id, monthly_favorites, backlog_note,
  theme_color, profile_cover_url, trophy_showcase,
  created_at
FROM public.profiles
WHERE is_private = false;
GRANT SELECT ON public.public_profiles_view TO anon, authenticated;

-- =====================================================================
-- SPRINT 0.2 — admin_logs append-only
-- =====================================================================
REVOKE DELETE ON public.admin_logs FROM anon, authenticated;

-- =====================================================================
-- SPRINT 1.1 — Dedupe de product_views (IMMUTABLE expression)
-- =====================================================================

ALTER TABLE public.product_views
  ADD COLUMN IF NOT EXISTS session_id text;

-- date_trunc(text, timestamp) é IMMUTABLE; AT TIME ZONE 'UTC' converte timestamptz -> timestamp
CREATE UNIQUE INDEX IF NOT EXISTS product_views_dedupe_user_hour
  ON public.product_views (product_id, user_id, (date_trunc('hour', (viewed_at AT TIME ZONE 'UTC'))))
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_views_dedupe_session_hour
  ON public.product_views (product_id, session_id, (date_trunc('hour', (viewed_at AT TIME ZONE 'UTC'))))
  WHERE user_id IS NULL AND session_id IS NOT NULL;

-- =====================================================================
-- SPRINT 1.3 — Cupom com lock server-side
-- =====================================================================

CREATE OR REPLACE FUNCTION public.validate_and_use_coupon(
  _code text,
  _order_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.cupons;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_coupon
  FROM public.cupons
  WHERE code = _code AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > now() THEN
    RAISE EXCEPTION 'coupon_not_started';
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_count >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.cupon_usos
    WHERE coupon_id = v_coupon.id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'coupon_already_used_by_user';
  END IF;

  INSERT INTO public.cupon_usos (coupon_id, user_id, order_id)
  VALUES (v_coupon.id, v_user, _order_id);

  RETURN v_coupon.id;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_and_use_coupon(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_and_use_coupon(text, uuid) TO authenticated;

-- =====================================================================
-- SPRINT 1.4 — Review-bombing: exigir posse do jogo
-- =====================================================================

CREATE OR REPLACE FUNCTION public.avaliacoes_require_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.biblioteca_usuario
    WHERE user_id = NEW.user_id
      AND product_id = NEW.product_id
      AND status IN ('jogando', 'zerado', 'platinado', 'concluido', 'owned', 'playing', 'finished')
  ) THEN
    RAISE EXCEPTION 'must_own_game_to_review'
      USING HINT = 'Adicione o jogo à sua biblioteca antes de avaliar.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacoes_require_ownership ON public.avaliacoes;
CREATE TRIGGER trg_avaliacoes_require_ownership
  BEFORE INSERT ON public.avaliacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.avaliacoes_require_ownership();

-- =====================================================================
-- SPRINT 1.5 — Prevenir grupos órfãos
-- =====================================================================

CREATE OR REPLACE FUNCTION public.group_members_prevent_orphan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_admins int;
  next_admin uuid;
BEGIN
  IF OLD.role <> 'admin' THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO remaining_admins
  FROM public.group_members
  WHERE group_id = OLD.group_id
    AND role = 'admin'
    AND id <> OLD.id;

  IF remaining_admins > 0 THEN
    RETURN OLD;
  END IF;

  SELECT user_id INTO next_admin
  FROM public.group_members
  WHERE group_id = OLD.group_id
    AND id <> OLD.id
    AND role IN ('member', 'observer')
  ORDER BY joined_at ASC
  LIMIT 1;

  IF next_admin IS NOT NULL THEN
    UPDATE public.group_members
      SET role = 'admin'
      WHERE group_id = OLD.group_id AND user_id = next_admin;
  ELSE
    DELETE FROM public.groups WHERE id = OLD.group_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_members_prevent_orphan ON public.group_members;
CREATE TRIGGER trg_group_members_prevent_orphan
  AFTER DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.group_members_prevent_orphan();
