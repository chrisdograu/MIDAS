
-- 1. Funções de cargo
CREATE OR REPLACE FUNCTION public.is_atendimento()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.is_direcao() OR public.has_position(ARRAY['atendente']); $$;

CREATE OR REPLACE FUNCTION public.is_marketplace_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.is_direcao() OR public.has_position(ARRAY['atendente_marketplace']); $$;

-- 2. Atendimento
DROP POLICY IF EXISTS "Staff gerencia todos os pedidos" ON public.pedidos;
CREATE POLICY "Atendimento gerencia pedidos" ON public.pedidos
  FOR ALL TO authenticated USING (public.is_atendimento()) WITH CHECK (public.is_atendimento());

DROP POLICY IF EXISTS "Staff gerencia itens de pedido" ON public.itens_pedido;
CREATE POLICY "Atendimento gerencia itens de pedido" ON public.itens_pedido
  FOR ALL TO authenticated USING (public.is_atendimento()) WITH CHECK (public.is_atendimento());

DROP POLICY IF EXISTS "Staff can view all mensagens" ON public.mensagens;
CREATE POLICY "Atendimento vê mensagens" ON public.mensagens
  FOR SELECT TO authenticated USING (public.is_atendimento());

DROP POLICY IF EXISTS "Usuário vê seus tickets" ON public.tickets;
CREATE POLICY "Usuário vê seus tickets" ON public.tickets
  FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR public.is_atendimento());

DROP POLICY IF EXISTS "Staff atualiza tickets" ON public.tickets;
CREATE POLICY "Atendimento atualiza tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (public.is_atendimento()) WITH CHECK (public.is_atendimento());

DROP POLICY IF EXISTS "Vê mensagens dos próprios tickets" ON public.ticket_messages;
CREATE POLICY "Vê mensagens dos próprios tickets" ON public.ticket_messages
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id AND (t.user_id = auth.uid() OR public.is_atendimento())));

DROP POLICY IF EXISTS "Envia mensagens nos próprios tickets" ON public.ticket_messages;
CREATE POLICY "Envia mensagens nos próprios tickets" ON public.ticket_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id AND (t.user_id = auth.uid() OR public.is_atendimento())));

-- 3. Marketplace
DROP POLICY IF EXISTS "Staff can view all anuncios" ON public.anuncios;
CREATE POLICY "Marketplace staff vê anuncios" ON public.anuncios
  FOR SELECT TO authenticated USING (public.is_marketplace_staff());

DROP POLICY IF EXISTS "Staff can update anuncios" ON public.anuncios;
CREATE POLICY "Marketplace staff atualiza anuncios" ON public.anuncios
  FOR UPDATE TO authenticated USING (public.is_marketplace_staff()) WITH CHECK (public.is_marketplace_staff());

DROP POLICY IF EXISTS "Staff can view all trade proposals" ON public.trade_proposals;
CREATE POLICY "Marketplace staff vê trade proposals" ON public.trade_proposals
  FOR SELECT TO authenticated USING (public.is_marketplace_staff());

-- 4. Visibilidade por lista customizada
CREATE TABLE IF NOT EXISTS public.lista_visibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lista_custom text NOT NULL,
  visibility text NOT NULL DEFAULT 'publico' CHECK (visibility IN ('publico','amigos','privado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lista_custom)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lista_visibilidade TO authenticated;
GRANT SELECT ON public.lista_visibilidade TO anon;
GRANT ALL ON public.lista_visibilidade TO service_role;

ALTER TABLE public.lista_visibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem visibilidade de lista" ON public.lista_visibilidade
  FOR SELECT USING (true);
CREATE POLICY "Dono gerencia visibilidade de lista" ON public.lista_visibilidade
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_lista_visibilidade_updated_at
  BEFORE UPDATE ON public.lista_visibilidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Opt-out granular de estatística
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stats_hidden_types text[] NOT NULL DEFAULT '{}';

-- 6. Busca: pg_trgm + GIN
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_produtos_title_trgm ON public.produtos USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_produtos_description_trgm ON public.produtos USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_anuncios_title_trgm ON public.anuncios USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_anuncios_game_title_trgm ON public.anuncios USING gin (game_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_forum_posts_title_trgm ON public.forum_posts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_forum_posts_content_trgm ON public.forum_posts USING gin (content gin_trgm_ops);
