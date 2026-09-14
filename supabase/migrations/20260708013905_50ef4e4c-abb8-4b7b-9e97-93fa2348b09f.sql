
CREATE OR REPLACE FUNCTION public.list_profiles_admin(_ids uuid[])
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT * FROM public.profiles
    WHERE _ids IS NULL OR id = ANY(_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.list_profiles_admin(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.list_profiles_admin(uuid[]) TO authenticated;
