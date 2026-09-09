
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS ban_reason_public text,
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

DO $$ BEGIN
  CREATE TYPE public.ban_appeal_reason AS ENUM ('nao_concordo','conta_invadida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ban_appeal_status AS ENUM ('pendente','em_analise','deferido','indeferido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ban_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.ban_appeal_reason NOT NULL,
  description text NOT NULL,
  status public.ban_appeal_status NOT NULL DEFAULT 'pendente',
  moderator_response text,
  moderator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT ON public.ban_appeals TO authenticated;
GRANT ALL ON public.ban_appeals TO service_role;

ALTER TABLE public.ban_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own appeals" ON public.ban_appeals;
CREATE POLICY "user reads own appeals" ON public.ban_appeals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user creates own appeal" ON public.ban_appeals;
CREATE POLICY "user creates own appeal" ON public.ban_appeals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mod updates appeal" ON public.ban_appeals;
CREATE POLICY "mod updates appeal" ON public.ban_appeals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.submit_ban_appeal(
  _reason public.ban_appeal_reason,
  _description text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(coalesce(_description,'')) < 10 THEN RAISE EXCEPTION 'descricao muito curta'; END IF;
  INSERT INTO public.ban_appeals(user_id, reason, description)
  VALUES (_uid, _reason, _description) RETURNING id INTO _id;
  RETURN _id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_ban_appeal(public.ban_appeal_reason, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.profiles SET
    display_name = 'usuário removido',
    username = NULL,
    avatar_url = NULL,
    banner_url = NULL,
    profile_cover_url = NULL,
    bio = NULL,
    seller_bio = NULL,
    phone = NULL,
    cpf = NULL,
    contact_email = NULL,
    favorite_genres = '{}',
    monthly_favorites = '{}',
    is_private = true,
    anonymized_at = now(),
    banned_until = NULL,
    ban_reason = NULL,
    ban_reason_public = NULL
  WHERE id = _uid;
END $$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

ALTER TABLE public.avaliacoes_usuario
  ADD COLUMN IF NOT EXISTS trade_id text,
  ADD COLUMN IF NOT EXISTS is_revealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reveal_deadline timestamptz NOT NULL DEFAULT (now() + interval '7 days');

CREATE OR REPLACE FUNCTION public.tg_pair_reveal_avaliacoes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.avaliacoes_usuario
    WHERE anuncio_id IS NOT DISTINCT FROM NEW.anuncio_id
      AND reviewer_id = NEW.reviewed_id
      AND reviewed_id = NEW.reviewer_id
      AND id <> NEW.id
  ) THEN
    UPDATE public.avaliacoes_usuario
    SET is_revealed = true
    WHERE anuncio_id IS NOT DISTINCT FROM NEW.anuncio_id
      AND ((reviewer_id = NEW.reviewer_id AND reviewed_id = NEW.reviewed_id)
        OR (reviewer_id = NEW.reviewed_id AND reviewed_id = NEW.reviewer_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pair_reveal ON public.avaliacoes_usuario;
CREATE TRIGGER trg_pair_reveal AFTER INSERT ON public.avaliacoes_usuario
  FOR EACH ROW EXECUTE FUNCTION public.tg_pair_reveal_avaliacoes();

CREATE OR REPLACE FUNCTION public.auto_reveal_stale_ratings()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  UPDATE public.avaliacoes_usuario SET is_revealed = true
  WHERE is_revealed = false AND reveal_deadline < now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

GRANT EXECUTE ON FUNCTION public.auto_reveal_stale_ratings() TO service_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS guardian_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS minor_chat_level char(1) CHECK (minor_chat_level IN ('A','B')),
  ADD COLUMN IF NOT EXISTS chat_privacy_mode text NOT NULL DEFAULT 'friends_direct'
    CHECK (chat_privacy_mode IN ('friends_direct','followers_direct','request_only')),
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.age_bracket(_birth date)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _birth IS NULL THEN 'desconhecido'
    WHEN age(now(), _birth) < interval '12 years' THEN 'crianca'
    WHEN age(now(), _birth) < interval '18 years' THEN 'adolescente'
    ELSE 'adulto'
  END;
$$;

DO $$ BEGIN
  CREATE TYPE public.classificacao_indicativa AS ENUM ('L','10','12','14','16','18');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS classificacao_indicativa public.classificacao_indicativa NOT NULL DEFAULT 'L';

CREATE OR REPLACE FUNCTION public.pode_acessar_conteudo(_user uuid, _classificacao public.classificacao_indicativa)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _birth date; _min_age int;
BEGIN
  IF _user IS NULL THEN
    RETURN _classificacao IN ('L','10','12');
  END IF;
  IF public.has_role(_user, 'admin') THEN
    RETURN true;
  END IF;
  SELECT birth_date INTO _birth FROM public.profiles WHERE id = _user;
  IF _birth IS NULL THEN
    RETURN _classificacao = 'L';
  END IF;
  _min_age := CASE _classificacao
    WHEN 'L' THEN 0 WHEN '10' THEN 10 WHEN '12' THEN 12
    WHEN '14' THEN 14 WHEN '16' THEN 16 WHEN '18' THEN 18 END;
  RETURN extract(year from age(now(), _birth)) >= _min_age;
END $$;

GRANT EXECUTE ON FUNCTION public.pode_acessar_conteudo(uuid, public.classificacao_indicativa) TO authenticated, anon;
