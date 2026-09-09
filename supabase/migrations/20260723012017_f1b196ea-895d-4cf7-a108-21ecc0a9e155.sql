
-- 100: denúncias com categoria e prioridade
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS cautionary_action text;
CREATE INDEX IF NOT EXISTS denuncias_priority_idx ON public.denuncias(priority, status);

-- 108: anúncios com jogos vinculados (fóruns)
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS forum_game_ids uuid[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.enforce_forum_game_ids_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.forum_game_ids IS NOT NULL AND array_length(NEW.forum_game_ids, 1) > 3 THEN
    RAISE EXCEPTION 'Máximo de 3 fóruns/jogos por anúncio';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_forum_game_ids_limit ON public.anuncios;
CREATE TRIGGER trg_forum_game_ids_limit BEFORE INSERT OR UPDATE ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_forum_game_ids_limit();

-- 109: reportar resultado de partida
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS reported_by uuid,
  ADD COLUMN IF NOT EXISTS reported_score_a integer,
  ADD COLUMN IF NOT EXISTS reported_score_b integer,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_open boolean NOT NULL DEFAULT false;

-- Estender permissões: além de admin, moderador do torneio pode atualizar
DROP POLICY IF EXISTS "match_update_admin_or_mod" ON public.tournament_matches;
CREATE POLICY "match_update_admin_or_mod" ON public.tournament_matches
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.tournament_moderators m WHERE m.tournament_id = tournament_matches.tournament_id AND m.user_id = auth.uid())
    OR auth.uid() = player_a OR auth.uid() = player_b
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.tournament_moderators m WHERE m.tournament_id = tournament_matches.tournament_id AND m.user_id = auth.uid())
    OR auth.uid() = player_a OR auth.uid() = player_b
  );

CREATE OR REPLACE FUNCTION public.report_match_result(
  _match_id uuid, _score_a integer, _score_b integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  IF auth.uid() NOT IN (m.player_a, m.player_b) THEN
    RAISE EXCEPTION 'Apenas jogadores da partida podem reportar';
  END IF;
  IF _score_a < 0 OR _score_b < 0 THEN RAISE EXCEPTION 'Placar inválido'; END IF;
  UPDATE public.tournament_matches
     SET reported_by = auth.uid(),
         reported_score_a = _score_a,
         reported_score_b = _score_b,
         reported_at = now()
   WHERE id = _match_id;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_match_result(_match_id uuid, _agree boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  IF auth.uid() NOT IN (m.player_a, m.player_b) OR auth.uid() = m.reported_by THEN
    RAISE EXCEPTION 'Apenas o outro jogador pode confirmar';
  END IF;
  IF _agree THEN
    UPDATE public.tournament_matches
       SET score_a = reported_score_a,
           score_b = reported_score_b,
           winner = CASE WHEN reported_score_a > reported_score_b THEN player_a
                         WHEN reported_score_b > reported_score_a THEN player_b
                         ELSE NULL END,
           status = 'completed',
           ended_at = now(),
           dispute_open = false
     WHERE id = _match_id;
  ELSE
    UPDATE public.tournament_matches SET dispute_open = true WHERE id = _match_id;
  END IF;
END; $$;

-- 105: conversa automática entre adversários
CREATE OR REPLACE FUNCTION public.ensure_match_conversation(_match_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; conv_id uuid; a uuid; b uuid;
BEGIN
  SELECT * INTO m FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND OR m.player_a IS NULL OR m.player_b IS NULL THEN
    RAISE EXCEPTION 'Partida inválida';
  END IF;
  IF auth.uid() NOT IN (m.player_a, m.player_b)
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.tournament_moderators tm WHERE tm.tournament_id = m.tournament_id AND tm.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT id INTO conv_id FROM public.conversas WHERE match_id = _match_id LIMIT 1;
  IF conv_id IS NOT NULL THEN RETURN conv_id; END IF;
  a := LEAST(m.player_a, m.player_b);
  b := GREATEST(m.player_a, m.player_b);
  INSERT INTO public.conversas (participant_1, participant_2, tournament_id, match_id, channel, status, category)
  VALUES (a, b, m.tournament_id, _match_id, 'tournament_match', 'accepted', 'personal')
  RETURNING id INTO conv_id;
  RETURN conv_id;
END; $$;

-- 111: validação Black Fraude
CREATE OR REPLACE FUNCTION public.validate_discount_price(_produto_id uuid, _preco_atual numeric, _preco_original numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE min30 numeric; declared_disc numeric; real_disc numeric;
BEGIN
  SELECT MIN(price) INTO min30 FROM public.price_history
   WHERE produto_id = _produto_id AND created_at >= now() - interval '30 days';
  IF min30 IS NULL THEN min30 := _preco_original; END IF;
  declared_disc := CASE WHEN _preco_original > 0 THEN 1 - (_preco_atual / _preco_original) ELSE 0 END;
  real_disc := CASE WHEN min30 > 0 THEN 1 - (_preco_atual / min30) ELSE 0 END;
  RETURN jsonb_build_object(
    'min_price_30d', min30,
    'declared_discount', declared_disc,
    'real_discount', real_disc,
    'suspicious', declared_disc - real_disc > 0.1
  );
END; $$;

-- 113: confirmação de prêmio de torneio
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS prize_confirmed boolean NOT NULL DEFAULT false;

-- 116/117: rate limit genérico
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, key, window_start)
);
GRANT SELECT ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rl_own" ON public.rate_limits FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.hit_rate_limit(_key text, _limit integer, _window_secs integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur integer; wstart timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RETURN true; END IF;
  wstart := date_trunc('second', now()) - ((extract(epoch from now())::bigint % _window_secs) || ' seconds')::interval;
  INSERT INTO public.rate_limits (user_id, key, window_start, count)
    VALUES (auth.uid(), _key, wstart, 1)
    ON CONFLICT (user_id, key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count INTO cur;
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  RETURN cur <= _limit;
END; $$;

-- 122: contador de penalidades em torneio
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tournament_penalty_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tournament_penalty_skip_remaining integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_tournament_penalty(_user_id uuid, _skip_next integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente admin'; END IF;
  UPDATE public.profiles
     SET tournament_penalty_count = tournament_penalty_count + 1,
         tournament_penalty_skip_remaining = GREATEST(tournament_penalty_skip_remaining, _skip_next)
   WHERE id = _user_id;
END; $$;

-- Trava na inscrição em torneio se skip_remaining > 0
CREATE OR REPLACE FUNCTION public.enforce_tournament_skip()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE remaining integer;
BEGIN
  SELECT tournament_penalty_skip_remaining INTO remaining FROM public.profiles WHERE id = NEW.user_id;
  IF remaining IS NOT NULL AND remaining > 0 THEN
    UPDATE public.profiles SET tournament_penalty_skip_remaining = remaining - 1 WHERE id = NEW.user_id;
    RAISE EXCEPTION 'Você está temporariamente impedido de participar de torneios (restam % pular)', remaining;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enforce_tournament_skip ON public.tournament_participants;
CREATE TRIGGER trg_enforce_tournament_skip BEFORE INSERT ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tournament_skip();
