-- For visitors, no product read policy may invoke auth-only helpers. Keep the
-- admin policies for authenticated users and enforce the public age threshold.
ALTER POLICY "produtos_age_gate_restrictive" ON public.produtos TO anon, authenticated USING (
  CASE WHEN (SELECT auth.uid()) IS NULL
    THEN classificacao_indicativa IS NULL OR classificacao_indicativa IN ('L', '10', '12')
    ELSE classificacao_indicativa IS NULL OR public.pode_acessar_conteudo(auth.uid(), classificacao_indicativa)
  END
);