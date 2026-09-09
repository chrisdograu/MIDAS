
-- 40) Estender is_user_banned() a avaliacoes e pedidos
DROP POLICY IF EXISTS "Users can create reviews" ON public.avaliacoes;
CREATE POLICY "Users can create reviews"
  ON public.avaliacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can create own orders" ON public.pedidos;
CREATE POLICY "Users can create own orders"
  ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- 46) Bloqueio bidirecional para mensagens diretas e follow_requests
DROP POLICY IF EXISTS "Users can send messages" ON public.mensagens;
CREATE POLICY "Users can send messages"
  ON public.mensagens FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_user_banned(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE blocker_id = mensagens.receiver_id AND blocked_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "create own follow requests" ON public.follow_requests;
CREATE POLICY "create own follow requests"
  ON public.follow_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE blocker_id = follow_requests.target_id AND blocked_id = auth.uid()
    )
  );

-- 53) admin_grant fora da trava diária única
DROP INDEX IF EXISTS public.user_xp_log_daily_unique;
CREATE UNIQUE INDEX user_xp_log_daily_unique
  ON public.user_xp_log(user_id, action, awarded_date)
  WHERE action NOT IN (
    'purchase','trade','tournament_win',
    'referral_invite','referral_join',
    'review','forum_post','forum_reply',
    'admin_grant'
  );

-- 52) Leitura auditada de biblioteca (RPC)
CREATE OR REPLACE FUNCTION public.read_user_library_admin(_target uuid, _reason text)
RETURNS SETOF public.biblioteca_usuario
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 6 THEN
    RAISE EXCEPTION 'justificativa obrigatória (mínimo 6 caracteres)';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'admin_view_library',
    'profile',
    _target,
    jsonb_build_object('reason', _reason)
  );

  RETURN QUERY
    SELECT * FROM public.biblioteca_usuario WHERE user_id = _target;
END; $$;

REVOKE ALL ON FUNCTION public.read_user_library_admin(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.read_user_library_admin(uuid, text) TO authenticated;
