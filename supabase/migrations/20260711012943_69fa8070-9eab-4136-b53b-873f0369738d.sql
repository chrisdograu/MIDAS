
-- Onboarding: marca quando o usuário concluiu (ou pulou) o passo inicial
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);

-- Garante código de indicação em todos os perfis existentes
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
BEGIN
  LOOP
    code := upper(substr(replace(encode(gen_random_bytes(6),'base64'),'/',''),1,8));
    code := regexp_replace(code, '[^A-Z0-9]', 'X', 'g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

UPDATE public.profiles
   SET referral_code = public.gen_referral_code()
 WHERE referral_code IS NULL;

-- Trigger para auto-atribuir código em novos perfis
CREATE OR REPLACE FUNCTION public.profiles_set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.gen_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_referral_code();

-- RPC de resgate de indicação: aplica uma única vez, dá XP para os dois
CREATE OR REPLACE FUNCTION public.redeem_referral(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  referrer_id uuid;
  my_code text;
BEGIN
  IF me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT referred_by, referral_code INTO referrer_id, my_code
  FROM public.profiles WHERE id = me;

  IF referrer_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  SELECT id INTO referrer_id
  FROM public.profiles
  WHERE upper(referral_code) = upper(_code) AND id <> me
  LIMIT 1;

  IF referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.profiles SET referred_by = referrer_id WHERE id = me;

  -- XP para quem indicou e para quem foi indicado
  INSERT INTO public.user_xp_log (user_id, action, xp, reference_type, reference_id)
  VALUES
    (referrer_id, 'referral_invite', 200, 'profile', me),
    (me,          'referral_join',   100, 'profile', referrer_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'referrer', referrer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;
