
-- Item 114: torneio adaptado / PcD
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS adaptado_pcd boolean NOT NULL DEFAULT false;

-- Item 99: selo "Vendedor Frequente"
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_frequent_seller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequent_seller_at timestamptz,
  ADD COLUMN IF NOT EXISTS frequent_seller_notice_dismissed_at timestamptz;

INSERT INTO public.badge_catalog (id, name, description, icon, category)
VALUES ('frequent_seller', 'Vendedor Frequente', 'Suas vendas estão bombando! 6+ vendas em 45 dias.', '🔥', 'marketplace')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_frequent_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cnt int;
  _already boolean;
BEGIN
  IF NEW.status IN ('sold','traded') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT count(*) INTO _cnt
      FROM public.anuncios
      WHERE seller_id = NEW.seller_id
        AND status IN ('sold','traded')
        AND updated_at >= now() - interval '45 days';
    IF _cnt >= 6 THEN
      SELECT is_frequent_seller INTO _already FROM public.profiles WHERE id = NEW.seller_id;
      IF NOT COALESCE(_already, false) THEN
        UPDATE public.profiles
          SET is_frequent_seller = true, frequent_seller_at = now()
          WHERE id = NEW.seller_id;
        INSERT INTO public.user_badges (user_id, badge_id)
          VALUES (NEW.seller_id, 'frequent_seller')
          ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_frequent_seller ON public.anuncios;
CREATE TRIGGER trg_check_frequent_seller
  AFTER UPDATE OF status ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.check_frequent_seller();

-- Item 121: exigir e-mail confirmado pra publicar anúncio
CREATE OR REPLACE FUNCTION public.enforce_email_confirmed_for_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE _confirmed timestamptz;
BEGIN
  SELECT email_confirmed_at INTO _confirmed FROM auth.users WHERE id = NEW.seller_id;
  IF _confirmed IS NULL THEN
    RAISE EXCEPTION 'Confirme seu e-mail antes de publicar anúncios no marketplace.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_email_confirmed_for_ad ON public.anuncios;
CREATE TRIGGER trg_enforce_email_confirmed_for_ad
  BEFORE INSERT ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_email_confirmed_for_ad();
