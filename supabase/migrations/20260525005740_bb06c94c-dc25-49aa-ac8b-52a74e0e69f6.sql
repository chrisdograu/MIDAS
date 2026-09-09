
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_bio text,
  ADD COLUMN IF NOT EXISTS require_follow_approval boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id),
  CHECK (requester_id <> target_id)
);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own follow requests"
  ON public.follow_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "create own follow requests"
  ON public.follow_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "target deletes follow requests"
  ON public.follow_requests FOR DELETE TO authenticated
  USING (auth.uid() = target_id OR auth.uid() = requester_id);

CREATE INDEX IF NOT EXISTS idx_follow_req_target ON public.follow_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_follow_req_requester ON public.follow_requests(requester_id);

-- Notify target on new request
CREATE OR REPLACE FUNCTION public.handle_follow_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_approval boolean;
BEGIN
  SELECT require_follow_approval INTO req_approval FROM public.profiles WHERE id = NEW.target_id;
  IF NOT COALESCE(req_approval, false) THEN
    -- Auto-accept: create follow and skip request row
    INSERT INTO public.user_follows(follower_id, following_id)
    VALUES (NEW.requester_id, NEW.target_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.target_id, 'novo_seguidor', 'Você tem um novo seguidor 🎮',
            'Alguém começou a seguir seu perfil na MIDIAS', 'profile', NEW.requester_id);
    RETURN NULL; -- cancel insertion
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
  VALUES (NEW.target_id, 'novo_seguidor', '🔔 Novo pedido para te seguir',
          'Aprove ou recuse na aba Amigos > Solicitações', 'profile', NEW.requester_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_request ON public.follow_requests;
CREATE TRIGGER trg_follow_request
  BEFORE INSERT ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_request();

-- RPC to accept a follow request
CREATE OR REPLACE FUNCTION public.accept_follow_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.follow_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF r.target_id <> auth.uid() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  INSERT INTO public.user_follows(follower_id, following_id)
  VALUES (r.requester_id, r.target_id)
  ON CONFLICT DO NOTHING;
  DELETE FROM public.follow_requests WHERE id = _request_id;
  INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
  VALUES (r.requester_id, 'novo_seguidor', '✅ Pedido aceito',
          'Seu pedido para seguir foi aceito', 'profile', r.target_id);
END;
$$;
