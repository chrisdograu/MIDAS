CREATE TABLE public.developer_channel_managers (developer_id uuid NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(developer_id,user_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_channel_managers TO authenticated; GRANT ALL ON public.developer_channel_managers TO service_role;
ALTER TABLE public.developer_channel_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY managers_read ON public.developer_channel_managers FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());
CREATE POLICY managers_admin ON public.developer_channel_managers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE FUNCTION public.can_manage_developer_channel(_developer_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (public.is_admin() OR EXISTS(SELECT 1 FROM public.developer_channel_managers WHERE developer_id=_developer_id AND user_id=auth.uid())); $$;
REVOKE ALL ON FUNCTION public.can_manage_developer_channel(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.can_manage_developer_channel(uuid) TO authenticated,service_role;
CREATE TABLE public.developer_updates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE, author_id uuid NOT NULL REFERENCES public.profiles(id), body text NOT NULL, images text[] NOT NULL DEFAULT '{}', is_pinned boolean NOT NULL DEFAULT false, comments_open boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.developer_updates TO anon; GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_updates TO authenticated; GRANT ALL ON public.developer_updates TO service_role;
ALTER TABLE public.developer_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY updates_read ON public.developer_updates FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY updates_create ON public.developer_updates FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND public.can_manage_developer_channel(developer_id));
CREATE POLICY updates_edit ON public.developer_updates FOR UPDATE TO authenticated USING(public.can_manage_developer_channel(developer_id)) WITH CHECK(public.can_manage_developer_channel(developer_id));
CREATE POLICY updates_delete ON public.developer_updates FOR DELETE TO authenticated USING(public.can_manage_developer_channel(developer_id));
CREATE TABLE public.developer_update_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), update_id uuid NOT NULL REFERENCES public.developer_updates(id) ON DELETE CASCADE, author_id uuid NOT NULL REFERENCES public.profiles(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.developer_update_comments TO anon; GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_update_comments TO authenticated; GRANT ALL ON public.developer_update_comments TO service_role;
ALTER TABLE public.developer_update_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_read ON public.developer_update_comments FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY comments_create ON public.developer_update_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND EXISTS(SELECT 1 FROM public.developer_updates u WHERE u.id=update_id AND u.comments_open));
CREATE POLICY comments_edit ON public.developer_update_comments FOR UPDATE TO authenticated USING(author_id=auth.uid()) WITH CHECK(author_id=auth.uid());
CREATE POLICY comments_delete ON public.developer_update_comments FOR DELETE TO authenticated USING(author_id=auth.uid() OR EXISTS(SELECT 1 FROM public.developer_updates u WHERE u.id=update_id AND public.can_manage_developer_channel(u.developer_id)));
CREATE FUNCTION public.validate_developer_channel_content() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_TABLE_NAME='developer_updates' THEN
  IF length(trim(NEW.body)) NOT BETWEEN 1 AND 10000 OR cardinality(NEW.images)>4 THEN RAISE EXCEPTION 'Publicação inválida'; END IF;
  IF TG_OP='UPDATE' AND (NEW.developer_id<>OLD.developer_id OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at) THEN RAISE EXCEPTION 'Identidade da publicação não pode mudar'; END IF;
 ELSE
  IF length(trim(NEW.body)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Comentário inválido'; END IF;
  IF TG_OP='UPDATE' AND (NEW.update_id<>OLD.update_id OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at) THEN RAISE EXCEPTION 'Identidade do comentário não pode mudar'; END IF;
 END IF;
 NEW.body=trim(NEW.body); NEW.updated_at=now(); RETURN NEW; END; $$;
CREATE TRIGGER validate_developer_updates BEFORE INSERT OR UPDATE ON public.developer_updates FOR EACH ROW EXECUTE FUNCTION public.validate_developer_channel_content();
CREATE TRIGGER validate_developer_update_comments BEFORE INSERT OR UPDATE ON public.developer_update_comments FOR EACH ROW EXECUTE FUNCTION public.validate_developer_channel_content();
CREATE INDEX developer_updates_feed ON public.developer_updates(developer_id,is_pinned DESC,created_at DESC);
CREATE INDEX developer_comments_feed ON public.developer_update_comments(update_id,created_at);
CREATE FUNCTION public.admin_assign_developer_channel(_developer_id uuid,_username text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target uuid; BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores'; END IF;
 SELECT id INTO target FROM public.profiles WHERE lower(username)=lower(trim(ltrim(_username,'@')));
 IF target IS NULL THEN RAISE EXCEPTION 'Conta não encontrada. Informe o nome de usuário cadastrado.'; END IF;
 INSERT INTO public.developer_channel_managers(developer_id,user_id) VALUES(_developer_id,target) ON CONFLICT DO NOTHING;
 END; $$;
REVOKE ALL ON FUNCTION public.admin_assign_developer_channel(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.admin_assign_developer_channel(uuid,text) TO authenticated,service_role;