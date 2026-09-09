
-- ============== BADGES & TÍTULOS ==============
ALTER TABLE public.badge_catalog
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS public.user_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source text NOT NULL DEFAULT 'achievement', -- 'achievement' | 'xp'
  tournament_id uuid,
  awarded_by uuid,
  awarded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view titles" ON public.user_titles FOR SELECT USING (true);
CREATE POLICY "Admins manage titles" ON public.user_titles FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_title_id uuid;

-- ============== TORNEIOS ==============
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS xp_signup int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS xp_match_win int NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS xp_champion int NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prize_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prize_game_id uuid,
  ADD COLUMN IF NOT EXISTS prize_coupon_id uuid,
  ADD COLUMN IF NOT EXISTS prize_badge_id text,
  ADD COLUMN IF NOT EXISTS prize_title text,
  ADD COLUMN IF NOT EXISTS prize_xp_bonus int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rewards_distributed boolean NOT NULL DEFAULT false;

ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS final_rank int,
  ADD COLUMN IF NOT EXISTS signup_ip inet,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.tournament_duplicate_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  user_ids uuid[] NOT NULL,
  reason text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournament_duplicate_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage dup alerts" ON public.tournament_duplicate_alerts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Função: calcula XP a partir do tamanho
CREATE OR REPLACE FUNCTION public.calc_tournament_xp(_max_participants int)
RETURNS TABLE(xp_signup int, xp_match_win int, xp_champion int)
LANGUAGE sql IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN _max_participants <= 8 THEN 30
      WHEN _max_participants <= 16 THEN 40
      WHEN _max_participants <= 32 THEN 55
      WHEN _max_participants <= 64 THEN 70
      ELSE 90
    END,
    CASE
      WHEN _max_participants <= 8 THEN 100
      WHEN _max_participants <= 16 THEN 130
      WHEN _max_participants <= 32 THEN 170
      WHEN _max_participants <= 64 THEN 220
      ELSE 280
    END,
    CASE
      WHEN _max_participants <= 8 THEN 500
      WHEN _max_participants <= 16 THEN 650
      WHEN _max_participants <= 32 THEN 850
      WHEN _max_participants <= 64 THEN 1100
      ELSE 1400
    END;
$$;

-- Trigger: preenche XP automaticamente
CREATE OR REPLACE FUNCTION public.set_tournament_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.calc_tournament_xp(COALESCE(NEW.max_participants, 8));
  NEW.xp_signup := r.xp_signup;
  NEW.xp_match_win := r.xp_match_win;
  NEW.xp_champion := r.xp_champion;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_tournament_xp ON public.tournaments;
CREATE TRIGGER trg_set_tournament_xp BEFORE INSERT OR UPDATE OF max_participants ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.set_tournament_xp();

-- Função: distribui recompensas (admin chama)
CREATE OR REPLACE FUNCTION public.award_tournament_rewards(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  p record;
  pct numeric;
  xp_award int;
  badge_id text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas admins'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = _tournament_id;
  IF NOT FOUND OR t.rewards_distributed THEN RETURN; END IF;

  FOR p IN SELECT * FROM public.tournament_participants
           WHERE tournament_id = _tournament_id AND final_rank BETWEEN 1 AND 3
           ORDER BY final_rank
  LOOP
    pct := CASE p.final_rank WHEN 1 THEN 1.0 WHEN 2 THEN 0.6 ELSE 0.35 END;
    xp_award := FLOOR((t.xp_champion + COALESCE(t.prize_xp_bonus,0)) * pct);
    PERFORM public.award_xp(p.user_id, 'tournament_rank_' || p.final_rank, xp_award, 'tournament', t.id);

    badge_id := CASE p.final_rank WHEN 1 THEN 'tourn_gold' WHEN 2 THEN 'tourn_silver' ELSE 'tourn_bronze' END;
    INSERT INTO public.badge_catalog(id, name, description, icon, category)
    VALUES (badge_id,
      CASE p.final_rank WHEN 1 THEN 'Campeão' WHEN 2 THEN 'Vice-Campeão' ELSE '3º Lugar' END,
      'Conquistado em torneio oficial', 
      CASE p.final_rank WHEN 1 THEN '🥇' WHEN 2 THEN '🥈' ELSE '🥉' END,
      'tournament')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_badges(user_id, badge_id) VALUES (p.user_id, badge_id) ON CONFLICT DO NOTHING;

    IF p.final_rank = 1 AND t.prize_title IS NOT NULL THEN
      INSERT INTO public.user_titles(user_id, name, source, tournament_id, awarded_by)
      VALUES (p.user_id, t.prize_title, 'achievement', t.id, auth.uid());
    END IF;
  END LOOP;

  UPDATE public.tournaments SET rewards_distributed = true WHERE id = _tournament_id;
END $$;

-- ============== CHAT DE TORNEIO ==============
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS tournament_id uuid,
  ADD COLUMN IF NOT EXISTS match_id uuid,
  ADD COLUMN IF NOT EXISTS is_admin_chat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_auto boolean NOT NULL DEFAULT false;

ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS tournament_id uuid,
  ADD COLUMN IF NOT EXISTS match_id uuid,
  ADD COLUMN IF NOT EXISTS is_admin_chat boolean NOT NULL DEFAULT false;

-- Validação de tamanho + anti-flood
CREATE OR REPLACE FUNCTION public.validate_message_and_ratelimit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recent_count int;
BEGIN
  IF length(COALESCE(NEW.content,'')) > 2000 THEN
    RAISE EXCEPTION 'Mensagem excede 2000 caracteres';
  END IF;
  SELECT COUNT(*) INTO recent_count FROM public.mensagens
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '60 seconds';
  IF recent_count >= 30 THEN
    NEW.flagged_auto := true;
    UPDATE public.profiles SET banned_until = now() + interval '90 days' WHERE id = NEW.sender_id;
    INSERT INTO public.notifications(user_id, type, title, body)
    SELECT id, 'nova_mensagem', '⚠️ Comportamento de flood detectado', 'Conta suspensa automaticamente'
    FROM public.profiles WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');
    RAISE EXCEPTION 'Rate limit excedido — conta suspensa por flood';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_message ON public.mensagens;
CREATE TRIGGER trg_validate_message BEFORE INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.validate_message_and_ratelimit();

-- ============== BIBLIOTECA ==============
ALTER TABLE public.biblioteca_usuario
  ADD COLUMN IF NOT EXISTS personal_note text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_biblioteca_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_touch_biblioteca ON public.biblioteca_usuario;
CREATE TRIGGER trg_touch_biblioteca BEFORE UPDATE ON public.biblioteca_usuario
FOR EACH ROW EXECUTE FUNCTION public.touch_biblioteca_status();

-- Realtime para torneios
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
