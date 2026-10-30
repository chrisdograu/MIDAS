ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS custom_rules text;
CREATE INDEX IF NOT EXISTS tournaments_product_id_idx ON public.tournaments(product_id);