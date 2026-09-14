-- ============ A) has_position ============
CREATE OR REPLACE FUNCTION public.has_position(_positions text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.position::text = ANY(_positions)
  );
$$;

-- ============ B) Privacidade granular ============
ALTER TABLE public.game_opinions ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'friends';
ALTER TABLE public.game_screenshots ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'friends';
ALTER TABLE public.game_timeline_events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'friends';

DROP POLICY IF EXISTS "opinions_select_friends_or_self" ON public.game_opinions;
CREATE POLICY "opinions_select_visibility" ON public.game_opinions FOR SELECT
USING (
  public.can_view_friend_content(user_id, auth.uid(), visibility)
  OR public.can_view_scope(user_id, auth.uid(), 'opinions')
);

DROP POLICY IF EXISTS "ss_select" ON public.game_screenshots;
CREATE POLICY "ss_select_visibility" ON public.game_screenshots FOR SELECT
USING (
  public.can_view_friend_content(user_id, auth.uid(), visibility)
  OR public.can_view_scope(user_id, auth.uid(), 'screenshots')
);

DROP POLICY IF EXISTS "Amigos veem timeline" ON public.game_timeline_events;
CREATE POLICY "timeline_select_visibility" ON public.game_timeline_events FOR SELECT
USING (
  public.is_staff()
  OR public.can_view_friend_content(user_id, auth.uid(), visibility)
  OR public.can_view_scope(user_id, auth.uid(), 'stats')
);

DROP POLICY IF EXISTS "Friends can view review completa" ON public.reviews_completas;
CREATE POLICY "Friends can view review completa" ON public.reviews_completas FOR SELECT
USING (
  public.can_view_friend_content(user_id, auth.uid(), visibility)
  OR public.can_view_scope(user_id, auth.uid(), 'reviews_completas')
);

DROP POLICY IF EXISTS "Biblioteca pública visível para todos" ON public.biblioteca_usuario;
CREATE POLICY "biblioteca_select_visibility" ON public.biblioteca_usuario FOR SELECT
USING (
  public.can_view_friend_content(
    user_id, auth.uid(),
    COALESCE((SELECT p.library_visibility FROM public.profiles p WHERE p.id = biblioteca_usuario.user_id), 'friends')
  )
  OR public.can_view_scope(user_id, auth.uid(), 'library_items')
);

-- ============ C) Cargo trava ações reais ============
-- Estoque: só gerente/estoquista/admin
CREATE OR REPLACE FUNCTION public.enforce_stock_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_position(ARRAY['admin','gerente','estoquista'])) THEN
      RAISE EXCEPTION 'Apenas Gerente ou Estoquista podem alterar o estoque';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_stock_position ON public.produtos;
CREATE TRIGGER trg_enforce_stock_position BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.enforce_stock_position();

-- Logs administrativos: só gerente/admin
DROP POLICY IF EXISTS "Staff vê logs" ON public.admin_logs;
CREATE POLICY "Gerente vê logs" ON public.admin_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_position(ARRAY['admin','gerente']));

-- ============ D) adminLog dentro da RPC ============
CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid, _reason text, _until timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.profiles SET is_banned = true, banned_until = _until, ban_reason = _reason WHERE id = _user_id;
  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason)
  VALUES (auth.uid(), 'ban_user', 'profiles', _user_id, _reason);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_product(_product_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_position(ARRAY['admin','gerente'])) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason)
  VALUES (auth.uid(), 'delete_product', 'produtos', _product_id, _reason);
  DELETE FROM public.produtos WHERE id = _product_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_grant_xp(_user_id uuid, _xp integer, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_gerente boolean;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  _is_gerente := public.has_role(auth.uid(), 'admin') OR public.has_position(ARRAY['admin','gerente']);
  INSERT INTO public.user_xp_log (user_id, action, xp, reference_type)
  VALUES (_user_id, CASE WHEN _is_gerente THEN 'admin_grant_gerente' ELSE 'admin_grant' END, _xp, 'admin');
  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (auth.uid(), 'grant_xp', 'profiles', _user_id, _reason, jsonb_build_object('xp', _xp));
END; $$;

-- ============ E) XP: admin_grant volta ao limite diário ============
DROP INDEX IF EXISTS public.user_xp_log_daily_unique;
CREATE UNIQUE INDEX user_xp_log_daily_unique ON public.user_xp_log (user_id, action, awarded_date)
WHERE action <> ALL (ARRAY['purchase','trade','tournament_win','referral_invite','referral_join','review','forum_post','forum_reply','admin_grant_gerente']);

