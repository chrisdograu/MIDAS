DROP POLICY IF EXISTS "group_covers_insert_auth" ON storage.objects;
CREATE POLICY "group_covers_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'group-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone insert view" ON public.product_views;
CREATE POLICY "Insert own or anonymous view" ON public.product_views FOR INSERT TO anon, authenticated
WITH CHECK ((auth.uid() IS NULL AND user_id IS NULL) OR user_id = auth.uid());

DROP POLICY IF EXISTS "view tournament chat" ON public.tournament_chat_messages;
CREATE POLICY "view tournament chat signed in" ON public.tournament_chat_messages FOR SELECT TO authenticated
USING (NOT is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "view waitlist" ON public.tournament_waitlist;
CREATE POLICY "view own waitlist or admin" ON public.tournament_waitlist FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin());