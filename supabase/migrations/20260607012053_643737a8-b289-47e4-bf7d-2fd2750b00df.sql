
-- ============================================================
-- PERFIL DUPLO: seller_profiles + scopes em blocked_users/conversas/mentions
-- ============================================================

-- 1) Tabela seller_profiles
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL UNIQUE CHECK (handle ~ '^[a-zA-Z0-9_.-]{2,32}$'),
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  is_private boolean NOT NULL DEFAULT false,
  rating numeric(2,1) NOT NULL DEFAULT 0,
  total_sales int NOT NULL DEFAULT 0,
  total_trades int NOT NULL DEFAULT 0,
  first_listing_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.seller_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.seller_profiles TO authenticated;
GRANT ALL ON public.seller_profiles TO service_role;

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- Leitura aberta: privacidade tratada no app (precisa permitir lookup via anúncio mesmo se privado)
CREATE POLICY "Seller profiles publicly readable" ON public.seller_profiles
  FOR SELECT USING (true);

CREATE POLICY "Owner manages seller profile" ON public.seller_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_seller_profiles_handle ON public.seller_profiles (lower(handle));

CREATE TRIGGER trg_seller_profiles_updated_at
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Escopo em blocked_users (personal | seller)
ALTER TABLE public.blocked_users
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal'
  CHECK (scope IN ('personal','seller'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blocked_users_blocker_id_blocked_id_key'
  ) THEN
    ALTER TABLE public.blocked_users DROP CONSTRAINT blocked_users_blocker_id_blocked_id_key;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS blocked_users_unique_scope
  ON public.blocked_users (blocker_id, blocked_id, scope);

-- 3) Canal em conversas (personal | seller)
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'personal'
  CHECK (channel IN ('personal','seller'));

-- Permite duas conversas entre mesmas pessoas se canais diferentes.
-- Não criamos UNIQUE estrito por não saber o esquema atual; índice de apoio:
CREATE INDEX IF NOT EXISTS idx_conversas_channel
  ON public.conversas (participant_1, participant_2, channel);

-- 4) Namespace em mentions
ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS namespace text NOT NULL DEFAULT 'personal'
  CHECK (namespace IN ('personal','seller'));

-- 5) Trigger: anúncio exige perfil vendedor; carimba first_listing_at
CREATE OR REPLACE FUNCTION public.enforce_seller_profile_for_anuncio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.seller_profiles WHERE user_id = NEW.seller_id) THEN
    RAISE EXCEPTION 'Você precisa criar um perfil de vendedor ($) antes de publicar anúncios'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'active' THEN
    UPDATE public.seller_profiles
      SET first_listing_at = COALESCE(first_listing_at, now())
    WHERE user_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_enforce_seller_profile ON public.anuncios;
CREATE TRIGGER trg_enforce_seller_profile
  BEFORE INSERT ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_profile_for_anuncio();

-- 6) Helper: get seller profile by user_id
CREATE OR REPLACE FUNCTION public.get_seller_profile(_user_id uuid)
RETURNS public.seller_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.seller_profiles WHERE user_id = _user_id LIMIT 1
$$;
