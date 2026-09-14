ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS hide_adult_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_saver_mode boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pause_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  UPDATE public.profiles
     SET is_paused = true, paused_at = now()
   WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  UPDATE public.profiles
     SET is_paused = false, paused_at = NULL
   WHERE id = auth.uid() AND is_paused = true;
END;
$$;

CREATE TABLE IF NOT EXISTS public.login_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.login_history TO authenticated;
GRANT ALL ON public.login_history TO service_role;

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own login history" ON public.login_history;
CREATE POLICY "Users view own login history"
  ON public.login_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own login history" ON public.login_history;
CREATE POLICY "Users insert own login history"
  ON public.login_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_login_history_user_time
  ON public.login_history (user_id, logged_in_at DESC);

CREATE OR REPLACE FUNCTION public.record_login(_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  BEGIN
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  EXCEPTION WHEN others THEN
    v_ip := NULL;
  END;
  INSERT INTO public.login_history (user_id, ip_address, user_agent)
  VALUES (auth.uid(), nullif(v_ip, ''), _user_agent);
END;
$$;