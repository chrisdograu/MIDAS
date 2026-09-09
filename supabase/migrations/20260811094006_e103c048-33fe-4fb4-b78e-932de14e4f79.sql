ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS admin_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_suspension_reason text,
  ADD COLUMN IF NOT EXISTS admin_suspended_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='seller_profiles' AND policyname='Staff can moderate seller profiles'
  ) THEN
    CREATE POLICY "Staff can moderate seller profiles"
      ON public.seller_profiles FOR UPDATE TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
END $$;