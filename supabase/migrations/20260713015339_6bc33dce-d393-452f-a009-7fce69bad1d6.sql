
-- =========================================================================
-- Rodada 2: correções críticas + lacunas do prompt
--   25. RPC create_order_secure (recalcula preço server-side, valida cupom, aplica bundles)
--   26. Baixa de estoque atômica com lock de linha
--   27. Remove trigger antigo com lista de status errada (que bloqueava usuário legítimo)
--   28. Índice único de user_xp_log exclui review/forum_post/forum_reply
--   30. Coluna bundle_id em itens_pedido — bundle validado no servidor
--   37. Histórico de site_settings
-- =========================================================================

-- 27) Remove trigger de posse antigo (a lista de status errada bloqueava usuário
-- legítimo com status 'ja_joguei'). O trigger correto (trg_enforce_review_ownership)
-- continua vigente.
DROP TRIGGER IF EXISTS trg_avaliacoes_require_ownership ON public.avaliacoes;
DROP FUNCTION IF EXISTS public.avaliacoes_require_ownership();

-- 28) Índice único de XP diário: adiciona review/forum_post/forum_reply à lista
-- de exceções (já continha purchase/trade/tournament_win e as duas de referral).
DROP INDEX IF EXISTS public.user_xp_log_daily_unique;
CREATE UNIQUE INDEX user_xp_log_daily_unique
  ON public.user_xp_log(user_id, action, awarded_date)
  WHERE action NOT IN (
    'purchase','trade','tournament_win',
    'referral_invite','referral_join',
    'review','forum_post','forum_reply'
  );

-- 30) Bundle atômico no pedido
ALTER TABLE public.itens_pedido
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.bundles(id) ON DELETE SET NULL;

