
-- 1. Add missing columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS stock_alert_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS proposer_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS seller_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.denuncias ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.denuncias ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.pedidos ALTER COLUMN user_id DROP NOT NULL;

-- 2. Restructure certificados
ALTER TABLE public.certificados DROP COLUMN IF EXISTS serial_key;
ALTER TABLE public.certificados DROP COLUMN IF EXISTS order_id;
ALTER TABLE public.certificados DROP COLUMN IF EXISTS activated_at;
ALTER TABLE public.certificados ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.certificados ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.certificados ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.certificados ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.certificados ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Remove default BEFORE dropping enum
ALTER TABLE public.certificados ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.certificados ALTER COLUMN status TYPE TEXT USING status::TEXT;
UPDATE public.certificados SET status = 'pendente' WHERE status = 'pending';
UPDATE public.certificados SET status = 'ativo' WHERE status = 'active';
UPDATE public.certificados SET status = 'expirado' WHERE status = 'expired';
UPDATE public.certificados SET status = 'revogado' WHERE status = 'revoked';
UPDATE public.certificados SET status = 'recusado' WHERE status = 'used';
DROP TYPE IF EXISTS public.certificate_status;
CREATE TYPE public.certificate_status AS ENUM ('pendente', 'ativo', 'recusado', 'revogado', 'expirado');
ALTER TABLE public.certificados ALTER COLUMN status TYPE certificate_status USING status::certificate_status;
ALTER TABLE public.certificados ALTER COLUMN status SET DEFAULT 'pendente'::certificate_status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificados_user_ativo
  ON public.certificados (user_id) WHERE status = 'ativo';

-- 3. Restructure notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_id UUID;
UPDATE public.notifications SET body = message WHERE body IS NULL AND message IS NOT NULL;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS message;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS link;

ALTER TABLE public.notifications ALTER COLUMN type DROP DEFAULT;
ALTER TABLE public.notifications ALTER COLUMN type TYPE TEXT USING type::TEXT;
UPDATE public.notifications SET type = 'nova_mensagem' WHERE type = 'message';
UPDATE public.notifications SET type = 'comentario_review' WHERE type = 'review';
UPDATE public.notifications SET type = 'proposta_aceita' WHERE type = 'proposal';
UPDATE public.notifications SET type = 'certificado_aprovado' WHERE type = 'certificate';
UPDATE public.notifications SET type = 'nova_mensagem' WHERE type = 'system';
UPDATE public.notifications SET type = 'nova_mensagem' WHERE type NOT IN ('nova_mensagem','proposta_aceita','proposta_recusada','comentario_review','certificado_aprovado','certificado_recusado','certificado_revogado');
DROP TYPE IF EXISTS public.notification_type;
CREATE TYPE public.notification_type AS ENUM (
  'nova_mensagem','proposta_aceita','proposta_recusada',
  'comentario_review','certificado_aprovado','certificado_recusado','certificado_revogado'
);
ALTER TABLE public.notifications ALTER COLUMN type TYPE notification_type USING type::notification_type;
ALTER TABLE public.notifications ALTER COLUMN type SET DEFAULT 'nova_mensagem'::notification_type;

-- 4. Restructure movimentacoes_estoque
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS quantity_before INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS quantity_after INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.movimentacoes_estoque DROP COLUMN IF EXISTS reason;
ALTER TABLE public.movimentacoes_estoque DROP COLUMN IF EXISTS created_by;

-- 5. Create cupon_usos
CREATE TABLE IF NOT EXISTS public.cupon_usos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);
ALTER TABLE public.cupon_usos ENABLE ROW LEVEL SECURITY;

-- 6. New functions
CREATE OR REPLACE FUNCTION public.is_atendente()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'atendente')
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR public.is_atendente()
$$;

