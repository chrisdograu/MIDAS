
-- ============================================
-- PHASE 2: XP + BADGES SYSTEM
-- ============================================

-- XP log
CREATE TABLE public.user_xp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  xp integer not null,
  reference_type text,
  reference_id uuid,
  awarded_date date not null default current_date,
  created_at timestamptz not null default now()
);

CREATE INDEX user_xp_log_user_idx ON public.user_xp_log(user_id);
CREATE UNIQUE INDEX user_xp_log_daily_unique
  ON public.user_xp_log(user_id, action, awarded_date)
  WHERE action NOT IN ('purchase','trade','tournament_win');

ALTER TABLE public.user_xp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view xp log" ON public.user_xp_log FOR SELECT USING (true);
CREATE POLICY "Admins manage xp log" ON public.user_xp_log FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Aggregate view
CREATE OR REPLACE VIEW public.user_xp_totals AS
SELECT user_id, COALESCE(SUM(xp),0)::int as total_xp, COUNT(*) as actions_count
FROM public.user_xp_log GROUP BY user_id;

GRANT SELECT ON public.user_xp_totals TO anon, authenticated;

-- Badge catalog
CREATE TABLE public.badge_catalog (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null default '🏆',
  category text not null default 'general',
  created_at timestamptz not null default now()
);

ALTER TABLE public.badge_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view badge catalog" ON public.badge_catalog FOR SELECT USING (true);
CREATE POLICY "Admins manage badge catalog" ON public.badge_catalog FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- User badges
CREATE TABLE public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  badge_id text not null references public.badge_catalog(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique(user_id, badge_id)
);

CREATE INDEX user_badges_user_idx ON public.user_badges(user_id);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Admins manage user badges" ON public.user_badges FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed badges
INSERT INTO public.badge_catalog(id,name,description,icon,category) VALUES
  ('store_1','Primeiro Passo','Primeira compra realizada','🛒','store'),
  ('store_5','Colecionador Iniciante','5 jogos comprados','📦','store'),
  ('store_10','Colecionador','10 jogos comprados','🎮','store'),
  ('store_25','Colecionador Veterano','25 jogos comprados','👑','store'),
  ('store_50','Mestre da Coleção','50 jogos comprados','💎','store'),
  ('reviewer_1','Crítico Iniciante','Primeira review escrita','✍️','community'),
  ('reviewer_10','Crítico','10 reviews escritas','🌟','community'),
  ('forum_starter','Membro do Fórum','Primeiro post no fórum','💬','community'),
  ('forum_active','Fórum Ativo','25 posts no fórum','🔥','community'),
  ('level_5','Nível 5','Alcançou o nível 5','⭐','level'),
  ('level_10','Nível 10','Alcançou o nível 10','🌠','level');

-- Award XP function (respects daily cap via unique index)
CREATE OR REPLACE FUNCTION public.award_xp(_user_id uuid, _action text, _xp int, _ref_type text DEFAULT NULL, _ref_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_xp_log(user_id, action, xp, reference_type, reference_id)
    VALUES (_user_id, _action, _xp, _ref_type, _ref_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;
END;$$;

-- Auto award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_purchases int; v_reviews int; v_posts int; v_xp int; v_level int;
BEGIN
  SELECT COUNT(*) INTO v_purchases FROM public.pedidos WHERE user_id=_user_id AND status IN ('confirmed','processing','shipped','delivered');
  SELECT COUNT(*) INTO v_reviews FROM public.avaliacoes WHERE user_id=_user_id;
  SELECT COUNT(*) INTO v_posts FROM public.forum_posts WHERE user_id=_user_id;
  SELECT COALESCE(SUM(xp),0) INTO v_xp FROM public.user_xp_log WHERE user_id=_user_id;
  v_level := GREATEST(1, FLOOR(SQRT(GREATEST(v_xp,0)::float / 100))::int + 1);

  IF v_purchases >= 1 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'store_1') ON CONFLICT DO NOTHING; END IF;
  IF v_purchases >= 5 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'store_5') ON CONFLICT DO NOTHING; END IF;
  IF v_purchases >= 10 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'store_10') ON CONFLICT DO NOTHING; END IF;
  IF v_purchases >= 25 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'store_25') ON CONFLICT DO NOTHING; END IF;
  IF v_purchases >= 50 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'store_50') ON CONFLICT DO NOTHING; END IF;
  IF v_reviews >= 1 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'reviewer_1') ON CONFLICT DO NOTHING; END IF;
  IF v_reviews >= 10 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'reviewer_10') ON CONFLICT DO NOTHING; END IF;
  IF v_posts >= 1 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'forum_starter') ON CONFLICT DO NOTHING; END IF;
  IF v_posts >= 25 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'forum_active') ON CONFLICT DO NOTHING; END IF;
  IF v_level >= 5 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'level_5') ON CONFLICT DO NOTHING; END IF;
  IF v_level >= 10 THEN INSERT INTO public.user_badges(user_id, badge_id) VALUES (_user_id, 'level_10') ON CONFLICT DO NOTHING; END IF;
END;$$;

-- Triggers
CREATE OR REPLACE FUNCTION public.trg_xp_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.award_xp(NEW.user_id, 'review', 25, 'avaliacao', NEW.id);
  PERFORM public.check_and_award_badges(NEW.user_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER xp_on_review AFTER INSERT ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.trg_xp_review();

CREATE OR REPLACE FUNCTION public.trg_xp_forum_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.award_xp(NEW.user_id, 'forum_post', 10, 'forum_post', NEW.id);
  PERFORM public.check_and_award_badges(NEW.user_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER xp_on_forum_post AFTER INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.trg_xp_forum_post();

CREATE OR REPLACE FUNCTION public.trg_xp_forum_reply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.award_xp(NEW.user_id, 'forum_reply', 5, 'forum_reply', NEW.id);
  PERFORM public.check_and_award_badges(NEW.user_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER xp_on_forum_reply AFTER INSERT ON public.forum_replies FOR EACH ROW EXECUTE FUNCTION public.trg_xp_forum_reply();

CREATE OR REPLACE FUNCTION public.trg_xp_purchase() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') AND NEW.user_id IS NOT NULL THEN
    PERFORM public.award_xp(NEW.user_id, 'purchase', GREATEST(50, FLOOR(NEW.total)::int), 'pedido', NEW.id);
    PERFORM public.check_and_award_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER xp_on_order_confirmed AFTER UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.trg_xp_purchase();

-- ============================================
-- PHASE 3: MODERATION HISTORY
-- ============================================

CREATE TABLE public.moderation_history (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  moderator_id uuid not null,
  action text not null,
  duration_days int,
  reason text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

CREATE INDEX moderation_history_target_idx ON public.moderation_history(target_user_id);
CREATE INDEX moderation_history_created_idx ON public.moderation_history(created_at DESC);

ALTER TABLE public.moderation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view mod history" ON public.moderation_history FOR SELECT
  USING (public.is_staff() OR auth.uid() = target_user_id);
CREATE POLICY "Staff insert mod history" ON public.moderation_history FOR INSERT
  WITH CHECK (public.is_staff() AND auth.uid() = moderator_id);
