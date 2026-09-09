
-- 1. Add stock column to produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 100;

-- 2. Create biblioteca_usuario table
CREATE TABLE public.biblioteca_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'quero_jogar',
  acquired_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.biblioteca_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own library" ON public.biblioteca_usuario
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own library" ON public.biblioteca_usuario
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System can insert library items" ON public.biblioteca_usuario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage library" ON public.biblioteca_usuario
  FOR ALL TO authenticated USING (is_admin());

-- 3. Function to handle order confirmation: reduce stock + add to library
CREATE OR REPLACE FUNCTION public.on_order_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    FOR item IN SELECT product_id, quantity FROM public.itens_pedido WHERE order_id = NEW.id
    LOOP
      -- Reduce stock
      UPDATE public.produtos SET stock = GREATEST(0, stock - item.quantity) WHERE id = item.product_id;
      -- Add to user library
      INSERT INTO public.biblioteca_usuario (user_id, product_id, status)
      VALUES (NEW.user_id, item.product_id, 'quero_jogar')
      ON CONFLICT (user_id, product_id) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_confirmed
  AFTER INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.on_order_confirmed();

-- 4. Function to get average rating for a product
CREATE OR REPLACE FUNCTION public.get_product_avg_rating(p_product_id uuid)
RETURNS TABLE(avg_rating numeric, total_reviews bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(AVG(rating)::numeric(3,1), 0) AS avg_rating, COUNT(*) AS total_reviews
  FROM public.avaliacoes
  WHERE product_id = p_product_id;
$$;

-- 5. Add unique constraint to avaliacoes (one review per user per product)
ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_user_product_unique UNIQUE (user_id, product_id);

-- 6. Enable realtime for biblioteca
ALTER PUBLICATION supabase_realtime ADD TABLE public.biblioteca_usuario;