-- 37) Histórico de site_settings
CREATE TABLE IF NOT EXISTS public.site_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings_history TO authenticated;
GRANT ALL ON public.site_settings_history TO service_role;
ALTER TABLE public.site_settings_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins veem histórico" ON public.site_settings_history;
CREATE POLICY "Admins veem histórico"
  ON public.site_settings_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.site_settings_log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO public.site_settings_history (setting_key, old_value, new_value, changed_by)
    VALUES (OLD.key, OLD.value, NEW.value, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.site_settings_history (setting_key, old_value, new_value, changed_by)
    VALUES (NEW.key, NULL, NEW.value, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_site_settings_history ON public.site_settings;
CREATE TRIGGER trg_site_settings_history
  AFTER INSERT OR UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.site_settings_log_change();

-- 25+26+30) RPC atômica de criação de pedido
CREATE OR REPLACE FUNCTION public.create_order_secure(
  _items jsonb,          -- [{product_id, quantity, bundle_id?}]
  _payment_method text,
  _installments int,
  _coupon_code text,
  _client_total numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_pid uuid;
  v_qty int;
  v_bid uuid;
  v_price numeric;
  v_stock int;
  v_subtotal numeric := 0;
  v_bundle_price numeric;
  v_bundle_expected_count int;
  v_bundle_present_count int;
  v_bundle record;
  v_pix_discount numeric := 0;
  v_coupon_discount numeric := 0;
  v_coupon record;
  v_total numeric;
  v_order_id uuid;
  v_delta numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  -- 1) Trava linhas dos produtos envolvidos (evita oversell em concorrência)
  PERFORM 1 FROM public.produtos
    WHERE id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) i)
    FOR UPDATE;

  -- 2) Percorre itens, valida estoque, soma subtotal usando preço do servidor
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    v_bid := NULLIF(v_item->>'bundle_id','')::uuid;
    IF v_qty < 1 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

    SELECT price, stock INTO v_price, v_stock FROM public.produtos WHERE id = v_pid;
    IF v_price IS NULL THEN RAISE EXCEPTION 'product_not_found:%', v_pid; END IF;
    IF v_stock < v_qty THEN RAISE EXCEPTION 'insufficient_stock:%', v_pid; END IF;

    -- Preço avulso; para bundles somamos depois
    IF v_bid IS NULL THEN
      v_subtotal := v_subtotal + (v_price * v_qty);
    END IF;
  END LOOP;

  -- 3) Bundles: valida grupo completo, usa bundle.price em vez do somatório
  FOR v_bundle IN
    SELECT DISTINCT NULLIF(i->>'bundle_id','')::uuid AS bid
    FROM jsonb_array_elements(_items) i
    WHERE NULLIF(i->>'bundle_id','') IS NOT NULL
  LOOP
    SELECT price INTO v_bundle_price FROM public.bundles WHERE id = v_bundle.bid AND is_active = true;
    IF v_bundle_price IS NULL THEN RAISE EXCEPTION 'bundle_not_found:%', v_bundle.bid; END IF;

    SELECT COUNT(*) INTO v_bundle_expected_count FROM public.bundle_items WHERE bundle_id = v_bundle.bid;

    SELECT COUNT(*) INTO v_bundle_present_count
    FROM public.bundle_items bi
    WHERE bi.bundle_id = v_bundle.bid
      AND bi.product_id IN (
        SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) i
        WHERE NULLIF(i->>'bundle_id','')::uuid = v_bundle.bid
      );

    IF v_bundle_present_count <> v_bundle_expected_count THEN
      RAISE EXCEPTION 'bundle_incomplete:%', v_bundle.bid;
    END IF;

    v_subtotal := v_subtotal + v_bundle_price;
  END LOOP;

  -- 4) Descontos: Pix 5% + cupom (com lock via validate_and_use_coupon)
  IF _payment_method = 'pix' THEN
    v_pix_discount := ROUND(v_subtotal * 0.05, 2);
  END IF;

  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    SELECT * INTO v_coupon FROM public.cupons WHERE code = _coupon_code AND is_active = true;
    IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'invalid_coupon'; END IF;
    -- lock + insere uso; erro propagado se já usado / limite / expirado
    PERFORM public.validate_and_use_coupon(_coupon_code, v_user);
    v_coupon_discount := ROUND(v_subtotal * (v_coupon.discount_percent / 100.0), 2);
  END IF;

  v_total := GREATEST(0, v_subtotal - v_pix_discount - v_coupon_discount);

  -- 5) Valida total enviado pelo cliente (tolerância 1 centavo)
  v_delta := ABS(COALESCE(_client_total,0) - v_total);
  IF v_delta > 0.01 THEN
    RAISE EXCEPTION 'total_mismatch:server=%,client=%', v_total, _client_total;
  END IF;

  -- 6) Cria pedido em 'pending' (evita disparar on_order_confirmed que também
  -- decrementa estoque — vamos fazer manual aqui dentro da transação).
  INSERT INTO public.pedidos (
    user_id, subtotal, discount_amount, total, payment_method, installments,
    coupon_code, status
  ) VALUES (
    v_user, v_subtotal, v_pix_discount + v_coupon_discount, v_total,
    _payment_method, GREATEST(1, COALESCE(_installments,1)),
    _coupon_code, 'confirmed'
  ) RETURNING id INTO v_order_id;

  -- 7) Itens + baixa de estoque + biblioteca
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    v_bid := NULLIF(v_item->>'bundle_id','')::uuid;
    SELECT price, stock INTO v_price, v_stock FROM public.produtos WHERE id = v_pid;

    INSERT INTO public.itens_pedido (order_id, product_id, quantity, price_at_purchase, bundle_id)
    VALUES (v_order_id, v_pid, v_qty, v_price, v_bid);

    UPDATE public.produtos SET stock = stock - v_qty WHERE id = v_pid;

    INSERT INTO public.movimentacoes_estoque (
      product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes
    ) VALUES (
      v_pid, 'saida', v_qty, v_stock, v_stock - v_qty, 'pedido', v_order_id,
      'Baixa por venda (create_order_secure)'
    );

    INSERT INTO public.biblioteca_usuario (user_id, product_id, status)
    VALUES (v_user, v_pid, 'quero_jogar')
    ON CONFLICT (user_id, product_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_subtotal,
    'discount_amount', v_pix_discount + v_coupon_discount,
    'total', v_total
  );
END; $$;

REVOKE ALL ON FUNCTION public.create_order_secure(jsonb, text, int, text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.create_order_secure(jsonb, text, int, text, numeric) TO authenticated;

-- Evita duplicar baixa: on_order_confirmed atual dispara em AFTER UPDATE quando
-- status muda para 'confirmed'. Como criamos o pedido já 'confirmed', ele não
-- dispara. Só precisamos garantir que o cancelamento continue funcionando
-- (on_order_cancelled) — mantido intacto.