CREATE OR REPLACE FUNCTION public.has_active_certificate(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.certificados
    WHERE user_id = _user_id AND status = 'ativo' AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.recalculate_product_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_product_id UUID;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.produtos SET rating = (
    SELECT COALESCE(AVG(rating)::numeric(3,1), 0) FROM public.avaliacoes
    WHERE product_id = target_product_id AND is_approved = true
  ) WHERE id = target_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.on_order_cancelled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item RECORD; stock_before INTEGER; stock_after INTEGER;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('confirmed','processing','shipped') THEN
    FOR item IN SELECT product_id, quantity FROM public.itens_pedido WHERE order_id = NEW.id LOOP
      SELECT stock INTO stock_before FROM public.produtos WHERE id = item.product_id;
      stock_after := stock_before + item.quantity;
      UPDATE public.produtos SET stock = stock_after WHERE id = item.product_id;
      INSERT INTO public.movimentacoes_estoque (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
      VALUES (item.product_id, 'entrada', item.quantity, stock_before, stock_after, 'pedido', NEW.id, 'Reposição por cancelamento do pedido');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_coupon_uses()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.cupons SET uses_count = uses_count + 1 WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$;

-- 7. Update existing functions
CREATE OR REPLACE FUNCTION public.on_order_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item RECORD; stock_before INTEGER; stock_after INTEGER;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    FOR item IN SELECT product_id, quantity FROM public.itens_pedido WHERE order_id = NEW.id LOOP
      SELECT stock INTO stock_before FROM public.produtos WHERE id = item.product_id;
      stock_after := GREATEST(0, stock_before - item.quantity);
      UPDATE public.produtos SET stock = stock_after WHERE id = item.product_id;
      INSERT INTO public.movimentacoes_estoque (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id)
      VALUES (item.product_id, 'saida', item.quantity, stock_before, stock_after, 'pedido', NEW.id);
      INSERT INTO public.biblioteca_usuario (user_id, product_id, status)
      VALUES (NEW.user_id, item.product_id, 'quero_jogar') ON CONFLICT (user_id, product_id) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_public_profile_for_sellers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.profiles SET is_private = false WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
  VALUES (NEW.receiver_id, 'nova_mensagem', 'Nova mensagem', substring(NEW.content FROM 1 FOR 120), 'mensagem', NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_review_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE review_author UUID;
BEGIN
  SELECT user_id INTO review_author FROM public.avaliacoes WHERE id = NEW.review_id;
  IF review_author IS NOT NULL AND review_author != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, reference_type, reference_id)
    VALUES (review_author, 'comentario_review', 'Alguém comentou na sua review', 'review_comment', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_proposal_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, reference_type, reference_id)
    VALUES (NEW.proposer_id, 'proposta_aceita', 'Sua proposta de troca foi aceita!', 'proposta', NEW.id);
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, reference_type, reference_id)
    VALUES (NEW.proposer_id, 'proposta_recusada', 'Sua proposta de troca foi recusada', 'proposta', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_certificate_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativo' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, reference_type, reference_id)
    VALUES (NEW.user_id, 'certificado_aprovado', 'Seu certificado de vendedor foi aprovado!', 'certificado', NEW.id);
  ELSIF NEW.status = 'recusado' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.user_id, 'certificado_recusado', 'Certificado não aprovado', NEW.reason, 'certificado', NEW.id);
  ELSIF NEW.status = 'revogado' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.user_id, 'certificado_revogado', 'Certificado revogado', NEW.reason, 'certificado', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.record_stock_movement() CASCADE;

-- 8. Triggers
DROP TRIGGER IF EXISTS on_order_status_change ON public.pedidos;
DROP TRIGGER IF EXISTS on_order_cancelled ON public.pedidos;
DROP TRIGGER IF EXISTS on_anuncio_active ON public.anuncios;
DROP TRIGGER IF EXISTS on_new_message ON public.mensagens;
DROP TRIGGER IF EXISTS on_new_review_comment ON public.review_comments;
DROP TRIGGER IF EXISTS on_proposal_status_change ON public.trade_proposals;
DROP TRIGGER IF EXISTS on_certificate_status_change ON public.certificados;
DROP TRIGGER IF EXISTS on_avaliacao_change ON public.avaliacoes;
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON public.device_tokens;
DROP TRIGGER IF EXISTS on_cupon_used ON public.cupon_usos;
DROP TRIGGER IF EXISTS update_fornecedores_updated_at ON public.fornecedores;
DROP TRIGGER IF EXISTS update_certificados_updated_at ON public.certificados;

CREATE TRIGGER on_order_status_change AFTER UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.on_order_confirmed();
CREATE TRIGGER on_order_cancelled AFTER UPDATE OF status ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.on_order_cancelled();
CREATE TRIGGER on_anuncio_active AFTER INSERT OR UPDATE OF status ON public.anuncios FOR EACH ROW EXECUTE FUNCTION public.enforce_public_profile_for_sellers();
CREATE TRIGGER on_new_message AFTER INSERT ON public.mensagens FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
CREATE TRIGGER on_new_review_comment AFTER INSERT ON public.review_comments FOR EACH ROW EXECUTE FUNCTION public.notify_review_comment();
CREATE TRIGGER on_proposal_status_change AFTER UPDATE OF status ON public.trade_proposals FOR EACH ROW EXECUTE FUNCTION public.notify_proposal_update();
CREATE TRIGGER on_certificate_status_change AFTER UPDATE OF status ON public.certificados FOR EACH ROW EXECUTE FUNCTION public.notify_certificate_update();
CREATE TRIGGER on_avaliacao_change AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.recalculate_product_rating();
CREATE TRIGGER update_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER on_cupon_used AFTER INSERT ON public.cupon_usos FOR EACH ROW EXECUTE FUNCTION public.increment_coupon_uses();
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_certificados_updated_at BEFORE UPDATE ON public.certificados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 9. RLS policies
CREATE POLICY "Usuário vê os próprios usos de cupom" ON public.cupon_usos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff vê todos os usos de cupom" ON public.cupon_usos FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Sistema registra uso de cupom" ON public.cupon_usos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin gerencia usos de cupom" ON public.cupon_usos FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Biblioteca pública visível para todos" ON public.biblioteca_usuario;
CREATE POLICY "Biblioteca pública visível para todos" ON public.biblioteca_usuario FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = biblioteca_usuario.user_id AND profiles.is_private = false));

