
-- 1) Remove a policy vazadora que deixava qualquer authenticated ler tudo
DROP POLICY IF EXISTS "Authenticated view profiles" ON public.profiles;

-- 2) Revoga SELECT geral e concede apenas em colunas públicas
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- Colunas públicas (usadas em header, chat, fórum, cards, ranking)
GRANT SELECT (
  id, display_name, avatar_url, bio, seller_bio, username,
  is_private, created_at, active_title_id, banner_url,
  gamer_personality, favorite_genres, current_game_id,
  monthly_favorites, backlog_note, library_visibility,
  theme_color, profile_cover_url, trophy_showcase,
  always_hide_spoilers, banned_until, updated_at
) ON public.profiles TO authenticated;

-- service_role continua com acesso total
GRANT ALL ON public.profiles TO service_role;

-- 3) Policy nova: qualquer authenticated pode "ver" a linha,
--    mas só nas colunas concedidas acima. Dono e admin já têm policies próprias.
CREATE POLICY "Public columns visible"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 4) Função central de visibilidade "amigo pleno"
CREATE OR REPLACE FUNCTION public.can_view_full_profile(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _owner = _viewer
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = _owner AND _viewer = ANY(p.privacy_exceptions))
    OR public.is_close_friend(_owner, _viewer)
    OR public.are_mutual_friends(_owner, _viewer);
$$;

-- 5) RPC pública com gate de is_private: perfil trancado só mostra o essencial
--    para quem não é amigo. Nunca expõe CPF/phone/contact_email/prefs.
CREATE OR REPLACE FUNCTION public.get_public_profile(_uid uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  seller_bio text,
  username text,
  is_private boolean,
  active_title_id uuid,
  banner_url text,
  gamer_personality text,
  favorite_genres text[],
  current_game_id uuid,
  monthly_favorites uuid[],
  backlog_note text,
  library_visibility text,
  theme_color text,
  profile_cover_url text,
  trophy_showcase text[],
  always_hide_spoilers boolean,
  banned_until timestamptz,
  created_at timestamptz,
  can_see_full boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_full boolean;
BEGIN
  v_full := public.can_view_full_profile(_uid, v_viewer);
  RETURN QUERY
    SELECT
      p.id, p.display_name, p.avatar_url,
      CASE WHEN p.is_private AND NOT v_full THEN NULL ELSE p.bio END,
      CASE WHEN p.is_private AND NOT v_full THEN NULL ELSE p.seller_bio END,
      p.username, p.is_private, p.active_title_id,
      CASE WHEN p.is_private AND NOT v_full THEN NULL ELSE p.banner_url END,
      CASE WHEN p.is_private AND NOT v_full THEN NULL ELSE p.gamer_personality END,
      CASE WHEN p.is_private AND NOT v_full THEN NULL::text[] ELSE p.favorite_genres END,
      CASE WHEN p.is_private AND NOT v_full THEN NULL ELSE p.current_game_id END,
      CASE WHEN p.is_private AND NOT v_full THEN NULL::uuid[] ELSE p.monthly_favorites END,
      CASE WHEN p.is_private AND NOT v_full THEN NULL ELSE p.backlog_note END,
      p.library_visibility,
      p.theme_color,
      CASE WHEN p.is_private AND NOT v_full THEN NULL ELSE p.profile_cover_url END,
      CASE WHEN p.is_private AND NOT v_full THEN NULL::text[] ELSE p.trophy_showcase END,
      p.always_hide_spoilers, p.banned_until, p.created_at,
      v_full
    FROM public.profiles p
    WHERE p.id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_full_profile(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated, anon;
