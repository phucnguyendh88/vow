-- ==============================================================================
-- FIX STORAGE & PROFILE RLS FOR VOW
-- Script cấp quyền Storage (profile-images, avatars) và Profile RLS
-- Chạy script này trực tiếp trên Supabase SQL Editor
-- ==============================================================================

-- 1. ĐẢM BẢO CỘT photos TỒN TẠI TRONG BẢNG profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

-- 2. TẠO CÁC BUCKET LƯU TRỮ ẢNH HỒ SƠ (NẾU CHƯA CÓ)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. XÓA CÁC POLICY CŨ NẾU CÓ ĐỂ TRÁNH XUNG ĐỘT
DROP POLICY IF EXISTS "Public Access for Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile images" ON storage.objects;

DROP POLICY IF EXISTS "Public Access for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow user upload profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow user update profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow user delete profile-images" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow user upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow user update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow user delete avatars" ON storage.objects;

-- 4. TẠO MỚI BỘ POLICY ĐẦY ĐỦ CHO BUCKET profile-images
-- Cho phép bất kỳ ai (public) đọc ảnh
CREATE POLICY "Allow public read profile-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- Cho phép người dùng (cả authenticated & anon) upload vào thư mục của chính mình (userId/...)
CREATE POLICY "Allow user upload profile-images"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (
    bucket_id = 'profile-images'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- Cho phép người dùng cập nhật file của chính mình (quan trọng khi dùng upsert: true)
CREATE POLICY "Allow user update profile-images"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (
    bucket_id = 'profile-images'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
)
WITH CHECK (
    bucket_id = 'profile-images'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- Cho phép người dùng xóa ảnh của chính mình
CREATE POLICY "Allow user delete profile-images"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (
    bucket_id = 'profile-images'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- 5. TẠO MỚI BỘ POLICY ĐẦY ĐỦ CHO BUCKET avatars (BUCKET FALLBACK)
CREATE POLICY "Allow public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Allow user upload avatars"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (
    bucket_id = 'avatars'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
);

CREATE POLICY "Allow user update avatars"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (
    bucket_id = 'avatars'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
)
WITH CHECK (
    bucket_id = 'avatars'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
);

CREATE POLICY "Allow user delete avatars"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (
    bucket_id = 'avatars'
    AND (
        auth.uid() IS NOT NULL 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- 6. ĐẢM BẢO QUYỀN UPDATE & INSERT TRÊN BẢNG public.profiles CHO auth.uid() = id
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
    FOR UPDATE 
    TO authenticated, anon
    USING (
        auth.uid() = id OR public.check_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id OR public.check_admin(auth.uid())
    );

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
    FOR INSERT 
    TO authenticated, anon
    WITH CHECK (
        auth.uid() = id OR public.check_admin(auth.uid())
    );
