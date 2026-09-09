CREATE OR REPLACE FUNCTION public.can_view_profile_content(_owner uuid, _viewer uuid, _kind text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_view_friend_content(
    _owner,
    _viewer,
    COALESCE((
      SELECT CASE _kind
        WHEN 'opinions' THEN p.opinions_visibility
        WHEN 'screenshots' THEN p.screenshots_visibility
        WHEN 'timeline' THEN p.timeline_visibility
      END
      FROM public.profiles p WHERE p.id = _owner
    ), 'friends')
  );
$$;

DROP POLICY IF EXISTS opinions_select_visibility ON public.game_opinions;
CREATE POLICY opinions_select_visibility ON public.game_opinions
FOR SELECT
USING (
  public.can_view_profile_content(user_id, auth.uid(), 'opinions')
  OR public.can_view_scope(user_id, auth.uid(), 'opinions')
);

DROP POLICY IF EXISTS ss_select_visibility ON public.game_screenshots;
CREATE POLICY ss_select_visibility ON public.game_screenshots
FOR SELECT
USING (
  public.can_view_profile_content(user_id, auth.uid(), 'screenshots')
  OR public.can_view_scope(user_id, auth.uid(), 'screenshots')
);

DROP POLICY IF EXISTS timeline_select_visibility ON public.game_timeline_events;
CREATE POLICY timeline_select_visibility ON public.game_timeline_events
FOR SELECT
USING (
  public.is_staff()
  OR public.can_view_profile_content(user_id, auth.uid(), 'timeline')
  OR public.can_view_scope(user_id, auth.uid(), 'stats')
);

ALTER TABLE public.game_opinions DROP COLUMN IF EXISTS visibility;
ALTER TABLE public.game_screenshots DROP COLUMN IF EXISTS visibility;
ALTER TABLE public.game_timeline_events DROP COLUMN IF EXISTS visibility;