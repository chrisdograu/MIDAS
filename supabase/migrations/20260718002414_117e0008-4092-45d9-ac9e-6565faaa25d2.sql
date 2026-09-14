
-- =========================================================
-- Rodada 12 — Chat de torneio: anti-flood + ban check
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_tournament_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recent_count int;
BEGIN
  IF public.is_user_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'Usuário suspenso não pode enviar mensagens';
  END IF;
  IF length(COALESCE(NEW.content,'')) > 2000 THEN
    RAISE EXCEPTION 'Mensagem excede 2000 caracteres';
  END IF;
  SELECT COUNT(*) INTO recent_count
    FROM public.tournament_chat_messages
    WHERE user_id = NEW.user_id
      AND created_at > now() - interval '60 seconds';
  IF recent_count >= 30 THEN
    UPDATE public.profiles
       SET banned_until = now() + interval '90 days'
     WHERE id = NEW.user_id;
    INSERT INTO public.notifications(user_id, type, title, body)
    SELECT id, 'nova_mensagem',
           '⚠️ Flood detectado no chat de torneio',
           'Conta suspensa automaticamente por comportamento abusivo.'
      FROM public.profiles
     WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');
    RAISE EXCEPTION 'Rate limit excedido no chat de torneio — conta suspensa';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_tournament_chat ON public.tournament_chat_messages;
CREATE TRIGGER trg_validate_tournament_chat
BEFORE INSERT ON public.tournament_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_tournament_chat_message();

-- =========================================================
-- Rodada 12 — Anúncio opt-in de nova preferência
-- Uso: SELECT public.announce_new_notification_type('nome_da_coluna_bool',
--        'Título curto', 'Descrição', '/perfil#notificacoes');
-- Efeito:
--   1) Desliga a preferência para todos os usuários existentes (opt-in).
--   2) Envia notificação destacada com CTA "Ativar" para cada usuário.
-- =========================================================
CREATE OR REPLACE FUNCTION public.announce_new_notification_type(
  _pref_column text,
  _title text,
  _body text,
  _cta_url text DEFAULT '/perfil#notificacoes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
  is_admin_caller boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO is_admin_caller;
  IF NOT is_admin_caller THEN
    RAISE EXCEPTION 'Apenas administradores podem anunciar novas preferências';
  END IF;

  -- Valida se a coluna existe em notification_preferences (boolean)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notification_preferences'
       AND column_name = _pref_column
       AND data_type = 'boolean'
  ) THEN
    RAISE EXCEPTION 'Coluna % não existe em notification_preferences', _pref_column;
  END IF;

  -- 1) Desliga a preferência para todos (opt-in explícito)
  EXECUTE format(
    'UPDATE public.notification_preferences SET %I = false, updated_at = now() WHERE %I IS DISTINCT FROM false',
    _pref_column, _pref_column
  );
  GET DIAGNOSTICS affected = ROW_COUNT;

  -- 2) Notificação destacada com CTA para cada usuário com prefs
  INSERT INTO public.notifications
    (user_id, type, title, body, kind, cta_label, cta_url)
  SELECT np.user_id,
         'nova_mensagem'::notification_type,
         _title,
         _body,
         'destacada'::notification_kind,
         'Ativar',
         _cta_url
    FROM public.notification_preferences np;

  RETURN affected;
END $$;

REVOKE ALL ON FUNCTION public.announce_new_notification_type(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.announce_new_notification_type(text, text, text, text) TO authenticated;
