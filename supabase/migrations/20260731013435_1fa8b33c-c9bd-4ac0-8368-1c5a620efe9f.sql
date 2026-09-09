-- ============ BLOCO A1: visibilidade por linha (override) ============
ALTER TABLE public.game_opinions ADD COLUMN IF NOT EXISTS visibility text;
ALTER TABLE public.game_screenshots ADD COLUMN IF NOT EXISTS visibility text;
ALTER TABLE public.game_timeline_events ADD COLUMN IF NOT EXISTS visibility text;

CREATE OR REPLACE FUNCTION public.can_view_post(_owner uuid, _viewer uuid, _row_vis text, _kind text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _owner = _viewer THEN RETURN true; END IF;
  IF _row_vis IS NULL OR _row_vis = '' THEN
    RETURN public.can_view_profile_content(_owner, _viewer, _kind);
  END IF;
  IF _row_vis LIKE 'user:%' THEN
    RETURN _viewer::text = split_part(_row_vis, ':', 2);
  END IF;
  IF _row_vis = 'favorites' THEN
    RETURN public.is_close_friend(_owner, _viewer);
  END IF;
  RETURN public.can_view_friend_content(_owner, _viewer, _row_vis);
END $$;

DROP POLICY IF EXISTS opinions_select_visibility ON public.game_opinions;
CREATE POLICY opinions_select_visibility ON public.game_opinions FOR SELECT
USING (public.can_view_post(user_id, auth.uid(), visibility, 'opinions') OR public.can_view_scope(user_id, auth.uid(), 'opinions'));

DROP POLICY IF EXISTS ss_select_visibility ON public.game_screenshots;
CREATE POLICY ss_select_visibility ON public.game_screenshots FOR SELECT
USING (public.can_view_post(user_id, auth.uid(), visibility, 'screenshots') OR public.can_view_scope(user_id, auth.uid(), 'screenshots'));

DROP POLICY IF EXISTS timeline_select_visibility ON public.game_timeline_events;
CREATE POLICY timeline_select_visibility ON public.game_timeline_events FOR SELECT
USING (public.is_staff() OR public.can_view_post(user_id, auth.uid(), visibility, 'timeline') OR public.can_view_scope(user_id, auth.uid(), 'stats'));

-- ============ BLOCO B: parâmetros do sistema ============
INSERT INTO public.site_settings(key, value)
VALUES ('business_params', jsonb_build_object(
  'frequent_seller_min_sales', 6,
  'frequent_seller_window_days', 45,
  'urgency_friction_minutes', 5,
  'dispute_window_hours', 72,
  'safe_zone_min_price', 300,
  'max_forums_per_ad', 3,
  'community_tournament_max_participants', 16,
  'rate_limit_login_attempts', 5,
  'rate_limit_login_window_seconds', 60,
  'rate_limit_reset_attempts', 3,
  'rate_limit_reset_window_seconds', 3600,
  'rate_limit_report_attempts', 5,
  'rate_limit_report_window_seconds', 300,
  'rate_limit_coupon_attempts', 10,
  'rate_limit_coupon_window_seconds', 300,
  'report_priority_media_threshold', 3,
  'report_priority_alta_threshold', 5,
  'xp_review', 25,
  'xp_forum_post', 10,
  'xp_forum_reply', 5,
  'backlog_note_max_chars', 280,
  'trophy_showcase_max', 6,
  'official_tournament_cooldown_weeks', 4,
  'admin_revert_window_minutes', 60
))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.param_num(_key text, _default numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT (value->>_key)::numeric FROM public.site_settings WHERE key = 'business_params'), _default);
$$;

CREATE OR REPLACE FUNCTION public.log_site_settings_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (auth.uid(), 'update_setting', 'site_settings', NEW.id,
          'Alteração de configuração: ' || NEW.key,
          jsonb_build_object('key', NEW.key, 'antes', OLD.value, 'depois', NEW.value));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_site_settings_change ON public.site_settings;
CREATE TRIGGER trg_log_site_settings_change AFTER UPDATE ON public.site_settings
FOR EACH ROW WHEN (OLD.value IS DISTINCT FROM NEW.value) EXECUTE FUNCTION public.log_site_settings_change();

