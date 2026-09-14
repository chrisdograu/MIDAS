CREATE TABLE IF NOT EXISTS public.produto_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_produto_imagens_product ON public.produto_imagens(product_id, position);
ALTER TABLE public.produto_imagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view produto_imagens" ON public.produto_imagens FOR SELECT USING (true);
CREATE POLICY "Admins manage produto_imagens" ON public.produto_imagens FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.daily_pick_overrides ADD COLUMN IF NOT EXISTS reason text;