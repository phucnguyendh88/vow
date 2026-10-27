-- ==============================================================================
-- PROJECT VOW - SUPABASE DATABASE MIGRATIONS
-- Migration: 009_security_and_performance_hardening.sql
-- Description:
--   1. [P0-01] Privilege Escalation Protection Trigger on public.profiles
--   2. [P0-01b] Admin Email Sync in public.check_admin & profiles_delete_admin RLS
--   3. [P0-02] Moments Privacy RLS & Swipes Update Own RLS
--   4. [P0-03] Storage MIME Types (video/webm) & Revoke anon write policies
--   5. [P0-04] Direct Table Manipulation Hardening (matches, friend_requests, conversation_members)
--   6. [P0-05] Invite Code Lookup RPC (find_profile_by_invite_code)
--   7. [P1-05] Profiles Select Privacy (Block Bypass Fix)
--   8. [P1-06] Realtime REPLICA IDENTITY FULL for message_reactions & Performance Indexes
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. [P0-01b] UPDATE check_admin(user_id UUID) & ADD profiles_delete_admin RLS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_id
          AND p.role = 'admin'
          AND p.is_banned = FALSE
    ) OR EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = user_id
          AND LOWER(u.email) = 'phucnguyendh88@gmail.com'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth STABLE;

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.check_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 2. [P0-01] PRIVILEGE ESCALATION FIX ON public.profiles (BEFORE INSERT OR UPDATE)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.prevent_profile_role_escalation();
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.check_admin(auth.uid()) THEN
        IF TG_OP = 'INSERT' THEN
            NEW.role := 'user';
            NEW.is_banned := FALSE;
        ELSIF TG_OP = 'UPDATE' THEN
            NEW.role := OLD.role;
            NEW.is_banned := OLD.is_banned;
        END IF;

        IF NEW.username IS NOT NULL AND LOWER(TRIM(NEW.username)) IN ('admin', 'administrator', 'root', 'support') THEN
            NEW.username := 'user_' || SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_prevent_profile_role_escalation ON public.profiles;
DROP TRIGGER IF EXISTS tr_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trigger_prevent_profile_role_escalation
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ------------------------------------------------------------------------------
-- 3. [P0-02] MOMENTS PRIVACY RLS & SWIPES UPDATE OWN RLS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_moment_of(owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      owner = auth.uid()
      OR public.check_admin(auth.uid())
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = owner)
             OR (b.blocker_id = owner AND b.blocked_id = auth.uid())
        )
        AND (
          EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.user1_id = LEAST(auth.uid(), owner)
              AND f.user2_id = GREATEST(auth.uid(), owner)
          )
          OR EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.user1_id = LEAST(auth.uid(), owner)
              AND m.user2_id = GREATEST(auth.uid(), owner)
          )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_moment_of(UUID) TO authenticated;

DROP POLICY IF EXISTS "moments_select_authenticated" ON public.moments;
DROP POLICY IF EXISTS "moments_select_visible" ON public.moments;
CREATE POLICY "moments_select_authenticated" ON public.moments
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.check_admin(auth.uid())
        OR (is_deleted = FALSE AND public.can_view_moment_of(user_id))
    );

DROP POLICY IF EXISTS "swipes_update_own" ON public.swipes;
CREATE POLICY "swipes_update_own" ON public.swipes
    FOR UPDATE TO authenticated
    USING (auth.uid() = swiper_id)
    WITH CHECK (auth.uid() = swiper_id);

-- ------------------------------------------------------------------------------
-- 4. [P0-03] STORAGE MIME TYPES & REVOKE ANON WRITE POLICIES
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'moments',
    'moments',
    TRUE,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Thu hồi quyền anon trên profiles write policies (chỉ cấp cho authenticated)
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = id OR public.check_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id OR public.check_admin(auth.uid())
    );

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = id OR public.check_admin(auth.uid())
    );

