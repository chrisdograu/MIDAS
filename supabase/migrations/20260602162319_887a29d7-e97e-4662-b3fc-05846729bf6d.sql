
CREATE TABLE public.reviews_completas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  analise text NOT NULL,
  horas_jogadas integer,
  plataforma text,
  dificuldade text,
  personagens_favoritos text,
  trilha_sonora_favorita text,
  momentos_favoritos text,
  pros text[],
  contras text[],
  recomendacao text,
  status text,
  tags_emocionais text[],
  visibility text NOT NULL DEFAULT 'friends',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews_completas TO authenticated;
GRANT ALL ON public.reviews_completas TO service_role;

ALTER TABLE public.reviews_completas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own review completa"
ON public.reviews_completas FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Friends can view review completa"
ON public.reviews_completas FOR SELECT TO authenticated
USING (public.can_view_friend_content(user_id, auth.uid(), visibility));

CREATE POLICY "Admins manage reviews completas"
ON public.reviews_completas FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX idx_reviews_completas_product ON public.reviews_completas(product_id);
CREATE INDEX idx_reviews_completas_user ON public.reviews_completas(user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_reviews_completas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_reviews_completas_updated_at
BEFORE UPDATE ON public.reviews_completas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_reviews_completas();

CREATE OR REPLACE FUNCTION public.notify_friends_review_completa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  friend_record record;
  game_title text;
  author_name text;
BEGIN
  IF NEW.visibility = 'private' THEN RETURN NEW; END IF;
  SELECT title INTO game_title FROM public.produtos WHERE id = NEW.product_id;
  SELECT display_name INTO author_name FROM public.profiles WHERE id = NEW.user_id;
  FOR friend_record IN SELECT friend_id FROM public.get_mutual_friends(NEW.user_id) LOOP
    INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (
      friend_record.friend_id,
      'nova_mensagem',
      'Nova Review Completa',
      COALESCE(author_name, 'Um amigo') || ' publicou uma review completa de ' || COALESCE(game_title, 'um jogo'),
      NEW.id,
      'review_completa'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_friends_review_completa
AFTER INSERT ON public.reviews_completas
FOR EACH ROW EXECUTE FUNCTION public.notify_friends_review_completa();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS gamer_personality text,
  ADD COLUMN IF NOT EXISTS favorite_genres text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_game_id uuid,
  ADD COLUMN IF NOT EXISTS monthly_favorites uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS backlog_note text;
