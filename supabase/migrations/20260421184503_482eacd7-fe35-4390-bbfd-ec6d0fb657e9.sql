-- Trigger que protege a coluna profiles.banned_until — apenas administradores podem alterá-la.
-- Isso impede que um gerente, atendente ou o próprio usuário se desbanir editando o perfil.

CREATE OR REPLACE FUNCTION public.protect_banned_until()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o valor de banned_until mudou, exige que o usuário atual seja admin
  IF NEW.banned_until IS DISTINCT FROM OLD.banned_until THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o status de banimento de um usuário.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_banned_until_trigger ON public.profiles;
CREATE TRIGGER protect_banned_until_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_banned_until();