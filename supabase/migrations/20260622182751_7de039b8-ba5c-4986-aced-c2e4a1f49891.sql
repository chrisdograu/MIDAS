
DO $$ BEGIN
  CREATE TYPE public.reward_kind AS ENUM (
    'avatar_frame','profile_banner','profile_accent',
    'game_card_skin','game_page_theme','character_icon','sticker'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reward_rarity AS ENUM ('common','rare','epic','legendary','mythic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.game_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  kind public.reward_kind NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  asset_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlock_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  rarity public.reward_rarity NOT NULL DEFAULT 'common',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_rewards TO anon, authenticated;
GRANT ALL ON public.game_rewards TO service_role;
ALTER TABLE public.game_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_rewards visible to all" ON public.game_rewards FOR SELECT USING (true);
CREATE POLICY "admins manage game_rewards" ON public.game_rewards FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER game_rewards_updated_at BEFORE UPDATE ON public.game_rewards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX IF NOT EXISTS idx_game_rewards_product ON public.game_rewards(product_id);
CREATE INDEX IF NOT EXISTS idx_game_rewards_kind ON public.game_rewards(kind);

CREATE TABLE IF NOT EXISTS public.user_game_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES public.game_rewards(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_id)
);
GRANT SELECT, INSERT ON public.user_game_rewards TO authenticated;
GRANT SELECT ON public.user_game_rewards TO anon;
GRANT ALL ON public.user_game_rewards TO service_role;
ALTER TABLE public.user_game_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_game_rewards readable" ON public.user_game_rewards FOR SELECT USING (true);
CREATE POLICY "user_game_rewards insert own" ON public.user_game_rewards FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_user_game_rewards_user ON public.user_game_rewards(user_id);

CREATE TABLE IF NOT EXISTS public.user_cosmetic_loadout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slot TEXT NOT NULL,
  reward_id UUID REFERENCES public.game_rewards(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slot)
);
GRANT SELECT ON public.user_cosmetic_loadout TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_cosmetic_loadout TO authenticated;
GRANT ALL ON public.user_cosmetic_loadout TO service_role;
ALTER TABLE public.user_cosmetic_loadout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loadout readable" ON public.user_cosmetic_loadout FOR SELECT USING (true);
CREATE POLICY "loadout manage own" ON public.user_cosmetic_loadout FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_game_page_loadout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  reward_id UUID REFERENCES public.game_rewards(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, slot)
);
GRANT SELECT ON public.user_game_page_loadout TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_game_page_loadout TO authenticated;
GRANT ALL ON public.user_game_page_loadout TO service_role;
ALTER TABLE public.user_game_page_loadout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_loadout readable" ON public.user_game_page_loadout FOR SELECT USING (true);
CREATE POLICY "page_loadout manage own" ON public.user_game_page_loadout FOR ALL
USING (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.biblioteca_usuario b WHERE b.user_id = auth.uid() AND b.product_id = user_game_page_loadout.product_id)
) WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.biblioteca_usuario b WHERE b.user_id = auth.uid() AND b.product_id = user_game_page_loadout.product_id)
);

CREATE OR REPLACE FUNCTION public.check_game_reward_unlocks(_user_id UUID, _product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD; c JSONB; ctype TEXT; ok BOOLEAN;
  v_int INT; v_num NUMERIC; prod_title TEXT;
  total_ach INT; earned_ach INT;
BEGIN
  IF _user_id IS NULL OR _product_id IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.biblioteca_usuario WHERE user_id = _user_id AND product_id = _product_id) THEN
    RETURN;
  END IF;
  SELECT title INTO prod_title FROM public.produtos WHERE id = _product_id;

  FOR r IN
    SELECT gr.* FROM public.game_rewards gr
    WHERE gr.product_id = _product_id AND gr.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.user_game_rewards ugr WHERE ugr.user_id = _user_id AND ugr.reward_id = gr.id)
  LOOP
    c := r.unlock_criteria; ctype := c->>'type'; ok := false;

    IF ctype = 'library_owned' THEN
      ok := true;
    ELSIF ctype = 'completed' THEN
      ok := EXISTS (SELECT 1 FROM public.biblioteca_usuario
                    WHERE user_id = _user_id AND product_id = _product_id
                      AND (status IN ('zerado','platinado') OR badge_completed = true));
    ELSIF ctype = 'platinum' THEN
      ok := EXISTS (SELECT 1 FROM public.biblioteca_usuario
                    WHERE user_id = _user_id AND product_id = _product_id
                      AND (status = 'platinado' OR badge_platinum = true));
    ELSIF ctype = 'playtime' THEN
      v_num := COALESCE((c->>'min_hours')::numeric, 0);
      ok := EXISTS (SELECT 1 FROM public.biblioteca_usuario
                    WHERE user_id = _user_id AND product_id = _product_id AND COALESCE(hours_played,0) >= v_num)
         OR EXISTS (SELECT 1 FROM public.user_playtime
                    WHERE user_id = _user_id AND product_id = _product_id AND COALESCE(hours_played,0) >= v_num);
    ELSIF ctype = 'reviews_for_game' THEN
      SELECT COUNT(*) INTO v_int FROM public.avaliacoes WHERE user_id = _user_id AND product_id = _product_id;
      ok := v_int >= COALESCE((c->>'count')::int, 1);
    ELSIF ctype = 'forum_posts_for_game' THEN
      SELECT COUNT(*) INTO v_int FROM public.forum_posts WHERE user_id = _user_id AND product_id = _product_id;
      ok := v_int >= COALESCE((c->>'count')::int, 1);
    ELSIF ctype = 'forum_post_likes' THEN
      v_int := COALESCE((c->>'min_likes')::int, 10);
      ok := EXISTS (SELECT 1 FROM public.forum_posts
                    WHERE user_id = _user_id AND product_id = _product_id AND COALESCE(likes_count,0) >= v_int);
    ELSIF ctype = 'review_likes' THEN
      v_int := COALESCE((c->>'min_likes')::int, 10);
      ok := EXISTS (SELECT 1 FROM public.avaliacoes a
                    WHERE a.user_id = _user_id AND a.product_id = _product_id
                      AND (SELECT COUNT(*) FROM public.review_likes rl WHERE rl.review_id = a.id) >= v_int);
    ELSIF ctype = 'screenshots_for_game' THEN
      SELECT COUNT(*) INTO v_int FROM public.game_screenshots WHERE user_id = _user_id AND product_id = _product_id;
      ok := v_int >= COALESCE((c->>'count')::int, 1);
    ELSIF ctype = 'clips_for_game' THEN
      SELECT COUNT(*) INTO v_int FROM public.game_clips WHERE user_id = _user_id AND product_id = _product_id;
      ok := v_int >= COALESCE((c->>'count')::int, 1);
    ELSIF ctype = 'achievement' THEN
      ok := EXISTS (SELECT 1 FROM public.user_achievements
                    WHERE user_id = _user_id
                      AND (achievement_name = c->>'achievement_name' OR id::text = c->>'achievement_id'));
    ELSIF ctype = 'all_achievements' THEN
      SELECT COUNT(*) INTO total_ach FROM public.user_achievements WHERE product_id = _product_id;
      SELECT COUNT(*) INTO earned_ach FROM public.user_achievements WHERE product_id = _product_id AND user_id = _user_id;
      ok := total_ach > 0 AND earned_ach >= total_ach;
    END IF;

    IF ok THEN
      INSERT INTO public.user_game_rewards(user_id, reward_id)
      VALUES (_user_id, r.id) ON CONFLICT DO NOTHING;
      INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
      VALUES (_user_id, 'nova_mensagem', '🎁 Cosmético desbloqueado!',
        format('Você desbloqueou "%s" em %s', r.name, COALESCE(prod_title,'um jogo')),
        'produto', _product_id);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_check_rewards_biblioteca() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN PERFORM public.check_game_reward_unlocks(NEW.user_id, NEW.product_id); RETURN NEW; END $f$;

