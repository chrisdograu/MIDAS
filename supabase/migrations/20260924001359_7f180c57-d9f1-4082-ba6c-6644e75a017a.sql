ALTER VIEW public.public_profiles_view SET (security_invoker = true);

ALTER FUNCTION public._detect_stream_platform(text) SET search_path = public;
ALTER FUNCTION public.calc_tournament_xp(integer) SET search_path = public;
ALTER FUNCTION public.cancel_product_key_reservation(text, uuid) SET search_path = public;
ALTER FUNCTION public.confirm_product_key_sale(text, uuid) SET search_path = public;
ALTER FUNCTION public.gen_referral_code() SET search_path = public;
ALTER FUNCTION public.prevent_message_tampering() SET search_path = public;
ALTER FUNCTION public.reserve_product_key(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.touch_biblioteca_status() SET search_path = public;
ALTER FUNCTION public.version_config_trigger() SET search_path = public;

GRANT ALL ON public._fk_validation_report TO service_role;
DROP POLICY IF EXISTS "Service role manages FK validation report" ON public._fk_validation_report;
CREATE POLICY "Service role manages FK validation report"
ON public._fk_validation_report FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT ALL ON public.rate_limits TO service_role;
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limits;
CREATE POLICY "Service role manages rate limits"
ON public.rate_limits FOR ALL TO service_role
USING (true) WITH CHECK (true);