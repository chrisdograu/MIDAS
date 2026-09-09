-- 1. Refund status + table
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';

CREATE TABLE IF NOT EXISTS public.reembolsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  valor numeric(10,2) NOT NULL CHECK (valor >= 0),
  motivo text NOT NULL,
  processado_por uuid NOT NULL,
  processado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reembolsos TO authenticated;
GRANT ALL ON public.reembolsos TO service_role;

ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff ve reembolsos" ON public.reembolsos
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Cliente ve seus reembolsos" ON public.reembolsos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = reembolsos.pedido_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reembolsos_pedido ON public.reembolsos(pedido_id);

CREATE OR REPLACE FUNCTION public.admin_refund_order(_pedido_id uuid, _valor numeric, _motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total numeric;
  _status order_status;
  _id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Sem permissão para reembolsar pedidos';
  END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo do reembolso é obrigatório (mínimo 5 caracteres)';
  END IF;

  SELECT total, status INTO _total, _status FROM public.pedidos WHERE id = _pedido_id FOR UPDATE;
  IF _total IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF _status = 'refunded'::order_status THEN
    RAISE EXCEPTION 'Pedido já está reembolsado';
  END IF;
  IF _status = 'cancelled'::order_status THEN
    RAISE EXCEPTION 'Pedido cancelado não pode ser reembolsado';
  END IF;
  IF _valor IS NULL OR _valor <= 0 OR _valor > _total THEN
    RAISE EXCEPTION 'Valor de reembolso inválido (máximo %)', _total;
  END IF;

  INSERT INTO public.reembolsos (pedido_id, valor, motivo, processado_por)
  VALUES (_pedido_id, _valor, trim(_motivo), auth.uid())
  RETURNING id INTO _id;

  UPDATE public.pedidos SET status = 'refunded'::order_status, updated_at = now() WHERE id = _pedido_id;

  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (auth.uid(), 'refund_order', 'pedidos', _pedido_id, trim(_motivo),
          jsonb_build_object('valor', _valor, 'total', _total, 'status_anterior', _status));

  RETURN _id;
END;
$$;

-- 2. Group moderation
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid;

CREATE POLICY "Staff ve todos os grupos" ON public.groups
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.admin_set_group_disabled(_group_id uuid, _disabled boolean, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_moderador()) THEN
    RAISE EXCEPTION 'Sem permissão para moderar grupos';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 5 caracteres)';
  END IF;

  UPDATE public.groups
     SET is_disabled = _disabled,
         disabled_reason = CASE WHEN _disabled THEN trim(_reason) ELSE NULL END,
         disabled_at = CASE WHEN _disabled THEN now() ELSE NULL END,
         disabled_by = CASE WHEN _disabled THEN auth.uid() ELSE NULL END,
         updated_at = now()
   WHERE id = _group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (auth.uid(), CASE WHEN _disabled THEN 'disable_group' ELSE 'enable_group' END,
          'groups', _group_id, trim(_reason), jsonb_build_object('is_disabled', _disabled));
END;
$$;

-- 3. Audit index by actor
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id, created_at DESC);