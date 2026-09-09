
-- Item 6: exigir posse do jogo para avaliar
CREATE OR REPLACE FUNCTION public.enforce_review_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owns boolean;
BEGIN
  -- Admins podem avaliar sem posse (moderação/curadoria)
  IF public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.biblioteca_usuario
    WHERE user_id = NEW.user_id
      AND product_id = NEW.product_id
      AND status IN ('ja_joguei','zerado','jogando','pausado','abandonado')
  ) INTO v_owns;

  IF NOT v_owns THEN
    RAISE EXCEPTION 'Você precisa possuir este jogo (status jogando/zerado/pausado/abandonado/ja_joguei) para avaliá-lo.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_review_ownership ON public.avaliacoes;
CREATE TRIGGER trg_enforce_review_ownership
BEFORE INSERT OR UPDATE OF product_id, user_id, rating
ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_review_ownership();

-- Item 2: admin_logs imutável (sem UPDATE/DELETE)
DROP POLICY IF EXISTS "Apenas admin geral reverte" ON public.admin_logs;
