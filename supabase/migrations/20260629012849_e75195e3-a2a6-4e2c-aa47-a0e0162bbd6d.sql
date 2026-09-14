
-- FASE 1 (chat): reply_to + reactions
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.mensagens(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reactions visible to message participants" ON public.message_reactions;
CREATE POLICY "Reactions visible to message participants"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mensagens m
      WHERE m.id = message_reactions.message_id
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid()
             OR (m.group_id IS NOT NULL AND public.is_group_member(m.group_id, auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Users manage own reactions" ON public.message_reactions;
CREATE POLICY "Users manage own reactions"
  ON public.message_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- FASE 2 (marketplace): expires_at em anuncios + vacation mode em seller_profiles
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_anuncios_expires_at ON public.anuncios(expires_at) WHERE status = 'active';

ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS vacation_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacation_message text;

-- Default 60 dias se vendedor não informar
CREATE OR REPLACE FUNCTION public.set_anuncio_default_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '60 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anuncio_default_expiration ON public.anuncios;
CREATE TRIGGER trg_anuncio_default_expiration
  BEFORE INSERT ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.set_anuncio_default_expiration();
