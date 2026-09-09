
-- Encontrar e remover triggers errados que chamam essa função
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tgname, tgrelid::regclass AS tbl
    FROM pg_trigger
    WHERE tgfoid = 'public.enforce_public_profile_for_sellers'::regproc
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.tgname, r.tbl);
  END LOOP;
END$$;

-- Recria o trigger no lugar correto: na tabela anuncios
CREATE TRIGGER anuncios_enforce_public_profile
  AFTER INSERT OR UPDATE OF status ON public.anuncios
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_public_profile_for_sellers();