-- parâmetros aplicados nas funções existentes
CREATE OR REPLACE FUNCTION public.check_frequent_seller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _cnt int; _already boolean; _min int; _days int;
BEGIN
  IF NEW.status IN ('sold','traded') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    _min := public.param_num('frequent_seller_min_sales', 6)::int;
    _days := public.param_num('frequent_seller_window_days', 45)::int;
    SELECT count(*) INTO _cnt FROM public.anuncios
      WHERE seller_id = NEW.seller_id AND status IN ('sold','traded')
        AND updated_at >= now() - (_days || ' days')::interval;
    IF _cnt >= _min THEN
      SELECT is_frequent_seller INTO _already FROM public.profiles WHERE id = NEW.seller_id;
      IF NOT COALESCE(_already, false) THEN
        UPDATE public.profiles SET is_frequent_seller = true, frequent_seller_at = now() WHERE id = NEW.seller_id;
        INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.seller_id, 'frequent_seller') ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.group_denuncia_by_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _existing public.denuncias%ROWTYPE; _med int; _alt int;
BEGIN
  _med := public.param_num('report_priority_media_threshold', 3)::int;
  _alt := public.param_num('report_priority_alta_threshold', 5)::int;
  SELECT * INTO _existing FROM public.denuncias
  WHERE target_type = NEW.target_type AND target_id = NEW.target_id
    AND COALESCE(status,'pendente') NOT IN ('resolvida','rejeitada','arquivada','fechada','resolvido')
  ORDER BY created_at ASC LIMIT 1;

  IF _existing.id IS NULL THEN
    NEW.reporters := ARRAY[NEW.reporter_id]::uuid[];
    NEW.report_count := 1;
    RETURN NEW;
  END IF;

  IF NEW.reporter_id = ANY(_existing.reporters) OR NEW.reporter_id = _existing.reporter_id THEN
    RETURN NULL;
  END IF;

  UPDATE public.denuncias
  SET reporters = array_append(CASE WHEN cardinality(reporters)=0 THEN ARRAY[reporter_id]::uuid[] ELSE reporters END, NEW.reporter_id),
      report_count = GREATEST(report_count,1) + 1,
      priority = CASE
        WHEN GREATEST(report_count,1) + 1 >= _alt THEN 'alta'
        WHEN GREATEST(report_count,1) + 1 >= _med AND COALESCE(priority,'normal') = 'normal' THEN 'media'
        ELSE priority END,
      description = COALESCE(description,'') || CASE WHEN NEW.description IS NULL OR NEW.description='' THEN '' ELSE E'\n---\n' || NEW.description END
  WHERE id = _existing.id;
  RETURN NULL;
END $$;

