DROP POLICY IF EXISTS "Admins podem ver todas as chaves" ON public.product_keys;
DROP POLICY IF EXISTS "Admins podem inserir chaves" ON public.product_keys;
DROP POLICY IF EXISTS "Admins podem atualizar chaves" ON public.product_keys;
DROP POLICY IF EXISTS "Admins podem deletar chaves" ON public.product_keys;
DROP POLICY IF EXISTS "Admins podem ver histórico" ON public.config_history;

CREATE POLICY "Admins podem ver todas as chaves" ON public.product_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem inserir chaves" ON public.product_keys FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem atualizar chaves" ON public.product_keys FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem deletar chaves" ON public.product_keys FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem ver histórico" ON public.config_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));