CREATE OR REPLACE FUNCTION public.trg_check_rewards_review() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN PERFORM public.check_game_reward_unlocks(NEW.user_id, NEW.product_id); RETURN NEW; END $f$;

CREATE OR REPLACE FUNCTION public.trg_check_rewards_forum_post() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN IF NEW.product_id IS NOT NULL THEN PERFORM public.check_game_reward_unlocks(NEW.user_id, NEW.product_id); END IF; RETURN NEW; END $f$;

CREATE OR REPLACE FUNCTION public.trg_check_rewards_achievement() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN IF NEW.product_id IS NOT NULL THEN PERFORM public.check_game_reward_unlocks(NEW.user_id, NEW.product_id); END IF; RETURN NEW; END $f$;

CREATE OR REPLACE FUNCTION public.trg_check_rewards_playtime() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN PERFORM public.check_game_reward_unlocks(NEW.user_id, NEW.product_id); RETURN NEW; END $f$;

CREATE OR REPLACE FUNCTION public.trg_check_rewards_clip_screenshot() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN PERFORM public.check_game_reward_unlocks(NEW.user_id, NEW.product_id); RETURN NEW; END $f$;

DROP TRIGGER IF EXISTS check_rewards_on_biblioteca ON public.biblioteca_usuario;
CREATE TRIGGER check_rewards_on_biblioteca
AFTER INSERT OR UPDATE OF status, hours_played, badge_completed, badge_platinum ON public.biblioteca_usuario
FOR EACH ROW EXECUTE FUNCTION public.trg_check_rewards_biblioteca();

DROP TRIGGER IF EXISTS check_rewards_on_review ON public.avaliacoes;
CREATE TRIGGER check_rewards_on_review
AFTER INSERT OR UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_check_rewards_review();

DROP TRIGGER IF EXISTS check_rewards_on_forum_post ON public.forum_posts;
CREATE TRIGGER check_rewards_on_forum_post
AFTER INSERT OR UPDATE OF likes_count ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.trg_check_rewards_forum_post();

DROP TRIGGER IF EXISTS check_rewards_on_achievement ON public.user_achievements;
CREATE TRIGGER check_rewards_on_achievement
AFTER INSERT ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.trg_check_rewards_achievement();

DROP TRIGGER IF EXISTS check_rewards_on_playtime ON public.user_playtime;
CREATE TRIGGER check_rewards_on_playtime
AFTER INSERT OR UPDATE ON public.user_playtime
FOR EACH ROW EXECUTE FUNCTION public.trg_check_rewards_playtime();

DROP TRIGGER IF EXISTS check_rewards_on_screenshot ON public.game_screenshots;
CREATE TRIGGER check_rewards_on_screenshot
AFTER INSERT ON public.game_screenshots
FOR EACH ROW EXECUTE FUNCTION public.trg_check_rewards_clip_screenshot();

DROP TRIGGER IF EXISTS check_rewards_on_clip ON public.game_clips;
CREATE TRIGGER check_rewards_on_clip
AFTER INSERT ON public.game_clips
FOR EACH ROW EXECUTE FUNCTION public.trg_check_rewards_clip_screenshot();