-- ============ BLOCO C: torneios comunitário vs oficial ============
CREATE OR REPLACE FUNCTION public.enforce_community_tournament_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _max int; _ativos int;
BEGIN
  _max := public.param_num('community_tournament_max_participants', 16)::int;

  IF NOT public.is_staff() THEN
    NEW.is_community := true;
    NEW.unlisted := true;
  END IF;

  IF NEW.is_community THEN
    NEW.unlisted := true;
    IF COALESCE(NEW.max_participants, 0) > _max THEN
      RAISE EXCEPTION 'Torneios comunitários aceitam no máximo % participantes.', _max;
    END IF;
  ELSE
    -- 1 torneio oficial ativo por organizador
    IF TG_OP = 'INSERT' AND NEW.created_by IS NOT NULL THEN
      SELECT count(*) INTO _ativos FROM public.tournaments
       WHERE created_by = NEW.created_by AND COALESCE(is_community,false) = false
         AND COALESCE(status,'') NOT IN ('encerrado','cancelado','finished','cancelled','concluido')
         AND archived_at IS NULL;
      IF _ativos >= 1 THEN
        RAISE EXCEPTION 'Você já tem um torneio oficial ativo. Encerre ou cancele antes de criar outro.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_tournament_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF COALESCE(NEW.is_community, false) THEN
    NEW.xp_signup := 0; NEW.xp_match_win := 0; NEW.xp_champion := 0;
    RETURN NEW;
  END IF;
  SELECT * INTO r FROM public.calc_tournament_xp(COALESCE(NEW.max_participants, 8));
  NEW.xp_signup := r.xp_signup; NEW.xp_match_win := r.xp_match_win; NEW.xp_champion := r.xp_champion;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.award_tournament_rewards(_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; p record; pct numeric; xp_award int; badge_id text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas admins'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = _tournament_id;
  IF NOT FOUND OR t.rewards_distributed THEN RETURN; END IF;
  IF COALESCE(t.is_community, false) THEN
    RAISE EXCEPTION 'Torneios comunitários não distribuem XP nem recompensas.';
  END IF;

  FOR p IN SELECT * FROM public.tournament_participants
           WHERE tournament_id = _tournament_id AND final_rank BETWEEN 1 AND 3 ORDER BY final_rank
  LOOP
    pct := CASE p.final_rank WHEN 1 THEN 1.0 WHEN 2 THEN 0.6 ELSE 0.35 END;
    xp_award := FLOOR((t.xp_champion + COALESCE(t.prize_xp_bonus,0)) * pct);
    PERFORM public.award_xp(p.user_id, 'tournament_rank_' || p.final_rank, xp_award, 'tournament', t.id);
    badge_id := CASE p.final_rank WHEN 1 THEN 'tourn_gold' WHEN 2 THEN 'tourn_silver' ELSE 'tourn_bronze' END;
    INSERT INTO public.badge_catalog(id, name, description, icon, category)
    VALUES (badge_id,
      CASE p.final_rank WHEN 1 THEN 'Campeão' WHEN 2 THEN 'Vice-Campeão' ELSE '3º Lugar' END,
      'Conquistado em torneio oficial',
      CASE p.final_rank WHEN 1 THEN '🥇' WHEN 2 THEN '🥈' ELSE '🥉' END, 'tournament')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_badges(user_id, badge_id) VALUES (p.user_id, badge_id) ON CONFLICT DO NOTHING;
    IF p.final_rank = 1 AND t.prize_title IS NOT NULL THEN
      INSERT INTO public.user_titles(user_id, name, source, tournament_id, awarded_by)
      VALUES (p.user_id, t.prize_title, 'achievement', t.id, auth.uid());
    END IF;
  END LOOP;
  UPDATE public.tournaments SET rewards_distributed = true WHERE id = _tournament_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_tournament_forum_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(NEW.is_community, false) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.forum_posts WHERE tournament_id = NEW.id) THEN RETURN NEW; END IF;
  INSERT INTO public.forum_posts (user_id, tournament_id, title, content, visibility)
  VALUES (NEW.created_by, NEW.id, 'Torneio: ' || COALESCE(NEW.title, 'sem título'),
    COALESCE(NEW.description,'') || E'\n\n— Thread oficial do torneio. Combinem regras, dúvidas e resultados por aqui.', 'public');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_tournament_forum_thread failed: %', SQLERRM;
  RETURN NEW;
END $$;

-- chat: comunitário libera todo mundo, oficial começa mudo
CREATE OR REPLACE FUNCTION public.set_participant_chat_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record;
BEGIN
  SELECT is_community, created_by INTO t FROM public.tournaments WHERE id = NEW.tournament_id;
  IF NEW.chat_role IS NULL THEN
    IF COALESCE(t.is_community, false) THEN
      NEW.chat_role := CASE WHEN NEW.user_id = t.created_by THEN 'admin'::public.tournament_chat_role
                            ELSE 'member'::public.tournament_chat_role END;
    ELSE
      NEW.chat_role := 'observer'::public.tournament_chat_role;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_participant_chat_role ON public.tournament_participants;
CREATE TRIGGER trg_set_participant_chat_role BEFORE INSERT ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.set_participant_chat_role();

