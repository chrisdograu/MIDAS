-- Phase 2: Friends Social Library

-- 1. Friend activity item states (NEW/SEEN/LIKED/SAVED/HIDDEN)
CREATE TABLE IF NOT EXISTS public.friend_activity_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_type text NOT NULL, -- 'library' | 'review' | 'post'
  activity_ref_id uuid NOT NULL, -- biblioteca_usuario.id / avaliacoes.id / forum_posts.id
  friend_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'new', -- new | seen | liked | saved | hidden
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_type, activity_ref_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_activity_states TO authenticated;
GRANT ALL ON public.friend_activity_states TO service_role;

ALTER TABLE public.friend_activity_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own activity states"
ON public.friend_activity_states FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fas_user_state ON public.friend_activity_states(user_id, state);
CREATE INDEX idx_fas_lookup ON public.friend_activity_states(user_id, activity_type, activity_ref_id);

-- 2. Review extras (screenshots, hours, platform, mood, completion, difficulty, spoiler)
CREATE TABLE IF NOT EXISTS public.review_metadata (
  review_id uuid NOT NULL PRIMARY KEY,
  hours_played numeric,
  platform text,
  mood text,
  completion text, -- not_started | in_progress | beaten | completed | abandoned
  difficulty text,
  has_spoiler boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_metadata TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_metadata TO authenticated;
GRANT ALL ON public.review_metadata TO service_role;

ALTER TABLE public.review_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view review metadata"
ON public.review_metadata FOR SELECT USING (true);

CREATE POLICY "Review owner manages metadata"
ON public.review_metadata FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = review_metadata.review_id AND a.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = review_metadata.review_id AND a.user_id = auth.uid()));

-- 3. Review screenshots
CREATE TABLE IF NOT EXISTS public.review_screenshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_screenshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_screenshots TO authenticated;
GRANT ALL ON public.review_screenshots TO service_role;

ALTER TABLE public.review_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view review screenshots"
ON public.review_screenshots FOR SELECT USING (true);

CREATE POLICY "Review owner manages screenshots"
ON public.review_screenshots FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = review_screenshots.review_id AND a.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = review_screenshots.review_id AND a.user_id = auth.uid()));

CREATE INDEX idx_review_screenshots_review ON public.review_screenshots(review_id);

-- 4. Game clips (gameplay highlights)
CREATE TABLE IF NOT EXISTS public.game_clips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  title text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_clips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_clips TO authenticated;
GRANT ALL ON public.game_clips TO service_role;

ALTER TABLE public.game_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view clips"
ON public.game_clips FOR SELECT USING (true);

CREATE POLICY "User manages own clips"
ON public.game_clips FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  achievement_name text NOT NULL,
  achievement_description text,
  icon_url text,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  rarity text DEFAULT 'common' -- common | rare | epic | legendary
);

GRANT SELECT ON public.user_achievements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view achievements"
ON public.user_achievements FOR SELECT USING (true);

CREATE POLICY "User manages own achievements"
ON public.user_achievements FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Playtime tracking
CREATE TABLE IF NOT EXISTS public.user_playtime (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  hours_played numeric NOT NULL DEFAULT 0,
  last_played_at timestamp with time zone,
  platform text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, platform)
);

GRANT SELECT ON public.user_playtime TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_playtime TO authenticated;
GRANT ALL ON public.user_playtime TO service_role;

ALTER TABLE public.user_playtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view playtime"
ON public.user_playtime FOR SELECT USING (true);

CREATE POLICY "User manages own playtime"
ON public.user_playtime FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Connected platforms (Steam, PSN, Xbox, etc)
CREATE TABLE IF NOT EXISTS public.connected_platforms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  platform text NOT NULL, -- steam | psn | xbox | nintendo | epic | gog
  username text NOT NULL,
  profile_url text,
  is_public boolean NOT NULL DEFAULT true,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

GRANT SELECT ON public.connected_platforms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connected_platforms TO authenticated;
GRANT ALL ON public.connected_platforms TO service_role;

ALTER TABLE public.connected_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view public platforms"
ON public.connected_platforms FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "User manages own platforms"
ON public.connected_platforms FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Mutual-follow helper function (definition of "friend")
CREATE OR REPLACE FUNCTION public.are_mutual_friends(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversas
    WHERE status = 'accepted'
      AND ((participant_1 = _user_a AND participant_2 = _user_b)
        OR (participant_1 = _user_b AND participant_2 = _user_a))
  );
$$;

-- 9. Get mutual friends list
CREATE OR REPLACE FUNCTION public.get_mutual_friends(_user_id uuid)
RETURNS TABLE(friend_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT CASE
    WHEN participant_1 = _user_id THEN participant_2
    ELSE participant_1
  END AS friend_id
  FROM public.conversas
  WHERE status = 'accepted'
    AND (participant_1 = _user_id OR participant_2 = _user_id);
$$;

-- Enable realtime for activity states
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_activity_states;
