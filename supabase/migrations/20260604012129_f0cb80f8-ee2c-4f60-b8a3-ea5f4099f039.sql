
-- ===== conversation_settings (Fase 7) =====
CREATE TABLE IF NOT EXISTS public.conversation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  favorited boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_settings TO authenticated;
GRANT ALL ON public.conversation_settings TO service_role;
ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own conv settings" ON public.conversation_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== Groups (Fase 8) =====
CREATE TYPE public.group_role AS ENUM ('admin','member','observer');

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.group_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- helper: is member?
CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=_group AND user_id=_user);
$$;
CREATE OR REPLACE FUNCTION public.is_group_admin(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=_group AND user_id=_user AND role='admin');
$$;

CREATE POLICY "members view group" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "auth users create group" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "admins update group" ON public.groups FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()));
CREATE POLICY "admins delete group" ON public.groups FOR DELETE TO authenticated
  USING (public.is_group_admin(id, auth.uid()));

CREATE POLICY "members view group_members" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "creator/admin insert members" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_admin(group_id, auth.uid())
    OR EXISTS(SELECT 1 FROM public.groups g WHERE g.id=group_id AND g.created_by=auth.uid())
  );
CREATE POLICY "admins update members" ON public.group_members FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "admin or self delete member" ON public.group_members FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()) OR auth.uid() = user_id);

-- auto-add creator as admin
CREATE OR REPLACE FUNCTION public.add_group_creator_as_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.group_members(group_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_group_creator_admin ON public.groups;
CREATE TRIGGER trg_group_creator_admin AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_group_creator_as_admin();

-- group_blocks
CREATE TABLE IF NOT EXISTS public.group_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_blocks TO authenticated;
GRANT ALL ON public.group_blocks TO service_role;
ALTER TABLE public.group_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self manage group blocks" ON public.group_blocks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- group polls
CREATE TABLE IF NOT EXISTS public.group_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_polls TO authenticated;
GRANT ALL ON public.group_polls TO service_role;
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view polls" ON public.group_polls FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members create polls" ON public.group_polls FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND auth.uid()=created_by);

CREATE TABLE IF NOT EXISTS public.group_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.group_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_poll_votes TO authenticated;
GRANT ALL ON public.group_poll_votes TO service_role;
ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view poll votes" ON public.group_poll_votes FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.group_polls p WHERE p.id=poll_id AND public.is_group_member(p.group_id, auth.uid())));
CREATE POLICY "self vote" ON public.group_poll_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "self update vote" ON public.group_poll_votes FOR UPDATE TO authenticated
  USING (auth.uid()=user_id);

-- group events
CREATE TABLE IF NOT EXISTS public.group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO authenticated;
GRANT ALL ON public.group_events TO service_role;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view events" ON public.group_events FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members create events" ON public.group_events FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND auth.uid()=created_by);
CREATE POLICY "admins delete events" ON public.group_events FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()) OR auth.uid()=created_by);

-- extend conversas with group_id
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;

-- group chat policies on mensagens
CREATE POLICY "members read group msgs" ON public.mensagens FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members+ send group msgs" ON public.mensagens FOR INSERT TO authenticated
  WITH CHECK (
    group_id IS NOT NULL
    AND auth.uid()=sender_id
    AND EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id=mensagens.group_id AND gm.user_id=auth.uid() AND gm.role IN ('admin','member'))
  );
CREATE POLICY "group admins delete msgs" ON public.mensagens FOR DELETE TO authenticated
  USING (group_id IS NOT NULL AND public.is_group_admin(group_id, auth.uid()));

-- ===== mentions (Fase 6) =====
CREATE TABLE IF NOT EXISTS public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id uuid NOT NULL,
  mentioned_by uuid NOT NULL,
  source_type text NOT NULL, -- 'forum_post' | 'forum_reply' | 'review' | 'message' | 'review_comment'
  source_id uuid NOT NULL,
  context_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.mentions TO authenticated;
GRANT ALL ON public.mentions TO service_role;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentioned user views own" ON public.mentions FOR SELECT TO authenticated
  USING (auth.uid()=mentioned_user_id OR auth.uid()=mentioned_by);
CREATE POLICY "auth create mention" ON public.mentions FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=mentioned_by);

-- notify mentioned user
CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.mentioned_user_id <> NEW.mentioned_by THEN
    INSERT INTO public.notifications(user_id, type, title, message, link, metadata)
    VALUES (NEW.mentioned_user_id, 'mention', 'Você foi mencionado',
            COALESCE(NEW.context_preview,'Alguém te mencionou'),
            '/m/perfil/'||NEW.mentioned_by,
            jsonb_build_object('source_type', NEW.source_type, 'source_id', NEW.source_id, 'by', NEW.mentioned_by));
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_notify_mention ON public.mentions;
CREATE TRIGGER trg_notify_mention AFTER INSERT ON public.mentions
  FOR EACH ROW EXECUTE FUNCTION public.notify_mention();

-- friend pairs helper (mutual follow check for group creation done client side)
CREATE OR REPLACE FUNCTION public.are_users_all_mutual_friends(_users uuid[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE i int; j int; a uuid; b uuid;
BEGIN
  FOR i IN 1..array_length(_users,1) LOOP
    FOR j IN i+1..array_length(_users,1) LOOP
      a := _users[i]; b := _users[j];
      IF NOT (
        EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id=a AND following_id=b)
        AND EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id=b AND following_id=a)
      ) THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END;$$;
