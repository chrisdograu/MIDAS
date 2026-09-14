CREATE OR REPLACE FUNCTION public.can_view_friend_content(_owner uuid, _viewer uuid, _visibility text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _owner = _viewer THEN true
    -- 'nobody' = bloqueio total: nenhuma exceção, nenhum amigo próximo
    WHEN _visibility = 'nobody' THEN false
    ELSE (
      _visibility = 'public'
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _owner AND _viewer = ANY(p.privacy_exceptions))
      OR (_visibility = 'friends' AND public.are_mutual_friends(_owner, _viewer))
      OR (_visibility = 'private' AND public.is_close_friend(_owner, _viewer))
    )
  END
$$;

UPDATE public.profiles SET library_visibility = 'friends' WHERE library_visibility = 'public';
UPDATE public.profiles SET opinions_visibility = 'friends' WHERE opinions_visibility = 'public';
UPDATE public.profiles SET screenshots_visibility = 'friends' WHERE screenshots_visibility = 'public';
UPDATE public.profiles SET timeline_visibility = 'friends' WHERE timeline_visibility = 'public';