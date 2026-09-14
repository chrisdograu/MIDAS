
CREATE TABLE IF NOT EXISTS public.favoritos_anuncio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anuncio_id uuid NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, anuncio_id)
);
CREATE INDEX IF NOT EXISTS idx_fav_anuncio_user ON public.favoritos_anuncio(user_id);
ALTER TABLE public.favoritos_anuncio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own ad favorites" ON public.favoritos_anuncio
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own ad favorites" ON public.favoritos_anuncio
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own ad favorites" ON public.favoritos_anuncio
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
