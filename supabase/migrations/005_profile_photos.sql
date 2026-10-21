-- Migration 005: Thêm cột photos (tối đa 6 ảnh) và cấu hình bucket profile-images
-- An toàn, không xóa dữ liệu, tương thích RLS

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

-- Đảm bảo bucket profile-images tồn tại
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép mọi người đọc ảnh hồ sơ
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Public Access for Profile Images'
    ) THEN
        CREATE POLICY "Public Access for Profile Images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'profile-images');
    END IF;
END $$;

-- Cho phép người dùng upload ảnh vào folder của chính mình (userId/...)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Users can upload own profile images'
    ) THEN
        CREATE POLICY "Users can upload own profile images"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'profile-images' 
            AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

-- Cho phép người dùng cập nhật hoặc xóa ảnh của chính mình
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Users can delete own profile images'
    ) THEN
        CREATE POLICY "Users can delete own profile images"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'profile-images' 
            AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;
