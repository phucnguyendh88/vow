-- ==============================================================================
-- PROJECT VOW - SUPABASE DATABASE MIGRATIONS
-- Architecture: Christian Daily Scripture, Locket-style Moments, Dating & Community
-- Database: Supabase PostgreSQL (15+)
-- File: vow-migrations.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. UTILITY & HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Tự động cập nhật cột updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. TABLES DEFINITIONS
-- ------------------------------------------------------------------------------

-- 3.1 PROFILES (Hồ sơ người dùng kết nối với auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
    location_text TEXT,
    church_name TEXT,
    interests TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT username_length_check CHECK (username IS NULL OR char_length(username) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active_banned ON public.profiles(is_active, is_banned);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Function kiểm tra quyền Admin an toàn
CREATE OR REPLACE FUNCTION public.check_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = user_id 
          AND role = 'admin' 
          AND is_banned = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- Trigger updated_at cho profiles
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3.2 DAILY VERSES (Câu Kinh Thánh và bài suy ngẫm mỗi ngày)
CREATE TABLE IF NOT EXISTS public.daily_verses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verse_text TEXT NOT NULL,
    verse_reference TEXT NOT NULL,
    meditation_text TEXT,
    background_image_url TEXT,
    audio_url TEXT,
    date DATE NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

CREATE INDEX IF NOT EXISTS idx_daily_verses_date ON public.daily_verses(date DESC);

-- 3.3 READING STREAKS (Theo dõi chuỗi ngày đọc Kinh Thánh)
CREATE TABLE IF NOT EXISTS public.reading_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT unique_user_reading_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_reading_streaks_user_date ON public.reading_streaks(user_id, date DESC);

-- 3.4 MOMENTS (Chia sẻ khoảnh khắc dạng Locket)
CREATE TABLE IF NOT EXISTS public.moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    thumbnail_url TEXT,
    caption TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

CREATE INDEX IF NOT EXISTS idx_moments_user_created ON public.moments(user_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON public.moments(created_at DESC) WHERE is_deleted = FALSE;

-- 3.5 MOMENT COMMENTS (Bình luận trên khoảnh khắc)
CREATE TABLE IF NOT EXISTS public.moment_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

CREATE INDEX IF NOT EXISTS idx_moment_comments_moment_created ON public.moment_comments(moment_id, created_at ASC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_moment_comments_user ON public.moment_comments(user_id);

-- 3.6 SWIPES (Hành động quẹt Like/Pass - Tinder style)
CREATE TABLE IF NOT EXISTS public.swipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    swiped_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
    context TEXT NOT NULL DEFAULT 'dating',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT check_cannot_swipe_self CHECK (swiper_id <> swiped_id),
    CONSTRAINT unique_swipe_context UNIQUE (swiper_id, swiped_id, context)
);

CREATE INDEX IF NOT EXISTS idx_swipes_swiper_context ON public.swipes(swiper_id, context);
CREATE INDEX IF NOT EXISTS idx_swipes_swiped_action ON public.swipes(swiped_id, action, context);

-- 3.7 MATCHES (Tương hợp khi cả 2 cùng Like)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT check_user1_less_than_user2 CHECK (user1_id < user2_id),
    CONSTRAINT unique_match_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_user1 ON public.matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON public.matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches(created_at DESC);

-- 3.8 FRIEND REQUESTS (Lời mời kết bạn cộng đồng Cơ Đốc)
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT check_cannot_friend_self CHECK (sender_id <> receiver_id),
    CONSTRAINT unique_friend_request UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id, status);

DROP TRIGGER IF EXISTS trigger_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER trigger_friend_requests_updated_at
    BEFORE UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3.9 FRIENDSHIPS (Danh sách bạn bè 2 chiều)
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT check_friendship_ordering CHECK (user1_id < user2_id),
    CONSTRAINT unique_friendship_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON public.friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON public.friendships(user2_id);

-- 3.10 CONVERSATIONS (Cuộc trò chuyện)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('match', 'friend', 'group')),
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT unique_conversation_match UNIQUE (match_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_match_id ON public.conversations(match_id);

-- 3.11 CONVERSATION MEMBERS (Thành viên cuộc trò chuyện)
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT unique_conversation_member UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members(conversation_id);

-- 3.12 MESSAGES (Tin nhắn trò chuyện kèm idempotency key)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    idempotency_key UUID UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- 3.13 BLOCKS (Chặn người dùng)
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT check_cannot_block_self CHECK (blocker_id <> blocked_id),
    CONSTRAINT unique_block_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

-- 3.14 REPORTS (Báo cáo vi phạm)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_moment_id UUID REFERENCES public.moments(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT check_report_target CHECK (reported_user_id IS NOT NULL OR reported_moment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);

-- 3.15 AUDIT LOGS (Nhật ký kiểm toán hoạt động quản trị viên)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. FUNCTIONS & TRIGGERS LOGIC
-- ------------------------------------------------------------------------------

-- 4.1 Tự động tạo Profile khi người dùng đăng ký qua Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    gen_username TEXT;
BEGIN
    -- Tạo username mặc định nếu metadata không cung cấp
    gen_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        'user_' || SUBSTRING(NEW.id::TEXT, 1, 8)
    );

    INSERT INTO public.profiles (
        id,
        username,
        full_name,
        avatar_url,
        is_complete,
        is_active,
        is_banned,
        role,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        gen_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        FALSE,
        TRUE,
        FALSE,
        'user',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4.2 Xử lý Tương Hợp (Matches) & Khởi tạo Conversation tự động
CREATE OR REPLACE FUNCTION public.handle_match()
RETURNS TRIGGER AS $$
DECLARE
    target_swipe RECORD;
    u1 UUID;
    u2 UUID;
    new_match_id UUID;
    new_conv_id UUID;
BEGIN
    -- Chỉ xử lý khi hành động quẹt là 'like'
    IF NEW.action <> 'like' THEN
        RETURN NEW;
    END IF;

    -- Kiểm tra xem đối phương đã like mình trước đó hay chưa (cùng context)
    SELECT * INTO target_swipe
    FROM public.swipes
    WHERE swiper_id = NEW.swiped_id
      AND swiped_id = NEW.swiper_id
      AND action = 'like'
      AND context = NEW.context
    LIMIT 1;

    -- Nếu tìm thấy like đối ứng -> Tạo match và conversation
    IF FOUND THEN
        -- Sắp xếp ID để tuân thủ check constraint user1_id < user2_id
        IF NEW.swiper_id < NEW.swiped_id THEN
            u1 := NEW.swiper_id;
            u2 := NEW.swiped_id;
        ELSE
            u1 := NEW.swiped_id;
            u2 := NEW.swiper_id;
        END IF;

        -- 1. Tạo Match với ON CONFLICT DO NOTHING chống race condition
        INSERT INTO public.matches (user1_id, user2_id)
        VALUES (u1, u2)
        ON CONFLICT (user1_id, user2_id) DO NOTHING
        RETURNING id INTO new_match_id;

        -- Nếu record đã tồn tại từ trước do song song transaction
        IF new_match_id IS NULL THEN
            SELECT id INTO new_match_id
            FROM public.matches
            WHERE user1_id = u1 AND user2_id = u2;
        END IF;

        -- 2. Tạo Conversation loại 'match'
        IF new_match_id IS NOT NULL THEN
            INSERT INTO public.conversations (type, match_id)
            VALUES ('match', new_match_id)
            ON CONFLICT (match_id) DO NOTHING
            RETURNING id INTO new_conv_id;

            IF new_conv_id IS NULL THEN
                SELECT id INTO new_conv_id
                FROM public.conversations
                WHERE match_id = new_match_id;
            END IF;

            -- 3. Thêm cả 2 thành viên vào conversation_members
            IF new_conv_id IS NOT NULL THEN
                INSERT INTO public.conversation_members (conversation_id, user_id)
                VALUES 
                    (new_conv_id, u1),
                    (new_conv_id, u2)
                ON CONFLICT (conversation_id, user_id) DO NOTHING;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_handle_match_on_swipe ON public.swipes;
CREATE TRIGGER trigger_handle_match_on_swipe
    AFTER INSERT ON public.swipes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_match();

-- 4.3 Tự động kết bạn khi Friend Request được chấp nhận
CREATE OR REPLACE FUNCTION public.handle_friend_request_accepted()
RETURNS TRIGGER AS $$
DECLARE
    u1 UUID;
    u2 UUID;
BEGIN
    IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
        IF NEW.sender_id < NEW.receiver_id THEN
            u1 := NEW.sender_id;
            u2 := NEW.receiver_id;
        ELSE
            u1 := NEW.receiver_id;
            u2 := NEW.sender_id;
        END IF;

        INSERT INTO public.friendships (user1_id, user2_id)
        VALUES (u1, u2)
        ON CONFLICT (user1_id, user2_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_friend_request_accepted ON public.friend_requests;
CREATE TRIGGER trigger_friend_request_accepted
    AFTER UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_friend_request_accepted();

-- 4.4 Helper function để kiểm tra thành viên hội thoại an toàn (tránh đệ quy RLS)
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL OR conv_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 
        FROM public.conversation_members
        WHERE conversation_id = conv_id 
          AND user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Kích hoạt RLS trên tất cả các bảng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 PROFILES POLICIES
-- Public SELECT profile đang hoạt động và không bị khóa, hoặc chủ sở hữu, hoặc admin
CREATE POLICY "profiles_select_public" ON public.profiles
    FOR SELECT USING (
        (is_active = TRUE AND is_banned = FALSE)
        OR (auth.uid() = id)
        OR public.check_admin(auth.uid())
    );

-- User tự khởi tạo hồ sơ của chính mình
CREATE POLICY "profiles_insert_self" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id
    );

-- Chỉ chủ sở hữu hoặc admin mới được cập nhật
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR public.check_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id OR public.check_admin(auth.uid())
    );

-- 5.2 DAILY VERSES POLICIES
-- Mọi người (public) đều được đọc câu Kinh Thánh hàng ngày
CREATE POLICY "daily_verses_select_public" ON public.daily_verses
    FOR SELECT USING (TRUE);

-- Chỉ admin mới có quyền thêm/sửa/xóa bài học Kinh Thánh
CREATE POLICY "daily_verses_admin_insert" ON public.daily_verses
    FOR INSERT WITH CHECK (public.check_admin(auth.uid()));

CREATE POLICY "daily_verses_admin_update" ON public.daily_verses
    FOR UPDATE USING (public.check_admin(auth.uid()));

CREATE POLICY "daily_verses_admin_delete" ON public.daily_verses
    FOR DELETE USING (public.check_admin(auth.uid()));

-- 5.3 READING STREAKS POLICIES
-- Người dùng đọc/ghi lại streak của chính mình hoặc admin kiểm tra
CREATE POLICY "reading_streaks_select_own" ON public.reading_streaks
    FOR SELECT USING (auth.uid() = user_id OR public.check_admin(auth.uid()));

CREATE POLICY "reading_streaks_insert_own" ON public.reading_streaks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reading_streaks_delete_own" ON public.reading_streaks
    FOR DELETE USING (auth.uid() = user_id OR public.check_admin(auth.uid()));

-- 5.4 MOMENTS POLICIES
-- Cho phép authenticated users xem (chưa bị xóa, hoặc chính chủ/admin xem bài đã xóa)
CREATE POLICY "moments_select_authenticated" ON public.moments
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (is_deleted = FALSE OR auth.uid() = user_id OR public.check_admin(auth.uid()))
    );

-- Chỉ auth user đăng moment của chính mình
CREATE POLICY "moments_insert_own" ON public.moments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chủ moment hoặc admin có thể cập nhật (ví dụ xoá mềm)
CREATE POLICY "moments_update_own_or_admin" ON public.moments
    FOR UPDATE USING (auth.uid() = user_id OR public.check_admin(auth.uid()));

-- Chủ moment hoặc admin có thể xoá
CREATE POLICY "moments_delete_own_or_admin" ON public.moments
    FOR DELETE USING (auth.uid() = user_id OR public.check_admin(auth.uid()));

-- 5.5 MOMENT COMMENTS POLICIES
-- Authenticated users có thể đọc comments nếu comment chưa bị xóa
CREATE POLICY "moment_comments_select" ON public.moment_comments
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (is_deleted = FALSE OR auth.uid() = user_id OR public.check_admin(auth.uid()))
    );

