GRANT SELECT ON public.developers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.developers TO authenticated;
GRANT ALL ON public.developers TO service_role;

GRANT SELECT ON public.publishers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.publishers TO authenticated;
GRANT ALL ON public.publishers TO service_role;

GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_keys TO authenticated;
GRANT ALL ON public.product_keys TO service_role;

GRANT SELECT ON public.config_history TO authenticated;
GRANT ALL ON public.config_history TO service_role;

DROP POLICY IF EXISTS "Apenas admins podem criar desenvolvedores" ON public.developers;
DROP POLICY IF EXISTS "Admins podem criar" ON public.developers;
CREATE POLICY "Admins podem criar"
ON public.developers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Apenas admins podem atualizar desenvolvedores" ON public.developers;
DROP POLICY IF EXISTS "Admins podem atualizar" ON public.developers;
CREATE POLICY "Admins podem atualizar"
ON public.developers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Apenas admins podem deletar desenvolvedores" ON public.developers;
DROP POLICY IF EXISTS "Admins podem deletar" ON public.developers;
CREATE POLICY "Admins podem deletar"
ON public.developers FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Apenas admins podem criar publishers" ON public.publishers;
DROP POLICY IF EXISTS "Admins podem criar" ON public.publishers;
CREATE POLICY "Admins podem criar"
ON public.publishers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Apenas admins podem atualizar publishers" ON public.publishers;
DROP POLICY IF EXISTS "Admins podem atualizar" ON public.publishers;
CREATE POLICY "Admins podem atualizar"
ON public.publishers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Apenas admins podem deletar publishers" ON public.publishers;
DROP POLICY IF EXISTS "Admins podem deletar" ON public.publishers;
CREATE POLICY "Admins podem deletar"
ON public.publishers FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Apenas admins podem gerenciar membros" ON public.team_members;
DROP POLICY IF EXISTS "Admins podem gerenciar membros" ON public.team_members;
CREATE POLICY "Admins podem gerenciar membros"
ON public.team_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem ver histórico" ON public.config_history;
CREATE POLICY "Admins podem ver histórico"
ON public.config_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem ver todas as chaves" ON public.product_keys;
CREATE POLICY "Admins podem ver todas as chaves"
ON public.product_keys FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem inserir chaves" ON public.product_keys;
CREATE POLICY "Admins podem inserir chaves"
ON public.product_keys FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem atualizar chaves" ON public.product_keys;
CREATE POLICY "Admins podem atualizar chaves"
ON public.product_keys FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem deletar chaves" ON public.product_keys;
CREATE POLICY "Admins podem deletar chaves"
ON public.product_keys FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));