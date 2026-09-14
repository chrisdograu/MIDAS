
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS adult_transitioned_at timestamptz;

CREATE TABLE IF NOT EXISTS public.guardian_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guardian_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guardian_cpf text NOT NULL,
  guardian_phone text NOT NULL,
  guardian_full_name text NOT NULL,
  atestado_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guardian_link_requests_status ON public.guardian_link_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_link_requests_minor ON public.guardian_link_requests(minor_id);

GRANT SELECT, INSERT, UPDATE ON public.guardian_link_requests TO authenticated;
GRANT ALL ON public.guardian_link_requests TO service_role;

ALTER TABLE public.guardian_link_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minor sees own guardian request" ON public.guardian_link_requests
  FOR SELECT TO authenticated USING (auth.uid() = minor_id OR auth.uid() = guardian_id OR public.is_staff());
CREATE POLICY "minor inserts own guardian request" ON public.guardian_link_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = minor_id);
CREATE POLICY "staff updates guardian request" ON public.guardian_link_requests
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TRIGGER trg_guardian_link_requests_updated
  BEFORE UPDATE ON public.guardian_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.chat_ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid,
  conversation_id uuid,
  minor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  snippet text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed_safe','reviewed_action')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_ai_alerts_status ON public.chat_ai_alerts(status, severity, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.chat_ai_alerts TO authenticated;
GRANT ALL ON public.chat_ai_alerts TO service_role;
ALTER TABLE public.chat_ai_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads chat ai alerts" ON public.chat_ai_alerts
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff updates chat ai alerts" ON public.chat_ai_alerts
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "no direct insert alerts" ON public.chat_ai_alerts
  FOR INSERT TO authenticated WITH CHECK (false);

-- Badge "Conta Verificada" (id text, sem slug)
INSERT INTO public.badge_catalog (id, name, description, icon, category)
VALUES ('conta-verificada','Conta Verificada','Idade real confirmada via responsável verificado.','✅','trust')
ON CONFLICT (id) DO NOTHING;

-- submit_guardian_link
CREATE OR REPLACE FUNCTION public.submit_guardian_link(
  _cpf text, _phone text, _full_name text, _atestado_url text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(coalesce(_cpf,'')) < 11 THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  IF length(coalesce(_phone,'')) < 8 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
  IF length(coalesce(_full_name,'')) < 3 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF length(coalesce(_atestado_url,'')) < 8 THEN RAISE EXCEPTION 'Atestado obrigatório'; END IF;
  INSERT INTO public.guardian_link_requests(minor_id, guardian_cpf, guardian_phone, guardian_full_name, atestado_url)
  VALUES (_uid, _cpf, _phone, _full_name, _atestado_url) RETURNING id INTO _id;
  INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
  SELECT ur.user_id, 'nova_mensagem', 'Novo pedido de vínculo de responsável',
         'Verificar CPF/telefone/atestado', 'guardian_link', _id
  FROM public.user_roles ur WHERE ur.role IN ('admin','atendente');
  RETURN _id;
END $$;

-- admin_review_guardian_link
CREATE OR REPLACE FUNCTION public.admin_review_guardian_link(_id uuid, _approve boolean, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.guardian_link_requests;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.guardian_link_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'pedido inválido'; END IF;

  IF _approve THEN
    UPDATE public.guardian_link_requests
       SET status='approved', reviewed_by=auth.uid(), reviewed_at=now(), reason=_reason
     WHERE id=_id;
    UPDATE public.profiles
       SET is_verified_account = true,
           verified_at = COALESCE(verified_at, now()),
           age_verified = true
     WHERE id = r.minor_id;
    INSERT INTO public.user_badges(user_id, badge_id)
    VALUES (r.minor_id, 'conta-verificada') ON CONFLICT DO NOTHING;
    INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
    VALUES (r.minor_id, 'nova_mensagem', '✅ Responsável verificado',
            'Seu responsável foi validado. Conta marcada como Verificada.', 'guardian_link', _id);
  ELSE
    UPDATE public.guardian_link_requests
       SET status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), reason=_reason
     WHERE id=_id;
    INSERT INTO public.notifications(user_id, type, title, body, reference_type, reference_id)
    VALUES (r.minor_id, 'nova_mensagem', '❌ Vínculo de responsável recusado',
            COALESCE(_reason,'Documentação inválida'), 'guardian_link', _id);
  END IF;
END $$;

-- promote_minors_to_adults
CREATE OR REPLACE FUNCTION public.promote_minors_to_adults()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected int := 0;
BEGIN
  WITH promoted AS (
    UPDATE public.profiles
       SET chat_privacy_mode = 'friends_direct',
           minor_chat_approval_mode = 'notify',
           adult_transitioned_at = now(),
           minor_chat_level = NULL
     WHERE birth_date IS NOT NULL
       AND birth_date <= (now() - interval '18 years')::date
       AND adult_transitioned_at IS NULL
       AND (minor_chat_level IS NOT NULL OR guardian_user_id IS NOT NULL)
    RETURNING id
  )
  SELECT count(*) INTO affected FROM promoted;
  RETURN affected;
END $$;

-- enqueue_chat_ai_alert (chamado por edge function ou staff)
CREATE OR REPLACE FUNCTION public.enqueue_chat_ai_alert(
  _message_id uuid, _conversation_id uuid, _minor uuid, _peer uuid,
  _kind text, _severity text, _snippet text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.chat_ai_alerts(message_id, conversation_id, minor_id, peer_id, kind, severity, snippet)
  VALUES (_message_id, _conversation_id, _minor, _peer, _kind, COALESCE(_severity,'medium'), _snippet)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.review_chat_ai_alert(_id uuid, _safe boolean, _action text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.chat_ai_alerts
     SET status = CASE WHEN _safe THEN 'reviewed_safe' ELSE 'reviewed_action' END,
         reviewed_by = auth.uid(), reviewed_at = now(), action_taken = _action
   WHERE id = _id;
END $$;

-- Trigger que garante badge quando is_verified_account vira true
CREATE OR REPLACE FUNCTION public.on_age_verified_grant_badge()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_verified_account = true AND (OLD.is_verified_account IS DISTINCT FROM true) THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    VALUES (NEW.id, 'conta-verificada') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_on_age_verified ON public.profiles;
CREATE TRIGGER trg_on_age_verified
  AFTER UPDATE OF is_verified_account ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_age_verified_grant_badge();

-- Agenda diária (best-effort)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='promote-minors-daily') THEN
      PERFORM cron.unschedule('promote-minors-daily');
    END IF;
    PERFORM cron.schedule('promote-minors-daily','5 3 * * *','SELECT public.promote_minors_to_adults();');
  END IF;
END $$;