-- Thu hồi quyền anon trên storage.objects write policies (chỉ cấp cho authenticated)
DROP POLICY IF EXISTS "Allow user upload profile-images" ON storage.objects;
CREATE POLICY "Allow user upload profile-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow user update profile-images" ON storage.objects;
CREATE POLICY "Allow user update profile-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'profile-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow user delete profile-images" ON storage.objects;
CREATE POLICY "Allow user delete profile-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'profile-images'
    AND (
        (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
        OR public.check_admin(auth.uid())
    )
);

DROP POLICY IF EXISTS "Allow user upload avatars" ON storage.objects;
CREATE POLICY "Allow user upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow user update avatars" ON storage.objects;
CREATE POLICY "Allow user update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow user delete avatars" ON storage.objects;
CREATE POLICY "Allow user delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (
        (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
        OR public.check_admin(auth.uid())
    )
);

DROP POLICY IF EXISTS "Allow user upload moments" ON storage.objects;
CREATE POLICY "Allow user upload moments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN ('moments', 'moment-images', 'moment-videos')
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow user delete moments" ON storage.objects;
CREATE POLICY "Allow user delete moments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id IN ('moments', 'moment-images', 'moment-videos')
    AND (
        (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
        OR public.check_admin(auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- 5. [P0-04] LOCK DOWN DIRECT TABLE MANIPULATION (matches, friend_requests, conversation_members)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "matches_insert_members" ON public.matches;
DROP POLICY IF EXISTS "matches_insert_admin_only" ON public.matches;
CREATE POLICY "matches_insert_admin_only" ON public.matches
    FOR INSERT TO authenticated
    WITH CHECK (public.check_admin(auth.uid()));

DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
CREATE POLICY "friend_requests_update" ON public.friend_requests
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = receiver_id
        OR auth.uid() = sender_id
        OR public.check_admin(auth.uid())
    )
    WITH CHECK (
        (auth.uid() = receiver_id AND status IN ('accepted', 'rejected'))
        OR (auth.uid() = sender_id AND status = 'cancelled')
        OR public.check_admin(auth.uid())
    );

DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;
CREATE POLICY "conversation_members_insert" ON public.conversation_members
    FOR INSERT TO authenticated
    WITH CHECK (public.check_admin(auth.uid()));

-- Cập nhật get_or_create_direct_conversation: kiểm tra blocks 2 chiều và is_banned
DROP FUNCTION IF EXISTS public.get_or_create_direct_conversation(UUID);
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me UUID := auth.uid();
  conv UUID;
  u1 UUID;
  u2 UUID;
  mid UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF other_user IS NULL OR other_user = me THEN RAISE EXCEPTION 'invalid user'; END IF;

  u1 := LEAST(me, other_user);
  u2 := GREATEST(me, other_user);

  -- Kiểm tra chặn 2 chiều trong public.blocks
  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = me AND b.blocked_id = other_user)
       OR (b.blocker_id = other_user AND b.blocked_id = me)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- Kiểm tra cả 2 user không bị ban
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IN (me, other_user) AND p.is_banned = TRUE
  ) THEN
    RAISE EXCEPTION 'user is banned';
  END IF;

  SELECT m.id INTO mid FROM public.matches m WHERE m.user1_id = u1 AND m.user2_id = u2;
  IF mid IS NULL AND NOT EXISTS (
       SELECT 1 FROM public.friendships f WHERE f.user1_id = u1 AND f.user2_id = u2) THEN
    RAISE EXCEPTION 'not friends';
  END IF;

  -- Ưu tiên chọn conversation đã có tin nhắn thực tế trước, sau đó theo created_at ASC
  SELECT c.id INTO conv
  FROM public.conversations c
  JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = me
  JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = other_user
  WHERE c.type IN ('friend', 'match')
  ORDER BY
    EXISTS (SELECT 1 FROM public.messages msg WHERE msg.conversation_id = c.id AND msg.is_deleted = false) DESC,
    c.created_at ASC
  LIMIT 1;

  IF conv IS NULL THEN
    INSERT INTO public.conversations (type, match_id)
    VALUES (CASE WHEN mid IS NOT NULL THEN 'match' ELSE 'friend' END, mid)
    RETURNING id INTO conv;

    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (conv, me), (conv, other_user)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN conv;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. [P0-05] INVITE CODE LOOKUP RPC (find_profile_by_invite_code)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.find_profile_by_invite_code(TEXT);