-- Thêm bình luận cho chính mình
CREATE POLICY "moment_comments_insert" ON public.moment_comments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() = user_id
    );

-- Cập nhật hoặc xóa mềm comment
CREATE POLICY "moment_comments_update" ON public.moment_comments
    FOR UPDATE USING (auth.uid() = user_id OR public.check_admin(auth.uid()));

CREATE POLICY "moment_comments_delete" ON public.moment_comments
    FOR DELETE USING (auth.uid() = user_id OR public.check_admin(auth.uid()));

-- 5.6 SWIPES POLICIES
-- Chỉ xem được lịch sử swipe của chính mình
CREATE POLICY "swipes_select_own" ON public.swipes
    FOR SELECT USING (auth.uid() = swiper_id OR public.check_admin(auth.uid()));

-- Chỉ được swipe với swiper_id là tài khoản đăng nhập
CREATE POLICY "swipes_insert_own" ON public.swipes
    FOR INSERT WITH CHECK (auth.uid() = swiper_id);

-- 5.7 MATCHES POLICIES
-- Chỉ 2 người trong match hoặc admin mới xem được match
CREATE POLICY "matches_select_members" ON public.matches
    FOR SELECT USING (
        auth.uid() = user1_id 
        OR auth.uid() = user2_id 
        OR public.check_admin(auth.uid())
    );

