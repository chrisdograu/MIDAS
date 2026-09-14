
-- Staff can view all denuncias
CREATE POLICY "Staff can view denuncias" ON public.denuncias FOR SELECT TO authenticated USING (is_staff());

-- Staff can view all certificados
CREATE POLICY "Staff can view certificados" ON public.certificados FOR SELECT TO authenticated USING (is_staff());

-- Staff can view all anuncios
CREATE POLICY "Staff can view all anuncios" ON public.anuncios FOR SELECT TO authenticated USING (is_staff());

-- Staff can view all mensagens
CREATE POLICY "Staff can view all mensagens" ON public.mensagens FOR SELECT TO authenticated USING (is_staff());

-- Staff can view all notifications
CREATE POLICY "Staff can view all notifications" ON public.notifications FOR SELECT TO authenticated USING (is_staff());

-- Staff can view all trade proposals
CREATE POLICY "Staff can view all trade proposals" ON public.trade_proposals FOR SELECT TO authenticated USING (is_staff());

-- Staff can view all avaliacoes_usuario
CREATE POLICY "Staff can view all user reviews" ON public.avaliacoes_usuario FOR SELECT TO authenticated USING (is_staff());

-- Staff can view all avaliacoes (product reviews)
CREATE POLICY "Staff can view all product reviews" ON public.avaliacoes FOR SELECT TO authenticated USING (is_staff());

-- Staff can manage denuncias (resolve)
CREATE POLICY "Staff can update denuncias" ON public.denuncias FOR UPDATE TO authenticated USING (is_staff());

-- Staff can update certificados (approve/reject)
CREATE POLICY "Staff can update certificados" ON public.certificados FOR UPDATE TO authenticated USING (is_staff());

-- Staff can update anuncios (moderate)
CREATE POLICY "Staff can update anuncios" ON public.anuncios FOR UPDATE TO authenticated USING (is_staff());

-- Staff can delete forum posts (moderate)
CREATE POLICY "Staff can delete forum posts" ON public.forum_posts FOR DELETE TO authenticated USING (is_staff());

-- Staff can delete forum replies (moderate)
CREATE POLICY "Staff can delete forum replies" ON public.forum_replies FOR DELETE TO authenticated USING (is_staff());
