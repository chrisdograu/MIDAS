-- ============ 1) Helpers de cargo ============
CREATE OR REPLACE FUNCTION public.is_admin_pleno()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND (ur.position IS NULL OR ur.position::text = 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_direcao()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_pleno() OR public.has_position(ARRAY['admin','gerente']);
$$;

CREATE OR REPLACE FUNCTION public.is_moderador()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_direcao() OR public.has_position(ARRAY['moderador']);
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_pleno() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_direcao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderador() TO authenticated;

-- ============ 2) Item 53: só Admin isento do limite diário de XP ============
CREATE OR REPLACE FUNCTION public.admin_grant_xp(_user_id uuid, _xp integer, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_admin_pleno boolean;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  _is_admin_pleno := public.is_admin_pleno();
  INSERT INTO public.user_xp_log (user_id, action, xp, reference_type)
  VALUES (_user_id, CASE WHEN _is_admin_pleno THEN 'admin_grant_unlimited' ELSE 'admin_grant' END, _xp, 'admin');
  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (auth.uid(), 'grant_xp', 'profiles', _user_id, _reason, jsonb_build_object('xp', _xp));
END; $$;

DROP INDEX IF EXISTS public.user_xp_log_daily_unique;
CREATE UNIQUE INDEX user_xp_log_daily_unique ON public.user_xp_log (user_id, action, awarded_date)
WHERE action <> ALL (ARRAY['purchase','trade','tournament_win','referral_invite','referral_join','review','forum_post','forum_reply','admin_grant_unlimited']);

-- ============ 3) Configurações sensíveis: só Admin ============
DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can delete site settings" ON public.site_settings;
CREATE POLICY "Admin pleno insere site settings" ON public.site_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_pleno());
CREATE POLICY "Admin pleno atualiza site settings" ON public.site_settings
  FOR UPDATE TO authenticated USING (public.is_admin_pleno()) WITH CHECK (public.is_admin_pleno());
CREATE POLICY "Admin pleno remove site settings" ON public.site_settings
  FOR DELETE TO authenticated USING (public.is_admin_pleno());

DROP POLICY IF EXISTS "admin manages webhooks" ON public.integration_webhooks;
CREATE POLICY "admin pleno manages webhooks" ON public.integration_webhooks
  FOR ALL TO authenticated USING (public.is_admin_pleno()) WITH CHECK (public.is_admin_pleno());

-- Cargos de funcionário: só Admin
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admin pleno gerencia cargos" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin_pleno()) WITH CHECK (public.is_admin_pleno());

-- ============ 4) ECA: Admin + Gerente apenas ============
DROP POLICY IF EXISTS "minor sees own guardian request" ON public.guardian_link_requests;
DROP POLICY IF EXISTS "staff updates guardian request" ON public.guardian_link_requests;
CREATE POLICY "guardian request select" ON public.guardian_link_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = minor_id OR auth.uid() = guardian_id OR public.is_direcao());
CREATE POLICY "direcao atualiza guardian request" ON public.guardian_link_requests
  FOR UPDATE TO authenticated USING (public.is_direcao()) WITH CHECK (public.is_direcao());

DROP POLICY IF EXISTS "staff reads chat ai alerts" ON public.chat_ai_alerts;
DROP POLICY IF EXISTS "staff updates chat ai alerts" ON public.chat_ai_alerts;
CREATE POLICY "direcao le chat ai alerts" ON public.chat_ai_alerts
  FOR SELECT TO authenticated USING (public.is_direcao());
CREATE POLICY "direcao atualiza chat ai alerts" ON public.chat_ai_alerts
  FOR UPDATE TO authenticated USING (public.is_direcao()) WITH CHECK (public.is_direcao());

CREATE OR REPLACE FUNCTION public.admin_review_guardian_link(_id uuid, _approve boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.guardian_link_requests%ROWTYPE;
BEGIN
  IF NOT public.is_direcao() THEN
    RAISE EXCEPTION 'Apenas Administrador ou Gerente podem revisar vínculos de responsável';
  END IF;
  SELECT * INTO _r FROM public.guardian_link_requests WHERE id = _id;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;

  UPDATE public.guardian_link_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = _reason
  WHERE id = _id;

  IF _approve THEN
    UPDATE public.profiles SET guardian_user_id = _r.guardian_id, guardian_verified = true WHERE id = _r.minor_id;
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason)
  VALUES (auth.uid(), CASE WHEN _approve THEN 'guardian_approve' ELSE 'guardian_reject' END,
          'guardian_link_requests', _id, _reason);
END; $$;

-- ============ 5) Moderador ganha escopo de torneio ============
DROP POLICY IF EXISTS "Admins manage matches" ON public.tournament_matches;
CREATE POLICY "Direcao e moderador gerenciam matches" ON public.tournament_matches
  FOR ALL TO authenticated USING (public.is_moderador()) WITH CHECK (public.is_moderador());

DROP POLICY IF EXISTS "Admins manage tournaments" ON public.tournaments;
CREATE POLICY "Direcao e moderador gerenciam torneios" ON public.tournaments
  FOR ALL TO authenticated USING (public.is_moderador()) WITH CHECK (public.is_moderador());

-- ============ 6) Estoque/produtos/fornecedores: Admin, Gerente e Estoquista ============
CREATE OR REPLACE FUNCTION public.is_operacao_estoque()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_direcao() OR public.has_position(ARRAY['estoquista']);
$$;
GRANT EXECUTE ON FUNCTION public.is_operacao_estoque() TO authenticated;

DROP POLICY IF EXISTS "Admin insere movimentação manual" ON public.movimentacoes_estoque;
CREATE POLICY "Estoque insere movimentação manual" ON public.movimentacoes_estoque
  FOR INSERT TO authenticated WITH CHECK (public.is_operacao_estoque());

DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.fornecedores;
CREATE POLICY "Estoque gerencia fornecedores" ON public.fornecedores
  FOR ALL TO authenticated USING (public.is_operacao_estoque()) WITH CHECK (public.is_operacao_estoque());
