CREATE SCHEMA IF NOT EXISTS rls_private;
GRANT USAGE ON SCHEMA rls_private TO anon, authenticated;

CREATE FUNCTION rls_private.ad_visible(_title text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NOT EXISTS (SELECT 1 FROM public.produtos p WHERE lower(p.title) = lower(_title) AND NOT COALESCE(public.pode_acessar_conteudo(auth.uid(), p.classificacao_indicativa), false)) $$;
CREATE FUNCTION rls_private.post_visible(_owner uuid, _viewer uuid, _vis text, _kind text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.can_view_post(_owner, auth.uid(), _vis, _kind) OR public.can_view_scope(_owner, auth.uid(), _kind) $$;
CREATE FUNCTION rls_private.timeline_visible(_owner uuid, _viewer uuid, _vis text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_staff() OR public.can_view_post(_owner, auth.uid(), _vis, 'timeline') OR public.can_view_scope(_owner, auth.uid(), 'stats') $$;
CREATE FUNCTION rls_private.review_visible(_owner uuid, _viewer uuid, _vis text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.can_view_friend_content(_owner, auth.uid(), _vis) OR public.can_view_scope(_owner, auth.uid(), 'reviews_completas') $$;
CREATE FUNCTION rls_private.library_visible(_owner uuid, _viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.can_view_library_item(_owner, auth.uid()) $$;
REVOKE ALL ON FUNCTION rls_private.ad_visible(text), rls_private.post_visible(uuid,uuid,text,text), rls_private.timeline_visible(uuid,uuid,text), rls_private.review_visible(uuid,uuid,text), rls_private.library_visible(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rls_private.ad_visible(text), rls_private.post_visible(uuid,uuid,text,text), rls_private.timeline_visible(uuid,uuid,text), rls_private.review_visible(uuid,uuid,text), rls_private.library_visible(uuid,uuid) TO anon, authenticated;

ALTER POLICY anuncios_age_gate_restrictive ON public.anuncios USING (rls_private.ad_visible(game_title));
ALTER POLICY opinions_select_visibility ON public.game_opinions USING (rls_private.post_visible(user_id, auth.uid(), visibility, 'opinions'));
ALTER POLICY ss_select_visibility ON public.game_screenshots USING (rls_private.post_visible(user_id, auth.uid(), visibility, 'screenshots'));
ALTER POLICY timeline_select_visibility ON public.game_timeline_events USING (rls_private.timeline_visible(user_id, auth.uid(), visibility));
ALTER POLICY "Friends can view review completa" ON public.reviews_completas USING (rls_private.review_visible(user_id, auth.uid(), visibility));
ALTER POLICY biblioteca_select_visibility ON public.biblioteca_usuario USING (rls_private.library_visible(user_id, auth.uid()));

REVOKE EXECUTE ON FUNCTION public.pode_acessar_conteudo(uuid,public.classificacao_indicativa), public.can_view_post(uuid,uuid,text,text), public.can_view_scope(uuid,uuid,text), public.can_view_friend_content(uuid,uuid,text), public.is_staff(), public.can_view_library_item(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_library_item(uuid,uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid,text,integer,text,uuid) FROM PUBLIC, anon, authenticated;