CREATE OR REPLACE FUNCTION public.find_profile_by_invite_code(code TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    church_name TEXT
) AS $$
DECLARE
    clean_code TEXT;
    clean_prefix TEXT;
BEGIN
    IF code IS NULL THEN RETURN; END IF;
    clean_code := TRIM(code);
    clean_prefix := UPPER(REPLACE(REPLACE(REPLACE(clean_code, 'VOW-', ''), 'FC-', ''), '-', ''));
    
    RETURN QUERY
    SELECT p.id, p.username, p.full_name, p.avatar_url, p.church_name
    FROM public.profiles p
    WHERE p.id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID)
      AND p.is_banned = FALSE
      AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
             OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
      )
      AND (
          (LENGTH(clean_prefix) >= 4 AND REPLACE(p.id::text, '-', '') ILIKE (clean_prefix || '%'))
          OR (p.username IS NOT NULL AND UPPER(p.username) = UPPER(clean_code))
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

GRANT EXECUTE ON FUNCTION public.find_profile_by_invite_code(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. [P1-05] PROFILES SELECT PRIVACY (BLOCK BYPASS FIX)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_privacy" ON public.profiles;
CREATE POLICY "profiles_select_privacy" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        auth.uid() = id
        OR public.check_admin(auth.uid())
        OR (
            is_banned = FALSE
            AND NOT EXISTS (
                SELECT 1 FROM public.blocks
                WHERE (blocker_id = auth.uid() AND blocked_id = profiles.id)
                   OR (blocker_id = profiles.id AND blocked_id = auth.uid())
            )
        )
    );

-- ------------------------------------------------------------------------------
-- 8. [P1-06] REALTIME REPLICA IDENTITY FULL & PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- Xóa bỏ index cũ tham chiếu cột is_read (nếu có từ trước) vì VOW quản lý unread qua conversation_members.last_read_at
DROP INDEX IF EXISTS public.idx_messages_unread_perf;

-- 1. Index tối ưu lấy tin nhắn mới nhất chưa xóa theo conversation_id
CREATE INDEX IF NOT EXISTS idx_messages_conv_created_active 
ON public.messages (conversation_id, created_at DESC) 
WHERE is_deleted = FALSE;

-- 2. Index tối ưu tính toán tin nhắn chưa đọc (unread count)
CREATE INDEX IF NOT EXISTS idx_messages_unread_calc 
ON public.messages (conversation_id, sender_id, created_at DESC) 
WHERE is_deleted = FALSE;

-- 3. Composite Index 2 chiều cho conversation_members để tìm hội thoại cực nhanh
CREATE INDEX IF NOT EXISTS idx_conv_members_user_conv 
ON public.conversation_members (user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_conv_members_conv_user 
ON public.conversation_members (conversation_id, user_id);

-- 4. Index tối ưu sắp xếp và phân loại hội thoại
CREATE INDEX IF NOT EXISTS idx_conversations_type_created 
ON public.conversations (type, created_at DESC);

-- 5. Index cho last_read_at trên conversation_members
CREATE INDEX IF NOT EXISTS idx_conv_members_user_last_read_perf 
ON public.conversation_members (user_id, last_read_at DESC);

-- 6. Discoverable Profiles Partial Index
CREATE INDEX IF NOT EXISTS idx_profiles_discoverable 
ON public.profiles (created_at DESC) 
WHERE is_active = TRUE AND is_banned = FALSE AND is_complete = TRUE;
