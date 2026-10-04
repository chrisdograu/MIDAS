CREATE OR REPLACE FUNCTION public.validate_and_use_coupon(_code text, _order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_coupon RECORD;
  v_order_owner uuid;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT user_id INTO v_order_owner
  FROM public.pedidos
  WHERE id = _order_id;

  IF v_order_owner IS NULL OR v_order_owner <> v_uid THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;

  BEGIN
    SELECT public.rate_limit_hit(v_uid::text, 'coupon_redeem', 10, 300) INTO v_allowed;
  EXCEPTION WHEN undefined_function THEN
    v_allowed := true;
  END;
  IF v_allowed = false THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  SELECT * INTO v_coupon
  FROM public.cupons
  WHERE code = upper(_code) AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_not_found'; END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_count >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted';
  END IF;

  INSERT INTO public.cupon_usos (coupon_id, user_id, order_id)
  VALUES (v_coupon.id, v_uid, _order_id);

  RETURN v_coupon.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_order_secure(
  _items jsonb,
  _payment_method text,
  _installments integer,
  _coupon_code text,
  _client_total numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  PERFORM 1 FROM public.produtos
  WHERE id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) i)
  FOR UPDATE;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    v_bid := NULLIF(v_item->>'bundle_id','')::uuid;
    IF v_qty < 1 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

    SELECT price, stock INTO v_price, v_stock FROM public.produtos WHERE id = v_pid;
    IF v_price IS NULL THEN RAISE EXCEPTION 'product_not_found:%', v_pid; END IF;
    IF v_stock < v_qty THEN RAISE EXCEPTION 'insufficient_stock:%', v_pid; END IF;

    IF v_bid IS NULL THEN
      v_subtotal := v_subtotal + (v_price * v_qty);
    END IF;
  END LOOP;

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

  IF _payment_method = 'pix' THEN
    v_pix_discount := ROUND(v_subtotal * 0.05, 2);
  END IF;

  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon
    FROM public.cupons
    WHERE code = upper(trim(_coupon_code)) AND is_active = true
    FOR UPDATE;
    IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'invalid_coupon'; END IF;
    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN RAISE EXCEPTION 'coupon_expired'; END IF;
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_count >= v_coupon.max_uses THEN RAISE EXCEPTION 'coupon_exhausted'; END IF;
    v_coupon_discount := ROUND(v_subtotal * (v_coupon.discount_percent / 100.0), 2);
  END IF;

  v_total := GREATEST(0, v_subtotal - v_pix_discount - v_coupon_discount);
  v_delta := ABS(COALESCE(_client_total, 0) - v_total);
  IF v_delta > 0.01 THEN
    RAISE EXCEPTION 'total_mismatch:server=%,client=%', v_total, _client_total;
  END IF;

  INSERT INTO public.pedidos (
    user_id, subtotal, discount_amount, total, payment_method, installments,
    coupon_code, status
  ) VALUES (
    v_user, v_subtotal, v_pix_discount + v_coupon_discount, v_total,
    _payment_method, GREATEST(1, COALESCE(_installments, 1)),
    CASE WHEN v_coupon.id IS NOT NULL THEN upper(trim(_coupon_code)) ELSE NULL END,
    'confirmed'
  ) RETURNING id INTO v_order_id;

  IF v_coupon.id IS NOT NULL THEN
    PERFORM public.validate_and_use_coupon(_coupon_code, v_order_id);
  END IF;

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
END;
$function$;

DROP POLICY IF EXISTS "Users can update own orders" ON public.pedidos;

REVOKE UPDATE, DELETE ON public.pedidos FROM authenticated;
GRANT UPDATE, DELETE ON public.pedidos TO authenticated;

REVOKE ALL ON FUNCTION public.validate_and_use_coupon(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_and_use_coupon(text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_order_secure(jsonb, text, integer, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_secure(jsonb, text, integer, text, numeric) TO authenticated, service_role;