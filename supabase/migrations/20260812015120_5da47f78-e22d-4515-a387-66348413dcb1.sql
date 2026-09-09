CREATE POLICY "Staff ve membros de grupos" ON public.group_members
  FOR SELECT TO authenticated
  USING (public.is_staff());