-- cooldown de 4 semanas apenas em torneio oficial
CREATE OR REPLACE FUNCTION public.enforce_official_tournament_cooldown()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _is_comm boolean; _last timestamptz; _weeks int;
BEGIN
  SELECT COALESCE(is_community,false) INTO _is_comm FROM public.tournaments WHERE id = NEW.tournament_id;
  IF _is_comm THEN RETURN NEW; END IF;
  _weeks := public.param_num('official_tournament_cooldown_weeks', 4)::int;
  SELECT max(tp.joined_at) INTO _last
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
   WHERE tp.user_id = NEW.user_id AND COALESCE(t.is_community,false) = false;
  IF _last IS NOT NULL AND _last > now() - (_weeks || ' weeks')::interval THEN
    RAISE EXCEPTION 'Você poderá se inscrever em outro torneio oficial em %.', to_char(_last + (_weeks || ' weeks')::interval, 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_official_tournament_cooldown ON public.tournament_participants;
CREATE TRIGGER trg_official_tournament_cooldown BEFORE INSERT ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_official_tournament_cooldown();

-- ============ BLOCO D: reversão de ação administrativa ============
CREATE OR REPLACE FUNCTION public.admin_delete_product(_product_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_position(ARRAY['admin','gerente'])) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (auth.uid(), 'delete_product', 'produtos', _product_id, _reason, jsonb_build_object('soft_delete', true));
  UPDATE public.produtos SET is_active = false WHERE id = _product_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revert_action(_log_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l record; _win int;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória para reverter';
  END IF;
  SELECT * INTO l FROM public.admin_logs WHERE id = _log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;
  IF l.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Você só pode reverter as suas próprias ações';
  END IF;
  IF l.reverted_at IS NOT NULL THEN RAISE EXCEPTION 'Esta ação já foi revertida'; END IF;
  _win := public.param_num('admin_revert_window_minutes', 60)::int;
  IF l.created_at < now() - (_win || ' minutes')::interval THEN
    RAISE EXCEPTION 'A janela de % minutos para reverter esta ação expirou', _win;
  END IF;

  IF l.action = 'delete_product' THEN
    UPDATE public.produtos SET is_active = true WHERE id = l.entity_id;
  ELSIF l.action = 'ban_user' THEN
    UPDATE public.profiles SET banned_until = NULL, ban_reason = NULL, ban_reason_public = NULL WHERE id = l.entity_id;
  ELSE
    RAISE EXCEPTION 'Esta ação não pode ser revertida automaticamente';
  END IF;

  UPDATE public.admin_logs SET reverted_by = auth.uid(), reverted_at = now() WHERE id = _log_id;
  INSERT INTO public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  VALUES (auth.uid(), 'revert:' || l.action, l.entity, l.entity_id, _reason,
          jsonb_build_object('reverted_log_id', l.id, 'original_action', l.action));
END $$;

-- ============ BLOCO E: listas N:N e diário ============
CREATE TABLE IF NOT EXISTS public.biblioteca_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nome text NOT NULL,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_listas TO authenticated;
GRANT ALL ON public.biblioteca_listas TO service_role;
ALTER TABLE public.biblioteca_listas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listas_owner ON public.biblioteca_listas;
CREATE POLICY listas_owner ON public.biblioteca_listas FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.biblioteca_lista_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id uuid NOT NULL REFERENCES public.biblioteca_listas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lista_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_lista_itens TO authenticated;
GRANT ALL ON public.biblioteca_lista_itens TO service_role;
ALTER TABLE public.biblioteca_lista_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lista_itens_owner ON public.biblioteca_lista_itens;
CREATE POLICY lista_itens_owner ON public.biblioteca_lista_itens FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_lista_itens_user_product ON public.biblioteca_lista_itens(user_id, product_id);

-- migra o valor de texto único existente
INSERT INTO public.biblioteca_listas (user_id, nome)
SELECT DISTINCT user_id, btrim(lista_custom) FROM public.biblioteca_usuario
WHERE lista_custom IS NOT NULL AND btrim(lista_custom) <> ''
ON CONFLICT (user_id, nome) DO NOTHING;

INSERT INTO public.biblioteca_lista_itens (lista_id, user_id, product_id)
SELECT l.id, b.user_id, b.product_id
FROM public.biblioteca_usuario b
JOIN public.biblioteca_listas l ON l.user_id = b.user_id AND l.nome = btrim(b.lista_custom)
WHERE b.lista_custom IS NOT NULL AND btrim(b.lista_custom) <> ''
ON CONFLICT (lista_id, product_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.biblioteca_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  product_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_diario TO authenticated;
GRANT ALL ON public.biblioteca_diario TO service_role;
ALTER TABLE public.biblioteca_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diario_owner ON public.biblioteca_diario;
CREATE POLICY diario_owner ON public.biblioteca_diario FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_diario_user_product ON public.biblioteca_diario(user_id, product_id, entry_date DESC);

-- ============ BLOCO F: soneca de notificação ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_snoozed_until timestamptz;