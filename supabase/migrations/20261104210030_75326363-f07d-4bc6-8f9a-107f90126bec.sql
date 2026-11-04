CREATE OR REPLACE FUNCTION public.on_order_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  item record;
  stock_before integer;
  outstanding integer;
  missing_quantity integer;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' THEN RETURN NEW; END IF;
  END IF;

  FOR item IN
    SELECT product_id, sum(quantity)::integer AS quantity
    FROM public.itens_pedido WHERE order_id = NEW.id GROUP BY product_id ORDER BY product_id
  LOOP
    SELECT stock INTO stock_before FROM public.produtos WHERE id = item.product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found:%', item.product_id; END IF;

    SELECT COALESCE(sum(CASE WHEN type = 'saida' THEN quantity WHEN type = 'entrada' THEN -quantity ELSE 0 END), 0)::integer
      INTO outstanding
      FROM public.movimentacoes_estoque
      WHERE reference_type = 'pedido' AND reference_id = NEW.id AND product_id = item.product_id;
    missing_quantity := GREATEST(0, item.quantity - outstanding);
    IF missing_quantity > 0 THEN
      IF stock_before < missing_quantity THEN RAISE EXCEPTION 'insufficient_stock:%', item.product_id; END IF;
      UPDATE public.produtos SET stock = stock_before - missing_quantity WHERE id = item.product_id;
      INSERT INTO public.movimentacoes_estoque
        (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
      VALUES (item.product_id, 'saida', missing_quantity, stock_before, stock_before - missing_quantity, 'pedido', NEW.id, 'Baixa por confirmação, sem duplicação');
    END IF;
    INSERT INTO public.biblioteca_usuario (user_id, product_id, status)
    VALUES (NEW.user_id, item.product_id, 'quero_jogar') ON CONFLICT (user_id, product_id) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$function$;