DROP POLICY IF EXISTS "Staff vê todos os produtos" ON public.produtos;
CREATE POLICY "Staff vê todos os produtos" ON public.produtos FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Atendente insere produtos" ON public.produtos;
CREATE POLICY "Atendente insere produtos" ON public.produtos FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Atendente atualiza produtos" ON public.produtos;
CREATE POLICY "Atendente atualiza produtos" ON public.produtos FOR UPDATE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff gerencia todos os pedidos" ON public.pedidos;
CREATE POLICY "Staff gerencia todos os pedidos" ON public.pedidos FOR ALL TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff gerencia itens de pedido" ON public.itens_pedido;
CREATE POLICY "Staff gerencia itens de pedido" ON public.itens_pedido FOR ALL TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Authenticated can view active suppliers" ON public.fornecedores;
DROP POLICY IF EXISTS "Staff vê fornecedores" ON public.fornecedores;
CREATE POLICY "Staff vê fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can manage stock movements" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "Staff vê movimentações de estoque" ON public.movimentacoes_estoque;
CREATE POLICY "Staff vê movimentações de estoque" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admin insere movimentação manual" ON public.movimentacoes_estoque FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff gerencia categorias" ON public.categorias;
CREATE POLICY "Staff gerencia categorias" ON public.categorias FOR ALL TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Usuário solicita certificado" ON public.certificados;
CREATE POLICY "Usuário solicita certificado" ON public.certificados FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_produtos_title_search ON public.produtos USING gin (to_tsvector('portuguese', title));
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_search ON public.profiles USING gin (to_tsvector('portuguese', coalesce(display_name, '')));
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- 11. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
