
-- ===== Torneio Pago =====
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'weekly' CHECK (kind IN ('weekly','monthly')),
  ADD COLUMN IF NOT EXISTS entry_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prize_distribution jsonb NOT NULL DEFAULT '{"first":150,"second":50,"third":20}'::jsonb,
  ADD COLUMN IF NOT EXISTS refund_policy text;

CREATE TABLE IF NOT EXISTS public.tournament_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position int NOT NULL,
  offered_at timestamptz,
  offer_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_waitlist TO authenticated;
GRANT ALL ON public.tournament_waitlist TO service_role;
ALTER TABLE public.tournament_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view waitlist" ON public.tournament_waitlist;
CREATE POLICY "view waitlist" ON public.tournament_waitlist FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "join waitlist self" ON public.tournament_waitlist;
CREATE POLICY "join waitlist self" ON public.tournament_waitlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "leave waitlist self" ON public.tournament_waitlist;
CREATE POLICY "leave waitlist self" ON public.tournament_waitlist FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "update waitlist admin" ON public.tournament_waitlist;
CREATE POLICY "update waitlist admin" ON public.tournament_waitlist FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.tournament_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stage text NOT NULL CHECK (stage IN ('7d','1d','1h')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  confirmed_at timestamptz,
  UNIQUE(tournament_id, user_id, stage)
);
GRANT SELECT, INSERT, UPDATE ON public.tournament_confirmations TO authenticated;
GRANT ALL ON public.tournament_confirmations TO service_role;
ALTER TABLE public.tournament_confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view own confirmations" ON public.tournament_confirmations;
CREATE POLICY "view own confirmations" ON public.tournament_confirmations FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "confirm own" ON public.tournament_confirmations;
CREATE POLICY "confirm own" ON public.tournament_confirmations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "insert confirmations service" ON public.tournament_confirmations;
CREATE POLICY "insert confirmations service" ON public.tournament_confirmations FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  event text NOT NULL,
  secret text,
  active boolean NOT NULL DEFAULT true,
  last_test_status text,
  last_test_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_webhooks TO authenticated;
GRANT ALL ON public.integration_webhooks TO service_role;
ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manages webhooks" ON public.integration_webhooks;
CREATE POLICY "admin manages webhooks" ON public.integration_webhooks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS trg_iw_updated ON public.integration_webhooks;
CREATE TRIGGER trg_iw_updated BEFORE UPDATE ON public.integration_webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  parent_slug text,
  is_community boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_categories TO anon, authenticated;
GRANT ALL ON public.forum_categories TO service_role;
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read categories" ON public.forum_categories;
CREATE POLICY "read categories" ON public.forum_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin manage categories" ON public.forum_categories;
CREATE POLICY "admin manage categories" ON public.forum_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.forum_categories (slug, name, description, is_community, display_order) VALUES
  ('comunidade','Comunidade','Discussões gerais da plataforma MIDIAS', true, 0)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.forum_categories (slug, name, description, parent_slug, is_community, display_order) VALUES
  ('novidades','Novidades','Atualizações e anúncios','comunidade',true,1),
  ('sugestoes','Sugestões','Sugira melhorias','comunidade',true,2),
  ('off-topic','Off-topic','Conversas gerais','comunidade',true,3),
  ('apresentacoes','Apresentações','Novos usuários','comunidade',true,4)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS category_slug text REFERENCES public.forum_categories(slug);

CREATE TABLE IF NOT EXISTS public.review_completa_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews_completas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.review_completa_visibility TO authenticated;
GRANT ALL ON public.review_completa_visibility TO service_role;
ALTER TABLE public.review_completa_visibility ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages rc visibility" ON public.review_completa_visibility;
CREATE POLICY "owner manages rc visibility" ON public.review_completa_visibility FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reviews_completas r WHERE r.id = review_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reviews_completas r WHERE r.id = review_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS "viewer can see own grant" ON public.review_completa_visibility;
CREATE POLICY "viewer can see own grant" ON public.review_completa_visibility FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.biblioteca_usuario
  ADD COLUMN IF NOT EXISTS badge_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_platinum boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_verified_source text;

CREATE TABLE IF NOT EXISTS public.xp_levels (
  level int PRIMARY KEY,
  xp_required int NOT NULL,
  title text NOT NULL
);
GRANT SELECT ON public.xp_levels TO anon, authenticated;
GRANT ALL ON public.xp_levels TO service_role;
ALTER TABLE public.xp_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read levels" ON public.xp_levels;
CREATE POLICY "read levels" ON public.xp_levels FOR SELECT USING (true);

INSERT INTO public.xp_levels (level, xp_required, title) VALUES
  (1,0,'Novato'),(2,200,'Jogador'),(3,500,'Gamer'),(4,750,'Experiente'),(5,1000,'Veterano'),
  (6,1500,'Elite'),(7,2000,'Mestre'),(8,2500,'Lendário'),(9,3500,'Herói'),(10,5000,'Boss Final'),
  (11,5280,'Boss Final +'),(12,5560,'Boss Final ++'),(13,5840,'Boss Final +++'),
  (14,6120,'Boss Final ++++'),(15,6400,'Boss Final +++++'),
  (16,6767,'Rei do 67'),(17,7500,'Imperador do 67')
ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required, title = EXCLUDED.title;

DROP TRIGGER IF EXISTS trg_enforce_seller_profile ON public.anuncios;
CREATE TRIGGER trg_enforce_seller_profile
BEFORE INSERT OR UPDATE ON public.anuncios
FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_profile_for_anuncio();

CREATE INDEX IF NOT EXISTS idx_tcm_tournament_created ON public.tournament_chat_messages (tournament_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcm_content_trgm ON public.tournament_chat_messages USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gte_user_created ON public.game_timeline_events (user_id, created_at DESC);
