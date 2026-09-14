
-- 1. Review comments table
CREATE TABLE public.review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view review comments" ON public.review_comments FOR SELECT TO public USING (true);
CREATE POLICY "Users can create comments" ON public.review_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.review_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage comments" ON public.review_comments FOR ALL TO authenticated USING (public.is_admin());

-- 2. Review likes table
CREATE TABLE public.review_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view likes" ON public.review_likes FOR SELECT TO public USING (true);
CREATE POLICY "Users can like" ON public.review_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.review_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Update avaliacoes default to auto-approve
ALTER TABLE public.avaliacoes ALTER COLUMN is_approved SET DEFAULT true;

-- 4. Enhance anuncios with marketplace fields
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS ad_type text NOT NULL DEFAULT 'venda';
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'jogo_digital';
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS certificate_type text NOT NULL DEFAULT 'sem_certificado';
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS desired_item text;

-- 5. Trade proposals table
CREATE TABLE public.trade_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  proposer_id uuid NOT NULL,
  offered_item text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view related proposals" ON public.trade_proposals FOR SELECT TO authenticated
  USING (auth.uid() = proposer_id OR EXISTS (SELECT 1 FROM public.anuncios WHERE id = trade_proposals.anuncio_id AND seller_id = auth.uid()));
CREATE POLICY "Users can create proposals" ON public.trade_proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = proposer_id);
CREATE POLICY "Participants can update proposals" ON public.trade_proposals FOR UPDATE TO authenticated
  USING (auth.uid() = proposer_id OR EXISTS (SELECT 1 FROM public.anuncios WHERE id = trade_proposals.anuncio_id AND seller_id = auth.uid()));
CREATE POLICY "Admins can manage proposals" ON public.trade_proposals FOR ALL TO authenticated USING (public.is_admin());

-- 6. Reports/denuncias table
CREATE TABLE public.denuncias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.denuncias FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON public.denuncias FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can manage reports" ON public.denuncias FOR ALL TO authenticated USING (public.is_admin());

-- 7. Allow public profile viewing (for community features)
CREATE POLICY "Anyone can view profiles publicly" ON public.profiles FOR SELECT TO public USING (true);

-- 8. Allow users to delete own library items (for manual management)
CREATE POLICY "Users can delete own library items" ON public.biblioteca_usuario FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 9. Unique constraint on biblioteca
ALTER TABLE public.biblioteca_usuario ADD CONSTRAINT biblioteca_usuario_user_product_unique UNIQUE (user_id, product_id);
