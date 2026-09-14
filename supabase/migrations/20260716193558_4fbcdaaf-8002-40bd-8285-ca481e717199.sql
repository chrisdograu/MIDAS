
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.emit_webhook_event(_event text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := coalesce(current_setting('app.webhook_dispatch_url', true),
                         'https://lqddbnnarfpdnxgsnofv.functions.supabase.co/dispatch-webhook');
  v_secret text := coalesce(current_setting('app.webhook_dispatch_secret', true), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.integration_webhooks WHERE active AND event = _event) THEN
    RETURN;
  END IF;

  PERFORM extensions.http_post(
    url := v_url,
    body := jsonb_build_object('event', _event, 'payload', _payload),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', v_secret
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'emit_webhook_event(%) falhou: %', _event, SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.emit_webhook_event(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.emit_webhook_event(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.emit_webhook_event(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.emit_webhook_event(text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_webhook_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.emit_webhook_event(
    'order.created',
    jsonb_build_object(
      'order_id', NEW.id,
      'user_id', NEW.user_id,
      'total', NEW.total,
      'status', NEW.status,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pedido_created_webhook ON public.pedidos;
CREATE TRIGGER on_pedido_created_webhook
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trg_webhook_order_created();

CREATE OR REPLACE FUNCTION public.trg_webhook_user_registered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.emit_webhook_event(
    'user.registered',
    jsonb_build_object(
      'user_id', NEW.id,
      'display_name', NEW.display_name,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_webhook ON public.profiles;
CREATE TRIGGER on_profile_created_webhook
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_webhook_user_registered();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'skip ALTER FUNCTION %.%(%): %', r.nspname, r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END;
$$;
