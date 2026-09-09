
-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Allow anyone to view product images
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- Allow admins to upload product images
CREATE POLICY "Admins can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- Allow admins to update product images
CREATE POLICY "Admins can update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());

-- Allow admins to delete product images
CREATE POLICY "Admins can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());

-- Change avaliacoes.rating from integer to numeric to support 0.5 increments
ALTER TABLE public.avaliacoes ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1);

-- Add constraint for valid rating values (0.5 to 5.0 in 0.5 steps)
ALTER TABLE public.avaliacoes ADD CONSTRAINT valid_rating CHECK (rating >= 0.5 AND rating <= 5.0 AND (rating * 2) = FLOOR(rating * 2));
