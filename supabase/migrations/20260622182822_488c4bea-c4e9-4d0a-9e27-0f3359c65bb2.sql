
CREATE POLICY "game-rewards public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-rewards');

CREATE POLICY "game-rewards admin write"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'game-rewards' AND public.is_admin());

CREATE POLICY "game-rewards admin update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'game-rewards' AND public.is_admin());

CREATE POLICY "game-rewards admin delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'game-rewards' AND public.is_admin());
