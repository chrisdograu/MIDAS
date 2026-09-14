
-- =========================================================
-- RPC start_conversation: aplica chat_privacy_mode de 3 níveis
-- =========================================================
CREATE OR REPLACE FUNCTION public.start_conversation(
  p_target uuid,
  p_anuncio_id uuid DEFAULT NULL,
  p_torneio_id uuid DEFAULT NULL,
  p_channel text DEFAULT 'personal'
) RETURNS TABLE(conversation_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_existing uuid;
  v_status text := 'pending';
  v_target_mode text;
  v_target_birth date;
  v_me_birth date;
  v_me_age int;
  v_guardian uuid;
  v_i_follow boolean;
  v_they_follow boolean;
  v_new_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF p_target IS NULL OR p_target = v_me THEN RAISE EXCEPTION 'invalid target'; END IF;

  -- Bloqueio bidirecional
  IF EXISTS(SELECT 1 FROM blocked_users WHERE (blocker_id=v_me AND blocked_id=p_target) OR (blocker_id=p_target AND blocked_id=v_me)) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE='42501';
  END IF;

  -- Reutiliza conversa existente
  SELECT id INTO v_existing FROM conversas
   WHERE ((participant_1=v_me AND participant_2=p_target) OR (participant_1=p_target AND participant_2=v_me))
     AND COALESCE(anuncio_id::text,'') = COALESCE(p_anuncio_id::text,'')
     AND COALESCE(torneio_id::text,'') = COALESCE(p_torneio_id::text,'')
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, (SELECT c.status FROM conversas c WHERE c.id=v_existing);
    RETURN;
  END IF;

  SELECT chat_privacy_mode, birth_date INTO v_target_mode, v_target_birth FROM profiles WHERE id=p_target;
  SELECT birth_date, guardian_user_id INTO v_me_birth, v_guardian FROM profiles WHERE id=v_me;
  v_target_mode := COALESCE(v_target_mode, 'request_only');

  v_i_follow := EXISTS(SELECT 1 FROM user_follows WHERE follower_id=v_me AND following_id=p_target AND COALESCE(status,'accepted')='accepted');
  v_they_follow := EXISTS(SELECT 1 FROM user_follows WHERE follower_id=p_target AND following_id=v_me AND COALESCE(status,'accepted')='accepted');

  -- Regra base pelo modo do destinatário
  IF v_target_mode = 'friends_direct' AND v_i_follow AND v_they_follow THEN
    v_status := 'accepted';
  ELSIF v_target_mode = 'followers_direct' AND v_i_follow THEN
    v_status := 'accepted';
  ELSE
    v_status := 'pending';
  END IF;

  -- ECA: menor iniciando canal 'seller' → sempre pending_guardian se houver responsável
  IF v_me_birth IS NOT NULL THEN
    v_me_age := EXTRACT(YEAR FROM age(v_me_birth));
    IF v_me_age < 18 AND p_channel = 'seller' THEN
      IF v_guardian IS NOT NULL THEN
        v_status := 'pending_guardian';
      ELSE
        v_status := 'pending';
      END IF;
    END IF;
  END IF;

  INSERT INTO conversas(participant_1, participant_2, anuncio_id, torneio_id, channel, status)
  VALUES (v_me, p_target, p_anuncio_id, p_torneio_id, COALESCE(p_channel,'personal'), v_status)
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_conversation(uuid,uuid,uuid,text) TO authenticated;

-- =========================================================
-- Classificação indicativa: RLS restritiva em produtos
-- Esconde produtos acima da idade do usuário (admin/staff isento).
-- =========================================================
DROP POLICY IF EXISTS "age_rating_gate" ON public.produtos;
CREATE POLICY "age_rating_gate"
  ON public.produtos
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    classificacao_indicativa IS NULL
    OR public.has_role(auth.uid(), 'admin')
    OR public.pode_acessar_conteudo(auth.uid(), classificacao_indicativa)
  );
