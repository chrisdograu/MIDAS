
-- Marketplace tables
CREATE TABLE public.anuncios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  game_title text NOT NULL,
  platform text NOT NULL,
  condition text NOT NULL DEFAULT 'novo',
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fotos_anuncio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  anuncio_id uuid REFERENCES public.anuncios(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.avaliacoes_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  reviewed_id uuid NOT NULL,
  anuncio_id uuid REFERENCES public.anuncios(id) ON DELETE SET NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Storage bucket for images
-- (handled via Supabase dashboard/API)

-- RLS for anuncios
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active ads" ON public.anuncios
  FOR SELECT TO public USING (status = 'active');

CREATE POLICY "Authenticated can view own ads" ON public.anuncios
  FOR SELECT TO authenticated USING (auth.uid() = seller_id);

CREATE POLICY "Users can create ads" ON public.anuncios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own ads" ON public.anuncios
  FOR UPDATE TO authenticated USING (auth.uid() = seller_id);

CREATE POLICY "Users can delete own ads" ON public.anuncios
  FOR DELETE TO authenticated USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage ads" ON public.anuncios
  FOR ALL TO authenticated USING (is_admin());

-- RLS for fotos_anuncio
ALTER TABLE public.fotos_anuncio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ad photos" ON public.fotos_anuncio
  FOR SELECT TO public USING (true);

CREATE POLICY "Ad owners can manage photos" ON public.fotos_anuncio
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.anuncios WHERE id = fotos_anuncio.anuncio_id AND seller_id = auth.uid())
  );

-- RLS for mensagens
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.mensagens
  FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.mensagens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own received messages" ON public.mensagens
  FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

CREATE POLICY "Admins can manage messages" ON public.mensagens
  FOR ALL TO authenticated USING (is_admin());

-- RLS for avaliacoes_usuario
ALTER TABLE public.avaliacoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user reviews" ON public.avaliacoes_usuario
  FOR SELECT TO public USING (true);

CREATE POLICY "Users can create user reviews" ON public.avaliacoes_usuario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can update own user reviews" ON public.avaliacoes_usuario
  FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins can manage user reviews" ON public.avaliacoes_usuario
  FOR ALL TO authenticated USING (is_admin());

-- Enable realtime for mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;

-- Trigger for updated_at on anuncios
CREATE TRIGGER update_anuncios_updated_at
  BEFORE UPDATE ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
