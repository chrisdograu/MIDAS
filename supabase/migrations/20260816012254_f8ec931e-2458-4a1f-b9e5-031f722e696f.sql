CREATE OR REPLACE FUNCTION public.read_user_library_admin(_target uuid, _reason text)
RETURNS SETOF public.biblioteca_usuario
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 6 THEN
    RAISE EXCEPTION 'justificativa obrigatória (mínimo 6 caracteres)';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (
    auth.uid(),
    'admin_view_library',
    'profiles',
    _target,
    btrim(_reason),
    jsonb_build_object('target_user_id', _target)
  );

  RETURN QUERY
    SELECT * FROM public.biblioteca_usuario WHERE user_id = _target;
END;
$function$;

REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_logs FROM authenticated;
GRANT SELECT, INSERT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;