-- Função para checar se um usuário está banido
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND banned_until IS NOT NULL
      AND banned_until > now()
  )
$$;

-- Bloquear criação de anúncios para banidos
DROP POLICY IF EXISTS "Users can create ads" ON public.anuncios;
CREATE POLICY "Users can create ads"
ON public.anuncios FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = seller_id AND NOT public.is_user_banned(auth.uid()));

-- Bloquear posts no fórum
DROP POLICY IF EXISTS "Users can create forum posts" ON public.forum_posts;
CREATE POLICY "Users can create forum posts"
ON public.forum_posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- Bloquear respostas no fórum
DROP POLICY IF EXISTS "Users can create forum replies" ON public.forum_replies;
CREATE POLICY "Users can create forum replies"
ON public.forum_replies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- Bloquear envio de mensagens
DROP POLICY IF EXISTS "Users can send messages" ON public.mensagens;
CREATE POLICY "Users can send messages"
ON public.mensagens FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id AND NOT public.is_user_banned(auth.uid()));