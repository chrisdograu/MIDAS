-- Enum status
DO $$ BEGIN
  CREATE TYPE public.suggestion_status AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela
CREATE TABLE IF NOT EXISTS public.game_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cover_url text,
  description text,
  requested_by uuid NOT NULL,
  status public.suggestion_status NOT NULL DEFAULT 'pendente',
  admin_notes text,
  created_product_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS
DROP POLICY IF EXISTS "Users can create suggestions" ON public.game_suggestions;
CREATE POLICY "Users can create suggestions"
  ON public.game_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requested_by AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can view own suggestions" ON public.game_suggestions;
CREATE POLICY "Users can view own suggestions"
  ON public.game_suggestions FOR SELECT TO authenticated
  USING (auth.uid() = requested_by);

DROP POLICY IF EXISTS "Admins manage suggestions" ON public.game_suggestions;
CREATE POLICY "Admins manage suggestions"
  ON public.game_suggestions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can view suggestions" ON public.game_suggestions;
CREATE POLICY "Staff can view suggestions"
  ON public.game_suggestions FOR SELECT TO authenticated
  USING (public.is_staff());

-- updated_at
DROP TRIGGER IF EXISTS trg_game_suggestions_updated_at ON public.game_suggestions;
CREATE TRIGGER trg_game_suggestions_updated_at
  BEFORE UPDATE ON public.game_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Notificação
CREATE OR REPLACE FUNCTION public.notify_game_suggestion_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.requested_by, 'nova_mensagem', '🎮 Sua sugestão foi aprovada!',
            format('"%s" foi adicionado ao catálogo.', NEW.title),
            'game_suggestion', NEW.id);
  ELSIF NEW.status = 'rejeitado' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.requested_by, 'nova_mensagem', 'Sugestão de jogo não aprovada',
            COALESCE(NEW.admin_notes, format('"%s" não foi aprovada pela equipe.', NEW.title)),
            'game_suggestion', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_game_suggestion ON public.game_suggestions;
CREATE TRIGGER trg_notify_game_suggestion
  AFTER UPDATE ON public.game_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.notify_game_suggestion_update();

CREATE INDEX IF NOT EXISTS idx_game_suggestions_status ON public.game_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_game_suggestions_requested_by ON public.game_suggestions(requested_by);