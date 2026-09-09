-- 1) Conversas: status para pedidos de chat
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';

-- 2) Mensagens: tipos e payload
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS image_url text;

-- 3) Anuncios: aceita contraoferta
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS accepts_counteroffer boolean NOT NULL DEFAULT false;

-- 4) Bucket chat-images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5) Policies do bucket chat-images
DROP POLICY IF EXISTS "Chat images publicly readable" ON storage.objects;
CREATE POLICY "Chat images publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "Authenticated can upload chat images" ON storage.objects;
CREATE POLICY "Authenticated can upload chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owner can delete chat images" ON storage.objects;
CREATE POLICY "Owner can delete chat images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 6) Habilitar realtime apenas em tabelas ainda não publicadas
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mensagens','conversas','forum_posts','forum_replies','notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;