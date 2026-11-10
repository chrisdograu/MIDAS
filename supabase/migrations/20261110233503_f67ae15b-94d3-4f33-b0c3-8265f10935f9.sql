ALTER TABLE public.forum_post_likes ADD COLUMN reaction_type text NOT NULL DEFAULT 'like';
GRANT UPDATE ON public.forum_post_likes TO authenticated;
CREATE POLICY own_reaction_update ON public.forum_post_likes FOR UPDATE TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id AND NOT public.is_user_banned(auth.uid()));
CREATE FUNCTION public.validate_forum_reaction() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.reaction_type NOT IN('like','love','laugh','wow','sad','angry') THEN RAISE EXCEPTION 'Reação inválida'; END IF;
 IF TG_OP='UPDATE' AND (NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN RAISE EXCEPTION 'Não é permitido mudar o autor ou a publicação da reação'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER forum_reaction_validate BEFORE INSERT OR UPDATE ON public.forum_post_likes FOR EACH ROW EXECUTE FUNCTION public.validate_forum_reaction();
REVOKE ALL ON FUNCTION public.validate_forum_reaction() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';