-- Cho phép function/người dùng tạo match
CREATE POLICY "matches_insert_members" ON public.matches
    FOR INSERT WITH CHECK (
        auth.uid() = user1_id 
        OR auth.uid() = user2_id 
        OR public.check_admin(auth.uid())
    );

-- 5.8 FRIEND REQUESTS POLICIES
-- Người gửi hoặc người nhận hoặc admin xem được friend request
CREATE POLICY "friend_requests_select" ON public.friend_requests
    FOR SELECT USING (
        auth.uid() = sender_id 
        OR auth.uid() = receiver_id 
        OR public.check_admin(auth.uid())
    );

-- Chỉ người gửi mới được tạo friend request
CREATE POLICY "friend_requests_insert_sender" ON public.friend_requests
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Người nhận (chấp nhận/từ chối) hoặc người gửi (hủy bỏ) được cập nhật trạng thái
CREATE POLICY "friend_requests_update" ON public.friend_requests
    FOR UPDATE USING (
        auth.uid() = receiver_id 
        OR auth.uid() = sender_id 
        OR public.check_admin(auth.uid())
    );

CREATE POLICY "friend_requests_delete" ON public.friend_requests
    FOR DELETE USING (
        auth.uid() = sender_id 
        OR auth.uid() = receiver_id 
        OR public.check_admin(auth.uid())
    );

