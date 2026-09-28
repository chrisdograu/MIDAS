-- A public policy must not call auth-only admin helpers for anonymous visitors.
ALTER POLICY "produtos_age_gate_restrictive" ON public.produtos TO anon, authenticated USING (
  CASE WHEN auth.uid() IS NULL
    THEN classificacao_indicativa IS NULL OR classificacao_indicativa IN ('L', '10', '12')
    ELSE classificacao_indicativa IS NULL
      OR public.has_role(auth.uid(), 'admin')
      OR COALESCE(public.pode_acessar_conteudo(auth.uid(), classificacao_indicativa), false)
  END
);

-- Admin operations remain protected; anonymous SELECT policies are separate.
ALTER POLICY "Admins manage bundles" ON public.bundles TO authenticated;
ALTER POLICY "Admins manage bundle items" ON public.bundle_items TO authenticated;
ALTER POLICY "Admins manage daily pick" ON public.daily_pick_overrides TO authenticated;
ALTER POLICY "Admins manage flash promos" ON public.flash_promotions TO authenticated;
ALTER POLICY "Admins manage badge catalog" ON public.badge_catalog TO authenticated;
ALTER POLICY "Admins can manage blocks" ON public.blocked_users TO authenticated;
ALTER POLICY "admins manage game_rewards" ON public.game_rewards TO authenticated;
ALTER POLICY "Admins manage price history" ON public.price_history TO authenticated;
ALTER POLICY "Admins manage produto_imagens" ON public.produto_imagens TO authenticated;
ALTER POLICY "Admins manage dup alerts" ON public.tournament_duplicate_alerts TO authenticated;
ALTER POLICY "Admins manage participants" ON public.tournament_participants TO authenticated;
ALTER POLICY "Admins manage user badges" ON public.user_badges TO authenticated;
ALTER POLICY "Admins manage titles" ON public.user_titles TO authenticated;
ALTER POLICY "Admins manage xp log" ON public.user_xp_log TO authenticated;
ALTER POLICY "Admins read views" ON public.product_views TO authenticated;
ALTER POLICY "Gerente vê logs" ON public.admin_logs TO authenticated;
ALTER POLICY "Staff view mod history" ON public.moderation_history TO authenticated;
ALTER POLICY "Staff insert mod history" ON public.moderation_history TO authenticated;
