
-- TOURNAMENTS
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'semanal',
  status text NOT NULL DEFAULT 'open',
  prize text,
  max_participants integer NOT NULL DEFAULT 16,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins manage tournaments" ON public.tournaments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view participants" ON public.tournament_participants FOR SELECT USING (true);
CREATE POLICY "Users join" ON public.tournament_participants FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_user_banned(auth.uid()));
CREATE POLICY "Users leave own" ON public.tournament_participants FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage participants" ON public.tournament_participants FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  player_a uuid,
  player_b uuid,
  score_a integer,
  score_b integer,
  winner uuid,
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view matches" ON public.tournament_matches FOR SELECT USING (true);
CREATE POLICY "Admins manage matches" ON public.tournament_matches FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- PRODUCT VIEWS (Em Alta)
CREATE TABLE IF NOT EXISTS public.product_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  user_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_views_product_idx ON public.product_views(product_id, viewed_at DESC);
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone insert view" ON public.product_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read views" ON public.product_views FOR SELECT USING (is_admin());

-- WISHLIST PRICE DROP NOTIFICATION
CREATE OR REPLACE FUNCTION public.notify_wishlist_price_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prev_price numeric;
  prod_title text;
  fav RECORD;
BEGIN
  SELECT price INTO prev_price FROM public.price_history
   WHERE product_id = NEW.product_id AND id <> NEW.id
   ORDER BY recorded_at DESC LIMIT 1;
  IF prev_price IS NULL OR NEW.price >= prev_price THEN RETURN NEW; END IF;
  SELECT title INTO prod_title FROM public.produtos WHERE id = NEW.product_id;
  FOR fav IN SELECT user_id FROM public.favoritos WHERE product_id = NEW.product_id LOOP
    INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
    VALUES (fav.user_id, 'nova_mensagem',
      '💸 Queda de preço!',
      format('"%s" caiu de R$ %s para R$ %s', COALESCE(prod_title,'jogo'), to_char(prev_price,'FM999990.00'), to_char(NEW.price,'FM999990.00')),
      'produto', NEW.product_id);
  END LOOP;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_wishlist_price_drop ON public.price_history;
CREATE TRIGGER trg_wishlist_price_drop
AFTER INSERT ON public.price_history
FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_price_drop();