-- 5.9 FRIENDSHIPS POLICIES
-- Bạn bè trong quan hệ hoặc admin xem được danh sách
CREATE POLICY "friendships_select" ON public.friendships
    FOR SELECT USING (
        auth.uid() = user1_id 
        OR auth.uid() = user2_id 
        OR public.check_admin(auth.uid())
    );

CREATE POLICY "friendships_delete" ON public.friendships
    FOR DELETE USING (
        auth.uid() = user1_id 
        OR auth.uid() = user2_id 
        OR public.check_admin(auth.uid())
    );

-- 5.10 CONVERSATIONS POLICIES
-- Chỉ thành viên trong cuộc trò chuyện hoặc admin mới xem được
CREATE POLICY "conversations_select_members" ON public.conversations
    FOR SELECT USING (
        public.is_conversation_member(id)
        OR public.check_admin(auth.uid())
    );

-- 5.11 CONVERSATION MEMBERS POLICIES
-- Xem danh sách thành viên nếu chính mình thuộc hội thoại đó hoặc là admin
CREATE POLICY "conversation_members_select" ON public.conversation_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR public.is_conversation_member(conversation_id)
        OR public.check_admin(auth.uid())
    );

CREATE POLICY "conversation_members_insert" ON public.conversation_members
    FOR INSERT WITH CHECK (
        public.is_conversation_member(conversation_id)
        OR user_id = auth.uid()
        OR public.check_admin(auth.uid())
    );

-- Rời hội thoại
CREATE POLICY "conversation_members_delete_self" ON public.conversation_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR public.check_admin(auth.uid())
    );

-- 5.12 MESSAGES POLICIES
-- Xem tin nhắn nếu là thành viên hội thoại
CREATE POLICY "messages_select_members" ON public.messages
    FOR SELECT USING (
        public.is_conversation_member(conversation_id)
        OR public.check_admin(auth.uid())
    );

-- Gửi tin nhắn nếu là thành viên hội thoại và là sender
CREATE POLICY "messages_insert_sender" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND public.is_conversation_member(conversation_id)
    );

-- Người gửi hoặc admin cập nhật (ví dụ xoá mềm tin nhắn)
CREATE POLICY "messages_update_sender_or_admin" ON public.messages
    FOR UPDATE USING (
        auth.uid() = sender_id OR public.check_admin(auth.uid())
    );

