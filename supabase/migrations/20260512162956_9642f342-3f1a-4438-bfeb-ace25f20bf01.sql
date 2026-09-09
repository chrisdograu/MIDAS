
-- ============ FASE 4 + FIXES ============

-- 1) produtos: flag para esconder até receber primeiro estoque
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS awaiting_first_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- Trigger: quando estoque passar de 0 para >0 pela primeira vez, libera o produto
CREATE OR REPLACE FUNCTION public.unlock_product_on_first_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.awaiting_first_stock = true AND NEW.stock > 0 AND COALESCE(OLD.stock,0) = 0 THEN
    NEW.awaiting_first_stock := false;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_unlock_product_on_first_stock ON public.produtos;
CREATE TRIGGER trg_unlock_product_on_first_stock
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.unlock_product_on_first_stock();

-- 2) Histórico de preços
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  price numeric NOT NULL,
  original_price numeric NOT NULL DEFAULT 0,
  discount integer NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.price_history(product_id, recorded_at DESC);
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view price history" ON public.price_history FOR SELECT USING (true);
CREATE POLICY "Admins manage price history" ON public.price_history FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.price IS DISTINCT FROM OLD.price OR NEW.original_price IS DISTINCT FROM OLD.original_price THEN
    INSERT INTO public.price_history(product_id, price, original_price, discount)
    VALUES (NEW.id, NEW.price, NEW.original_price, NEW.discount);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_log_price_change ON public.produtos;
CREATE TRIGGER trg_log_price_change AFTER INSERT OR UPDATE OF price, original_price ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.log_price_change();

-- 3) Promoções relâmpago
CREATE TABLE IF NOT EXISTS public.flash_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_flash_promo_active ON public.flash_promotions(is_active, ends_at);
ALTER TABLE public.flash_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view active promos" ON public.flash_promotions FOR SELECT USING (true);
CREATE POLICY "Admins manage flash promos" ON public.flash_promotions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 4) Bundles
CREATE TABLE IF NOT EXISTS public.bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bundle_items (
  bundle_id uuid NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  PRIMARY KEY (bundle_id, product_id)
);
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view bundles" ON public.bundles FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage bundles" ON public.bundles FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Anyone view bundle items" ON public.bundle_items FOR SELECT USING (true);
CREATE POLICY "Admins manage bundle items" ON public.bundle_items FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 5) Daily Pick override manual
CREATE TABLE IF NOT EXISTS public.daily_pick_overrides (
  pick_date date PRIMARY KEY,
  product_id uuid NOT NULL,
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_pick_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view daily pick" ON public.daily_pick_overrides FOR SELECT USING (true);
CREATE POLICY "Admins manage daily pick" ON public.daily_pick_overrides FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 6) game_suggestions: garantir que aceitar com motivo funciona (admin_notes já existe)
-- Atualiza a notificação para incluir o motivo no aprovar:
CREATE OR REPLACE FUNCTION public.notify_game_suggestion_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.requested_by, 'nova_mensagem', '🎮 Sua sugestão foi aprovada!',
            COALESCE(NEW.admin_notes, format('"%s" foi adicionado ao catálogo.', NEW.title)),
            'game_suggestion', NEW.id);
  ELSIF NEW.status = 'rejeitado' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.requested_by, 'nova_mensagem', 'Sugestão de jogo não aprovada',
            COALESCE(NEW.admin_notes, format('"%s" não foi aprovada pela equipe.', NEW.title)),
            'game_suggestion', NEW.id);
  END IF;
  RETURN NEW;
END;$$;
