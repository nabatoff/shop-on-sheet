-- Бакет публичных изображений товаров и баннеров
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merch-images',
  'merch-images',
  true,
  33554432,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "merch_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "merch_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "merch_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "merch_images_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "merch_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "merch_images_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "merch_images_admin_delete" ON storage.objects;

CREATE POLICY "merch_images_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'merch-images');

CREATE POLICY "merch_images_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merch-images' AND public.is_admin());

CREATE POLICY "merch_images_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'merch-images' AND public.is_admin())
WITH CHECK (bucket_id = 'merch-images' AND public.is_admin());

CREATE POLICY "merch_images_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'merch-images' AND public.is_admin());
