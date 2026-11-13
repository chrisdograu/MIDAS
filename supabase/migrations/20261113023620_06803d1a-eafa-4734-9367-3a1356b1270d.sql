CREATE POLICY "Users upload own library screenshots" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'screenshots' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Users delete own library screenshots" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'screenshots' AND (storage.foldername(name))[2] = auth.uid()::text);