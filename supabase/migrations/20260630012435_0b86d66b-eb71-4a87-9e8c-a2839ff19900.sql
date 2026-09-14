
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'usado';
ALTER TABLE public.anuncios DROP CONSTRAINT IF EXISTS anuncios_condition_check;
ALTER TABLE public.anuncios ADD CONSTRAINT anuncios_condition_check CHECK (condition IN ('novo','seminovo','usado','recondicionado'));
CREATE INDEX IF NOT EXISTS idx_anuncios_filters ON public.anuncios (status, condition, price);

INSERT INTO public.site_settings (key, value)
VALUES ('max_active_ads_uncertified', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_uncertified_ad_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_limit int; v_count int;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF public.has_active_certificate(NEW.seller_id) THEN RETURN NEW; END IF;
  SELECT COALESCE(value::text::int, 5) INTO v_limit FROM public.site_settings WHERE key = 'max_active_ads_uncertified';
  SELECT count(*) INTO v_count FROM public.anuncios
    WHERE seller_id = NEW.seller_id AND status = 'active' AND id <> NEW.id;
  IF v_count >= COALESCE(v_limit, 5) THEN
    RAISE EXCEPTION 'Limite de % anúncios ativos atingido. Obtenha a certificação para anunciar mais.', v_limit USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_uncertified_ad_limit_trg ON public.anuncios;
CREATE TRIGGER enforce_uncertified_ad_limit_trg
  BEFORE INSERT OR UPDATE OF status ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_uncertified_ad_limit();
