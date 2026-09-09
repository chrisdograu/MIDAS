
-- Rodada 13 — ECA Digital.

-- 1) Nível de aprovação do responsável.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles'
                   AND column_name='minor_chat_approval_mode') THEN
    ALTER TABLE public.profiles
      ADD COLUMN minor_chat_approval_mode text NOT NULL DEFAULT 'approve'
      CHECK (minor_chat_approval_mode IN ('notify','approve'));
  END IF;
END $$;

-- 2) Coerção: menor força request_only; criança força approve.
CREATE OR REPLACE FUNCTION public.enforce_minor_chat_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bracket text;
BEGIN
  _bracket := public.age_bracket(NEW.birth_date);
  IF _bracket IN ('crianca','adolescente') THEN
    NEW.chat_privacy_mode := 'request_only';
  END IF;
  IF _bracket = 'crianca' THEN
    NEW.minor_chat_approval_mode := 'approve';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_minor_chat_rules ON public.profiles;
CREATE TRIGGER trg_enforce_minor_chat_rules
  BEFORE INSERT OR UPDATE OF birth_date, chat_privacy_mode, minor_chat_approval_mode
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_minor_chat_rules();

-- 3) Publicar produto exige classificação.
CREATE OR REPLACE FUNCTION public.require_classificacao_on_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.estado_publicacao = 'ativo' AND NEW.classificacao_indicativa IS NULL THEN
    RAISE EXCEPTION 'Classificação indicativa é obrigatória para publicar (ECA Digital / Lei 15.211/2025).'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_require_classificacao_on_publish ON public.produtos;
CREATE TRIGGER trg_require_classificacao_on_publish
  BEFORE INSERT OR UPDATE OF estado_publicacao, classificacao_indicativa
  ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.require_classificacao_on_publish();

-- 4) RESTRICTIVE policy em anuncios: match por game_title (o C2C não guarda product_id).
DROP POLICY IF EXISTS anuncios_age_gate ON public.anuncios;
CREATE POLICY anuncios_age_gate ON public.anuncios AS RESTRICTIVE
  FOR SELECT TO authenticated, anon
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE lower(p.title) = lower(anuncios.game_title)
        AND NOT public.pode_acessar_conteudo(auth.uid(), p.classificacao_indicativa)
    )
  );

-- 5) Bloqueia contato externo em chat de menor.
CREATE OR REPLACE FUNCTION public.block_external_contact_for_minor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sb text; _rb text; _content text;
BEGIN
  SELECT public.age_bracket(birth_date) INTO _sb FROM public.profiles WHERE id = NEW.sender_id;
  SELECT public.age_bracket(birth_date) INTO _rb FROM public.profiles WHERE id = NEW.receiver_id;
  IF _sb NOT IN ('crianca','adolescente') AND _rb NOT IN ('crianca','adolescente') THEN
    RETURN NEW;
  END IF;
  _content := lower(coalesce(NEW.content,''));
  IF _content ~ '[0-9][0-9\s\-\.\(\)]{6,}[0-9]'
     OR _content ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
     OR _content ~ '(whatsapp|whats app|telegram|discord|instagram|tiktok|snapchat|zap|wpp|t\.me/|wa\.me/)' THEN
    RAISE EXCEPTION 'Compartilhar contato externo não é permitido em conversas envolvendo conta de menor.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_external_contact_for_minor ON public.mensagens;
CREATE TRIGGER trg_block_external_contact_for_minor
  BEFORE INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.block_external_contact_for_minor();

-- 6) start_conversation cobrindo menor.
CREATE OR REPLACE FUNCTION public.start_conversation(_other uuid, _channel text DEFAULT 'personal')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _existing public.conversas;
  _target_mode text; _target_bracket text; _me_bracket text;
  _target_approve text;
  _mutual boolean; _followed boolean;
  _status text := 'pending'; _conv_id uuid;
  _guardian uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _me = _other THEN RAISE EXCEPTION 'self_conversation'; END IF;
  IF _channel NOT IN ('personal','seller') THEN RAISE EXCEPTION 'invalid_channel'; END IF;

  SELECT * INTO _existing FROM public.conversas
   WHERE (participant_1 = _me AND participant_2 = _other)
      OR (participant_1 = _other AND participant_2 = _me)
   LIMIT 1;
  IF _existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing.id, 'status', _existing.status, 'reused', true);
  END IF;

  SELECT chat_privacy_mode, minor_chat_approval_mode, public.age_bracket(birth_date), guardian_user_id
    INTO _target_mode, _target_approve, _target_bracket, _guardian
    FROM public.profiles WHERE id = _other;
  SELECT public.age_bracket(birth_date) INTO _me_bracket FROM public.profiles WHERE id = _me;

  SELECT public.are_mutual_friends(_me, _other) INTO _mutual;
  SELECT EXISTS(SELECT 1 FROM public.user_follows
                 WHERE follower_id = _other AND following_id = _me) INTO _followed;

  IF _me_bracket IN ('crianca','adolescente') AND _channel = 'seller' THEN
    _status := 'pending_guardian';
  ELSIF _target_bracket IN ('crianca','adolescente') AND NOT _mutual THEN
    RAISE EXCEPTION 'minor_stranger_blocked' USING ERRCODE = '42501';
  ELSIF _target_bracket IN ('crianca','adolescente') THEN
    _status := CASE WHEN _target_approve = 'approve' THEN 'pending_guardian' ELSE 'pending' END;
  ELSIF _target_mode = 'friends_direct' AND _mutual THEN
    _status := 'accepted';
  ELSIF _target_mode = 'followers_direct' AND _followed THEN
    _status := 'accepted';
  ELSE
    _status := 'pending';
  END IF;

  INSERT INTO public.conversas(participant_1, participant_2, status, channel)
  VALUES (_me, _other, _status, _channel) RETURNING id INTO _conv_id;

  IF _status = 'pending_guardian' THEN
    IF _me_bracket IN ('crianca','adolescente') THEN
      SELECT guardian_user_id INTO _guardian FROM public.profiles WHERE id = _me;
    END IF;
    IF _guardian IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
      VALUES (_guardian, 'nova_mensagem',
              'Pedido de chat aguardando aprovação',
              'Uma nova conversa precisa da sua análise antes de continuar.',
              'conversa', _conv_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('id', _conv_id, 'status', _status, 'reused', false);
END $$;

GRANT EXECUTE ON FUNCTION public.start_conversation(uuid, text) TO authenticated;
