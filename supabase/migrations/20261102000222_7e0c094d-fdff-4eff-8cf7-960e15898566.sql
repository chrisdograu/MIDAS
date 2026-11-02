CREATE OR REPLACE FUNCTION public.enforce_stock_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    IF current_user <> pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid = 'public.create_order_secure(jsonb,text,integer,text,numeric)'::regprocedure))
       AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_position(ARRAY['admin','gerente','estoquista'])) THEN
      RAISE EXCEPTION 'Apenas Gerente ou Estoquista podem alterar o estoque';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;