-- Expose only the predicate entry points used by anonymous RLS. Their SECURITY DEFINER
-- implementations enforce the existing privacy and age rules internally.
GRANT EXECUTE ON FUNCTION public.pode_acessar_conteudo(uuid, public.classificacao_indicativa) TO anon;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_view_scope(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_view_friend_content(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon;

-- Evaluate library visibility inside a SECURITY DEFINER predicate rather than
-- requiring anonymous SELECT on the sensitive profiles base table.
CREATE OR REPLACE FUNCTION public.can_view_library_item(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_view_friend_content(
    _owner, _viewer,
    COALESCE((SELECT p.library_visibility FROM public.profiles p WHERE p.id = _owner), 'friends')
  ) OR public.can_view_scope(_owner, _viewer, 'library_items');
$$;
REVOKE ALL ON FUNCTION public.can_view_library_item(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_library_item(uuid, uuid) TO anon, authenticated, service_role;
ALTER POLICY biblioteca_select_visibility ON public.biblioteca_usuario
  USING (public.can_view_library_item(user_id, auth.uid()));

-- Automatic XP remains callable from trusted database triggers, not the API user role.
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, text, integer, text, uuid) FROM authenticated;
