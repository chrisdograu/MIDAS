
-- 1. NEW ENUMS
DO $$ BEGIN
  CREATE TYPE public.certificate_status AS ENUM ('pending', 'active', 'used', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('entrada', 'saida', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('message', 'review', 'order', 'proposal', 'certificate', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.product_type AS ENUM ('digital', 'physical', 'subscription');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendente';

-- 2. NEW TABLES

CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage suppliers" ON public.fornecedores FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Authenticated can view active suppliers" ON public.fornecedores FOR SELECT TO authenticated USING (is_active = true);
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.certificados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  serial_key TEXT NOT NULL,
  status public.certificate_status NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own certificates" ON public.certificados FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage certificates" ON public.certificados FOR ALL TO authenticated USING (is_admin());
CREATE TRIGGER update_certificados_updated_at BEFORE UPDATE ON public.certificados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL TO authenticated USING (is_admin());

CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage stock movements" ON public.movimentacoes_estoque FOR ALL TO authenticated USING (is_admin());

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tokens" ON public.device_tokens FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. ALTER EXISTING TABLES

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf TEXT;

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS product_type public.product_type NOT NULL DEFAULT 'digital';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS employee_id UUID;

-- 4. TRIGGERS / FUNCTIONS

CREATE OR REPLACE FUNCTION public.enforce_public_profile_for_sellers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_private = true AND EXISTS (
    SELECT 1 FROM public.anuncios WHERE seller_id = NEW.id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Vendedores com anúncios ativos não podem ter perfil privado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_public_profile_for_sellers ON public.profiles;
CREATE TRIGGER enforce_public_profile_for_sellers
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_public_profile_for_sellers();

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (NEW.receiver_id, 'message', 'Nova mensagem', 'Você recebeu uma nova mensagem', '/mensagens');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_message ON public.mensagens;
CREATE TRIGGER notify_new_message
  AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

CREATE OR REPLACE FUNCTION public.notify_review_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  review_owner UUID;
BEGIN
  SELECT user_id INTO review_owner FROM public.avaliacoes WHERE id = NEW.review_id;
  IF review_owner IS NOT NULL AND review_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (review_owner, 'review', 'Novo comentário', 'Alguém comentou na sua avaliação', NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_review_comment ON public.review_comments;
CREATE TRIGGER notify_review_comment
  AFTER INSERT ON public.review_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_review_comment();

CREATE OR REPLACE FUNCTION public.notify_proposal_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ad_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT seller_id INTO ad_owner FROM public.anuncios WHERE id = NEW.anuncio_id;
    IF ad_owner IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (ad_owner, 'proposal', 'Nova proposta', 'Você recebeu uma proposta de troca', NULL);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.proposer_id, 'proposal', 'Proposta atualizada', 'O status da sua proposta foi alterado para ' || NEW.status, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_proposal_update ON public.trade_proposals;
CREATE TRIGGER notify_proposal_update
  AFTER INSERT OR UPDATE ON public.trade_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_proposal_update();

CREATE OR REPLACE FUNCTION public.notify_certificate_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.user_id, 'certificate', 'Certificado atualizado', 'O status do seu certificado foi alterado para ' || NEW.status::text, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_certificate_update ON public.certificados;
CREATE TRIGGER notify_certificate_update
  AFTER UPDATE ON public.certificados
  FOR EACH ROW EXECUTE FUNCTION public.notify_certificate_update();

CREATE OR REPLACE FUNCTION public.record_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.stock != NEW.stock THEN
    INSERT INTO public.movimentacoes_estoque (product_id, type, quantity, reason, created_by)
    VALUES (
      NEW.id,
      CASE WHEN NEW.stock > OLD.stock THEN 'entrada'::stock_movement_type ELSE 'saida'::stock_movement_type END,
      ABS(NEW.stock - OLD.stock),
      'Atualização automática de estoque',
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_stock_movement ON public.produtos;
CREATE TRIGGER record_stock_movement
  AFTER UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.record_stock_movement();

-- 5. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('ad-images', 'ad-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view ad images" ON storage.objects FOR SELECT USING (bucket_id = 'ad-images');
CREATE POLICY "Authenticated can upload ad images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ad-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own ad images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ad-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own ad images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ad-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