-- 5.13 BLOCKS POLICIES
-- Người chặn xem danh sách đã chặn của mình
CREATE POLICY "blocks_select_own" ON public.blocks
    FOR SELECT USING (auth.uid() = blocker_id OR public.check_admin(auth.uid()));

-- Thêm chặn
CREATE POLICY "blocks_insert_own" ON public.blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Bỏ chặn
CREATE POLICY "blocks_delete_own" ON public.blocks
    FOR DELETE USING (auth.uid() = blocker_id);

-- 5.14 REPORTS POLICIES
-- Người tạo báo cáo hoặc admin được xem báo cáo
CREATE POLICY "reports_select_reporter_or_admin" ON public.reports
    FOR SELECT USING (
        auth.uid() = reporter_id 
        OR public.check_admin(auth.uid())
    );

-- Người dùng authenticated được tạo báo cáo
CREATE POLICY "reports_insert_authenticated" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Chỉ admin được xử lý cập nhật trạng thái báo cáo
CREATE POLICY "reports_update_admin_only" ON public.reports
    FOR UPDATE USING (public.check_admin(auth.uid()));

-- 5.15 AUDIT LOGS POLICIES
-- Chỉ admin mới có quyền truy cập nhật ký audit
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
    FOR SELECT USING (public.check_admin(auth.uid()));

CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs
    FOR INSERT WITH CHECK (public.check_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 6. STORAGE BUCKETS SETUP & SECURITY
-- ------------------------------------------------------------------------------
/*
Hướng dẫn cấu hình Storage Buckets trên Supabase Dashboard hoặc chạy script dưới:
1. Bucket 'avatars':
   - Chứa ảnh đại diện của người dùng.
   - Public: TRUE (để hiển thị nhanh avatar trên web/mobile không cần pre-signed url liên tục).
   - Dung lượng tối đa: 5MB / file.
   - Định dạng hợp lệ: image/jpeg, image/png, image/webp.

2. Bucket 'moments':
   - Chứa media (ảnh & video ngắn) cho tính năng chia sẻ khoảnh khắc Locket-style.
   - Public: TRUE (hoặc FALSE nếu yêu cầu Private có Signed URL).
   - Dung lượng tối đa: 50MB / file.
   - Định dạng hợp lệ: image/jpeg, image/png, image/webp, video/mp4, video/quicktime.

Script khởi tạo buckets trong schema `storage` (nếu đã kích hoạt Supabase Storage):
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'avatars', 
        'avatars', 
        TRUE, 
        5242880, 
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    ),
    (
        'moments', 
        'moments', 
        TRUE, 
        52428800, 
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies:
-- 1. Avatars: Public read, User upload vào folder có tên là chính user_id của họ
CREATE POLICY "avatars_public_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "avatars_user_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' 
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "avatars_user_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' 
        AND (auth.uid()::TEXT = (storage.foldername(name))[1] OR public.check_admin(auth.uid()))
    );

-- 2. Moments: Authenticated read & upload
CREATE POLICY "moments_authenticated_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'moments'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "moments_user_upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'moments' 
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "moments_user_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'moments' 
        AND (auth.uid()::TEXT = (storage.foldername(name))[1] OR public.check_admin(auth.uid()))
    );

-- ------------------------------------------------------------------------------
-- 7. SEED DATA
-- ------------------------------------------------------------------------------

-- Seed dữ liệu Daily Verse mẫu cho ngày hôm nay
INSERT INTO public.daily_verses (
    verse_text,
    verse_reference,
    meditation_text,
    background_image_url,
    audio_url,
    date
)
VALUES (
    'Vì Đức Chúa Trời yêu thương thế gian đến nỗi đã ban Con một của Ngài, hầu cho hễ ai tin Con ấy không bị hư mất mà được sự sống đời đời.',
    'Giăng 3:16',
    'Tình yêu thương của Đức Chúa Trời là vô điều kiện và đời đời. Hãy đón nhận ngày mới bằng sự bình an và đức tin vững chắc vào Ngài.',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    NULL,
    CURRENT_DATE
)
ON CONFLICT (date) DO UPDATE
SET 
    verse_text = EXCLUDED.verse_text,
    verse_reference = EXCLUDED.verse_reference,
    meditation_text = EXCLUDED.meditation_text,
    background_image_url = EXCLUDED.background_image_url,
    audio_url = EXCLUDED.audio_url;

-- ==============================================================================
-- END OF MIGRATION SCRIPT
-- ==============================================================================
