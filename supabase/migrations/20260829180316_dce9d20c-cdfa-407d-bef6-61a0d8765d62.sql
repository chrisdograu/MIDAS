CREATE OR REPLACE FUNCTION public.toggle_message_reaction(p_message_id uuid, p_emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing text;
  v_final text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'nao autenticado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mensagens m
    WHERE m.id = p_message_id AND (m.sender_id = v_user OR m.receiver_id = v_user)
  ) THEN
    RAISE EXCEPTION 'sem permissao para reagir a esta mensagem';
  END IF;

  SELECT emoji INTO v_existing FROM public.message_reactions
   WHERE message_id = p_message_id AND user_id = v_user LIMIT 1;

  IF v_existing IS NOT NULL THEN
    DELETE FROM public.message_reactions
     WHERE message_id = p_message_id AND user_id = v_user;
  END IF;

  IF v_existing IS DISTINCT FROM p_emoji THEN
    INSERT INTO public.message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, v_user, p_emoji);
    v_final := p_emoji;
  END IF;

  RETURN jsonb_build_object('emoji', v_final);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_like(p_kind text, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_liked boolean := false;
  v_total integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'nao autenticado';
  END IF;

  IF p_kind = 'forum_post' THEN
    DELETE FROM public.forum_post_likes WHERE post_id = p_target AND user_id = v_user;
    IF NOT FOUND THEN
      INSERT INTO public.forum_post_likes (post_id, user_id) VALUES (p_target, v_user);
      v_liked := true;
    END IF;
    SELECT count(*) INTO v_total FROM public.forum_post_likes WHERE post_id = p_target;

  ELSIF p_kind = 'forum_reply' THEN
    DELETE FROM public.forum_reply_likes WHERE reply_id = p_target AND user_id = v_user;
    IF NOT FOUND THEN
      INSERT INTO public.forum_reply_likes (reply_id, user_id) VALUES (p_target, v_user);
      v_liked := true;
    END IF;
    SELECT count(*) INTO v_total FROM public.forum_reply_likes WHERE reply_id = p_target;

  ELSIF p_kind = 'review' THEN
    DELETE FROM public.review_likes WHERE review_id = p_target AND user_id = v_user;
    IF NOT FOUND THEN
      INSERT INTO public.review_likes (review_id, user_id) VALUES (p_target, v_user);
      v_liked := true;
    END IF;
    SELECT count(*) INTO v_total FROM public.review_likes WHERE review_id = p_target;

  ELSIF p_kind = 'opinion' THEN
    DELETE FROM public.game_opinion_likes WHERE opinion_id = p_target AND user_id = v_user;
    IF NOT FOUND THEN
      INSERT INTO public.game_opinion_likes (opinion_id, user_id) VALUES (p_target, v_user);
      v_liked := true;
    END IF;
    SELECT count(*) INTO v_total FROM public.game_opinion_likes WHERE opinion_id = p_target;

  ELSIF p_kind = 'screenshot' THEN
    DELETE FROM public.game_screenshot_likes WHERE screenshot_id = p_target AND user_id = v_user;
    IF NOT FOUND THEN
      INSERT INTO public.game_screenshot_likes (screenshot_id, user_id) VALUES (p_target, v_user);
      v_liked := true;
    END IF;
    SELECT count(*) INTO v_total FROM public.game_screenshot_likes WHERE screenshot_id = p_target;

  ELSE
    RAISE EXCEPTION 'tipo de curtida invalido: %', p_kind;
  END IF;

  RETURN jsonb_build_object('liked', v_liked, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_like(text, uuid) TO authenticated;