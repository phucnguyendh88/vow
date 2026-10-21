-- ==============================================================================
-- Migration 007: Chống tạo trùng lặp hội thoại 1-1 & hợp nhất hội thoại trùng
-- ==============================================================================

-- 1. Cập nhật get_or_create_direct_conversation ưu tiên hội thoại đã có tin nhắn
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF EXISTS (SELECT 1 FROM public.blocks b
             WHERE (b.blocker_id = me AND b.blocked_id = other_user)
                OR (b.blocker_id = other_user AND b.blocked_id = me)) THEN
    RAISE EXCEPTION 'blocked';
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

-- 2. Cập nhật handle_match() để tái sử dụng hội thoại 1-1 đã có (nếu trigger_friendship_conversation đã tạo trước đó)
CREATE OR REPLACE FUNCTION public.handle_match()
RETURNS TRIGGER AS $$
DECLARE
    target_swipe RECORD;
    u1 UUID;
    u2 UUID;
    new_match_id UUID;
    new_conv_id UUID;
BEGIN
    IF NEW.action <> 'like' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO target_swipe
    FROM public.swipes
    WHERE swiper_id = NEW.swiped_id
      AND swiped_id = NEW.swiper_id
      AND action = 'like'
      AND context = NEW.context
    LIMIT 1;

    IF FOUND THEN
        IF NEW.swiper_id < NEW.swiped_id THEN
            u1 := NEW.swiper_id;
            u2 := NEW.swiped_id;
        ELSE
            u1 := NEW.swiped_id;
            u2 := NEW.swiper_id;
        END IF;

        -- 1. Tạo Match
        INSERT INTO public.matches (user1_id, user2_id)
        VALUES (u1, u2)
        ON CONFLICT (user1_id, user2_id) DO NOTHING
        RETURNING id INTO new_match_id;

        IF new_match_id IS NULL THEN
            SELECT id INTO new_match_id
            FROM public.matches
            WHERE user1_id = u1 AND user2_id = u2;
        END IF;

        -- 2. Kiểm tra xem giữa u1 và u2 đã có hội thoại 1-1 nào chưa
        SELECT c.id INTO new_conv_id
        FROM public.conversations c
        JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = u1
        JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = u2
        WHERE c.type IN ('friend', 'match')
        ORDER BY
          EXISTS (SELECT 1 FROM public.messages msg WHERE msg.conversation_id = c.id AND msg.is_deleted = false) DESC,
          c.created_at ASC
        LIMIT 1;

        -- 3. Nếu chưa có hội thoại nào, tạo mới hội thoại loại 'match' TRƯỚC khi insert friendships
        IF new_conv_id IS NULL AND new_match_id IS NOT NULL THEN
            INSERT INTO public.conversations (type, match_id)
            VALUES ('match', new_match_id)
            ON CONFLICT (match_id) DO NOTHING
            RETURNING id INTO new_conv_id;

            IF new_conv_id IS NULL THEN
                SELECT id INTO new_conv_id
                FROM public.conversations
                WHERE match_id = new_match_id;
            END IF;

            IF new_conv_id IS NOT NULL THEN
                INSERT INTO public.conversation_members (conversation_id, user_id)
                VALUES (new_conv_id, u1), (new_conv_id, u2)
                ON CONFLICT (conversation_id, user_id) DO NOTHING;
            END IF;
        ELSIF new_conv_id IS NOT NULL AND new_match_id IS NOT NULL THEN
            -- Liên kết match_id vào hội thoại đã có nếu chưa gắn
            UPDATE public.conversations
            SET match_id = new_match_id
            WHERE id = new_conv_id AND match_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.conversations WHERE match_id = new_match_id);
        END IF;

        -- 4. Tự động thêm vào friendships sau khi đã đảm bảo hội thoại duy nhất
        INSERT INTO public.friendships (user1_id, user2_id)
        VALUES (u1, u2)
        ON CONFLICT (user1_id, user2_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
