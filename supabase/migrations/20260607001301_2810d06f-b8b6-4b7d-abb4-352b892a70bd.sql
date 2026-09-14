
-- ============================================================
-- Bundles: galeria de imagens
-- ============================================================
ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

-- ============================================================
-- Produtos: estado de publicação
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.produto_estado AS ENUM ('ativo','oculto','somente_forum','somente_loja','descontinuado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estado_publicacao public.produto_estado NOT NULL DEFAULT 'ativo';

-- ============================================================
-- Notificações: kind + banner + CTA
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.notification_kind AS ENUM ('comum','destacada','especial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS kind public.notification_kind NOT NULL DEFAULT 'comum';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS cta_label text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS cta_url text;

-- ============================================================
-- Preferências de notificação por usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  social_likes boolean NOT NULL DEFAULT true,
  social_replies boolean NOT NULL DEFAULT true,
  social_follows boolean NOT NULL DEFAULT true,
  forum_replies boolean NOT NULL DEFAULT true,
  forum_mentions boolean NOT NULL DEFAULT true,
  forum_topics boolean NOT NULL DEFAULT true,
  tournament_signup boolean NOT NULL DEFAULT true,
  tournament_7d boolean NOT NULL DEFAULT true,
  tournament_1d boolean NOT NULL DEFAULT true,
  tournament_1h boolean NOT NULL DEFAULT true,
  tournament_match boolean NOT NULL DEFAULT true,
  tournament_result boolean NOT NULL DEFAULT true,
  library_review_completa boolean NOT NULL DEFAULT true,
  library_opinion boolean NOT NULL DEFAULT true,
  library_screenshot boolean NOT NULL DEFAULT true,
  library_activity boolean NOT NULL DEFAULT true,
  midias_especiais boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia suas prefs"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Logs administrativos (com reverter)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  reason text,
  payload jsonb,
  reverted_by uuid REFERENCES auth.users(id),
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff vê logs" ON public.admin_logs FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Staff cria logs" ON public.admin_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND admin_id = auth.uid());
CREATE POLICY "Apenas admin geral reverte" ON public.admin_logs FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity ON public.admin_logs(entity, entity_id);

-- ============================================================
-- Tickets de suporte (mobile = chat, web = email)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.ticket_channel AS ENUM ('mobile','web');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('aberto','em_andamento','aguardando_usuario','resolvido','fechado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.ticket_channel NOT NULL,
  subject text NOT NULL,
  body text,
  attachments text[] NOT NULL DEFAULT '{}',
  status public.ticket_status NOT NULL DEFAULT 'aberto',
  assigned_to uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus tickets" ON public.tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "Usuário cria ticket" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff atualiza tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL,
  attachments text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê mensagens dos próprios tickets" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_staff())));
CREATE POLICY "Envia mensagens nos próprios tickets" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_staff())));

CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at);

-- ============================================================
-- Estado social do conteúdo (NOVO/VISTO/CURTIDO/OCULTO)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.social_content_state AS ENUM ('novo','visto','curtido','oculto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.social_content_states (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  state public.social_content_state NOT NULL DEFAULT 'novo',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_type, content_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_content_states TO authenticated;
GRANT ALL ON public.social_content_states TO service_role;
ALTER TABLE public.social_content_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia seus estados" ON public.social_content_states FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Regra: estado nunca pode voltar para 'novo'
CREATE OR REPLACE FUNCTION public.prevent_revert_to_novo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.state <> 'novo' AND NEW.state = 'novo' THEN
    RAISE EXCEPTION 'Conteúdo não pode voltar ao estado novo';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_prevent_revert_to_novo ON public.social_content_states;
CREATE TRIGGER trg_prevent_revert_to_novo
  BEFORE UPDATE ON public.social_content_states
  FOR EACH ROW EXECUTE FUNCTION public.prevent_revert_to_novo();

-- ============================================================
-- Favoritos sociais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_type, content_id)
);

GRANT SELECT, INSERT, DELETE ON public.social_favorites TO authenticated;
GRANT ALL ON public.social_favorites TO service_role;
ALTER TABLE public.social_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia favoritos sociais" ON public.social_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Timeline por jogo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.game_timeline_events TO authenticated;
GRANT ALL ON public.game_timeline_events TO service_role;
ALTER TABLE public.game_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono insere eventos" ON public.game_timeline_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Amigos veem timeline" ON public.game_timeline_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.are_mutual_friends(user_id, auth.uid()) OR public.is_staff());

CREATE INDEX IF NOT EXISTS idx_timeline_user_product ON public.game_timeline_events(user_id, product_id, created_at DESC);
