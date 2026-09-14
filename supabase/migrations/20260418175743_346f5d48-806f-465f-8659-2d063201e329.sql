-- Tabela de configurações globais da loja (singleton por chave)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete site settings"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed inicial das chaves de configuração
INSERT INTO public.site_settings (key, value) VALUES
  ('store_info', '{"name":"MIDIAS","email":"contato@midias.com","phone":"(11) 99999-0000","address":"São Paulo, SP"}'::jsonb),
  ('sale_policies', '{"pix_discount_percent":5,"max_installments":12,"min_order_value":0,"free_shipping_threshold":0}'::jsonb),
  ('email_notifications', '{"new_order":true,"order_status_change":true,"low_stock":true,"new_user":false}'::jsonb),
  ('marketplace', '{"allow_trades":true,"require_certificate":false,"max_ads_per_user":50}'::jsonb),
  ('security', '{"min_password_length":6,"require_email_confirmation":false,"session_timeout_minutes":1440}'::jsonb);

-- Coluna para banimento temporário de usuários
ALTER TABLE public.profiles
  ADD COLUMN banned_until timestamptz;

CREATE INDEX idx_profiles_banned_until ON public.profiles(banned_until) WHERE banned_until IS NOT NULL;