-- ============ F) Hash perceptual de anúncio ============
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS image_hash text;
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS flagged_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS duplicate_of uuid;

CREATE OR REPLACE FUNCTION public.hash_distance(_a text, _b text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE i int; d int := 0;
BEGIN
  IF _a IS NULL OR _b IS NULL OR length(_a) <> length(_b) THEN RETURN 999; END IF;
  FOR i IN 1..length(_a) LOOP
    IF substr(_a, i, 1) <> substr(_b, i, 1) THEN d := d + 1; END IF;
  END LOOP;
  RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.detect_duplicate_ad_image()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _match uuid;
BEGIN
  IF NEW.image_hash IS NULL THEN RETURN NEW; END IF;
  SELECT a.id INTO _match FROM public.anuncios a
  WHERE a.image_hash IS NOT NULL AND a.id <> NEW.id
    AND a.seller_id <> NEW.seller_id AND a.status = 'active'
    AND public.hash_distance(a.image_hash, NEW.image_hash) <= 6
  LIMIT 1;
  IF _match IS NOT NULL THEN
    NEW.flagged_duplicate := true;
    NEW.duplicate_of := _match;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_detect_duplicate_ad_image ON public.anuncios;
CREATE TRIGGER trg_detect_duplicate_ad_image BEFORE INSERT OR UPDATE OF image_hash ON public.anuncios
FOR EACH ROW EXECUTE FUNCTION public.detect_duplicate_ad_image();

-- ============ G) Preço-alvo em favoritos ============
ALTER TABLE public.favoritos ADD COLUMN IF NOT EXISTS target_price numeric;

CREATE OR REPLACE FUNCTION public.notify_target_price_drop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price AND NEW.price < OLD.price THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT f.user_id, 'price_drop',
           'Preço-alvo atingido!',
           NEW.title || ' está por R$ ' || to_char(NEW.price, 'FM999999990.00'),
           '/jogo/' || NEW.id
    FROM public.favoritos f
    WHERE f.product_id = NEW.id AND f.target_price IS NOT NULL AND NEW.price <= f.target_price;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_target_price_drop ON public.produtos;
CREATE TRIGGER trg_notify_target_price_drop AFTER UPDATE OF price ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.notify_target_price_drop();

-- ============ H) Disputa de marketplace (mediação) ============
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS dispute_status text;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS dispute_reason text;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS dispute_evidence_url text;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS seller_response text;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS checkin_note text;
ALTER TABLE public.trade_proposals ADD COLUMN IF NOT EXISTS paid_confirmed_at timestamptz;

CREATE OR REPLACE FUNCTION public.open_trade_dispute(_proposal_id uuid, _reason text, _evidence_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.trade_proposals%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.trade_proposals WHERE id = _proposal_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF _p.proposer_id <> auth.uid() THEN RAISE EXCEPTION 'Somente o comprador pode contestar'; END IF;
  IF _p.delivered_at IS NULL THEN RAISE EXCEPTION 'A entrega ainda não foi marcada pelo vendedor'; END IF;
  IF now() > _p.delivered_at + interval '72 hours' THEN RAISE EXCEPTION 'Janela de conferência de 72h encerrada'; END IF;
  UPDATE public.trade_proposals
  SET dispute_status = 'open', dispute_opened_at = now(), dispute_reason = _reason, dispute_evidence_url = _evidence_url
  WHERE id = _proposal_id;
END; $$;

CREATE OR REPLACE FUNCTION public.auto_resolve_stale_disputes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.trade_proposals
  SET dispute_status = 'resolved_buyer', resolution = 'Vendedor não respondeu no prazo — registrado a favor do comprador (apenas reputação).', resolved_at = now()
  WHERE dispute_status = 'open' AND seller_response IS NULL AND dispute_opened_at < now() - interval '72 hours';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

-- ============ I) Preferência: esconder jogos que já tenho ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_owned_games boolean NOT NULL DEFAULT false;

GRANT EXECUTE ON FUNCTION public.has_position(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_xp(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_trade_dispute(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_resolve_stale_disputes() TO service_role;