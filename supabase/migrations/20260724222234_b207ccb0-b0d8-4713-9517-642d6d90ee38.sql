-- 1) Preservar histórico ao remover produto do catálogo
ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_product_id_fkey;
ALTER TABLE public.avaliacoes ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.produtos(id) ON DELETE SET NULL;

ALTER TABLE public.biblioteca_usuario DROP CONSTRAINT IF EXISTS biblioteca_usuario_product_id_fkey;
ALTER TABLE public.biblioteca_usuario ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.biblioteca_usuario ADD CONSTRAINT biblioteca_usuario_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.produtos(id) ON DELETE SET NULL;

-- 2) Notificação positiva de Vendedor Frequente (Item 99)
CREATE OR REPLACE FUNCTION public.notify_frequent_seller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_frequent_seller = true AND (OLD.is_frequent_seller IS DISTINCT FROM true) THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.id,
      'frequent_seller',
      'Suas vendas estão bombando! 🎉',
      'Você virou Vendedor Frequente da MIDIAS. Continue assim — seu selo já apareceu no perfil.',
      jsonb_build_object('badge', 'vendedor-frequente')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_frequent_seller ON public.profiles;
CREATE TRIGGER trg_notify_frequent_seller
AFTER UPDATE OF is_frequent_seller ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_frequent_seller();

-- 3) Sinal de bloqueio pós-troca (Item 119)
CREATE OR REPLACE FUNCTION public.notify_trade_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT seller_id INTO v_seller FROM public.anuncios WHERE id = NEW.anuncio_id;
    -- proposer
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.proposer_id, 'trade_completed_check',
      'Troca concluída — tudo certo?',
      'Se algo deu errado (item não chegou, item diferente do combinado), você pode bloquear ou denunciar por aqui.',
      jsonb_build_object('proposal_id', NEW.id, 'other_user', v_seller));
    -- seller
    IF v_seller IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (v_seller, 'trade_completed_check',
        'Troca concluída — tudo certo?',
        'Se algo deu errado com o outro lado, você pode bloquear ou denunciar direto por aqui.',
        jsonb_build_object('proposal_id', NEW.id, 'other_user', NEW.proposer_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_trade_completed ON public.trade_proposals;
CREATE TRIGGER trg_notify_trade_completed
AFTER UPDATE OF status ON public.trade_proposals
FOR EACH ROW EXECUTE FUNCTION public.notify_trade_completed();

-- 4) Transparência de chat de partida (Item 105)
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS admin_visible boolean NOT NULL DEFAULT false;
UPDATE public.conversas SET admin_visible = true WHERE match_id IS NOT NULL AND admin_visible = false;

-- Policy: moderadores do torneio podem ler conversas do match
DROP POLICY IF EXISTS "Tournament moderators read match conversations" ON public.conversas;
CREATE POLICY "Tournament moderators read match conversations"
ON public.conversas FOR SELECT
TO authenticated
USING (
  match_id IS NOT NULL
  AND admin_visible = true
  AND EXISTS (
    SELECT 1 FROM public.tournament_matches tm
    JOIN public.tournament_moderators tmo ON tmo.tournament_id = tm.tournament_id
    WHERE tm.id = conversas.match_id AND tmo.user_id = auth.uid()
  )
);

-- 5) Rate limit no resgate de cupom (Item 117)
-- Recria validate_and_use_coupon com trava anti-abuso (mantém contrato original)
CREATE OR REPLACE FUNCTION public.validate_and_use_coupon(_code text, _order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_coupon RECORD;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Rate limit: 10 tentativas / 5min por usuário
  BEGIN
    SELECT public.rate_limit_hit(v_uid::text, 'coupon_redeem', 10, 300) INTO v_allowed;
  EXCEPTION WHEN undefined_function THEN
    v_allowed := true; -- se função ausente, não bloqueia
  END;
  IF v_allowed = false THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  SELECT * INTO v_coupon FROM public.cupons
    WHERE code = upper(_code) AND is_active = true FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_not_found'; END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_count >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted';
  END IF;

  INSERT INTO public.cupon_usos (coupon_id, user_id, order_id)
  VALUES (v_coupon.id, v_uid, _order_id);

  UPDATE public.cupons SET uses_count = uses_count + 1 WHERE id = v_coupon.id;

  RETURN v_coupon.id;
END;
$$;