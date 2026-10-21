-- ==============================================================================
-- MIGRATION 006: SPRINT SỬA LỖI VÒNG 2 (RLS PRIVACY & AUTO FRIENDSHIP ON MATCH)
-- ==============================================================================

-- 1. Helper function kiểm tra quan hệ bạn bè hoặc chính mình
-- Bắt buộc SECURITY DEFINER STABLE để tránh lỗi Infinite Recursion trong RLS
CREATE OR REPLACE FUNCTION public.is_friend_or_self(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL OR target_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Chính mình
    IF auth.uid() = target_user_id THEN
        RETURN TRUE;
    END IF;

    -- Bạn bè trong bảng friendships
    IF EXISTS (
        SELECT 1 FROM public.friendships
        WHERE (user1_id = auth.uid() AND user2_id = target_user_id)
           OR (user2_id = auth.uid() AND user1_id = target_user_id)
    ) THEN
        RETURN TRUE;
    END IF;

    -- Đã match trong bảng matches
    IF EXISTS (
        SELECT 1 FROM public.matches
        WHERE (user1_id = auth.uid() AND user2_id = target_user_id)
           OR (user2_id = auth.uid() AND user1_id = target_user_id)
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- 2. Tự động kết bạn khi 2 bên Like (Match) trong Trigger handle_match
CREATE OR REPLACE FUNCTION public.handle_match()
RETURNS TRIGGER AS $$
DECLARE
    target_swipe RECORD;
    u1 UUID;
    u2 UUID;
    new_match_id UUID;
    new_conv_id UUID;
BEGIN
    -- Chỉ xử lý khi swipe là 'like'
    IF NEW.action <> 'like' THEN
        RETURN NEW;
    END IF;

    -- Tìm swipe like đối ứng từ người kia
    SELECT * INTO target_swipe
    FROM public.swipes
    WHERE swiper_id = NEW.swiped_id
      AND swiped_id = NEW.swiper_id
      AND action = 'like'
      AND context = NEW.context
    LIMIT 1;

    -- Nếu tìm thấy like đối ứng -> Tạo match, conversation và friendship
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

        -- 2. Tự động thêm vào friendships giữa 2 người (đảm bảo đồng bộ)
        INSERT INTO public.friendships (user1_id, user2_id)
        VALUES (u1, u2)
        ON CONFLICT (user1_id, user2_id) DO NOTHING;

        -- 3. Tạo Conversation loại 'match'
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

            -- 4. Thêm cả 2 thành viên vào conversation_members
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

-- Gán lại trigger cho bảng swipes (sau cả insert và update để chắc chắn)
DROP TRIGGER IF EXISTS trigger_handle_match_on_swipe ON public.swipes;
CREATE TRIGGER trigger_handle_match_on_swipe
    AFTER INSERT OR UPDATE ON public.swipes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_match();

-- 3. Backfill dữ liệu: đồng bộ toàn bộ matches đã có sang friendships
INSERT INTO public.friendships (user1_id, user2_id)
SELECT user1_id, user2_id FROM public.matches
ON CONFLICT (user1_id, user2_id) DO NOTHING;

-- 4. Chặn xem hồ sơ người lạ (Security RLS Policy trên profiles)
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_privacy" ON public.profiles;

CREATE POLICY "profiles_select_privacy" ON public.profiles
    FOR SELECT USING (
        -- 1. Xem chính mình
        auth.uid() = id
        -- 2. Hoặc là bạn bè / đối tác match
        OR public.is_friend_or_self(id)
        -- 3. Hoặc là ứng viên khám phá hợp lệ (không bị ban, hồ sơ đã hoàn tất, không bị chặn)
        OR (
            is_active = TRUE
            AND is_banned = FALSE
            AND is_complete = TRUE
            AND NOT EXISTS (
                SELECT 1 FROM public.blocks
                WHERE (blocker_id = auth.uid() AND blocked_id = profiles.id)
                   OR (blocker_id = profiles.id AND blocked_id = auth.uid())
            )
        )
        -- 4. Hoặc là Admin hệ thống
        OR public.check_admin(auth.uid())
    );
