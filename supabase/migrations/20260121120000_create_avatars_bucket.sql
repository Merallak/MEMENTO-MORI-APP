-- 1. Crear bucket 'avatars' (público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: Acceso público de lectura
CREATE POLICY "Public Access Avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 3. Política: Usuarios autenticados pueden subir (solo en su carpeta)
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text 
);

-- 4. Política: Usuarios pueden actualizar sus propios avatares
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text 
);

-- 5. Política: Usuarios pueden borrar sus propios avatares
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text 
);