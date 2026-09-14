-- Excluir ações de indicação do índice único diário para não engolir XP legítimo
-- quando o mesmo usuário indica múltiplos amigos no mesmo dia.
DROP INDEX IF EXISTS public.user_xp_log_daily_unique;
CREATE UNIQUE INDEX user_xp_log_daily_unique
  ON public.user_xp_log(user_id, action, awarded_date)
  WHERE action NOT IN ('purchase','trade','tournament_win','referral_invite','referral_join');