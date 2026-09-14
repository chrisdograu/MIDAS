
CREATE OR REPLACE FUNCTION public.revoke_privacy_on_unfollow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando OLD.follower deixa de seguir OLD.following, remove os grants
  -- que OLD.following havia dado para OLD.follower verem conteúdo privado.
  DELETE FROM public.privacy_grants
   WHERE owner_id = OLD.following_id
     AND viewer_id = OLD.follower_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_privacy_on_unfollow ON public.user_follows;
CREATE TRIGGER trg_revoke_privacy_on_unfollow
AFTER DELETE ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION public.revoke_privacy_on_unfollow();
