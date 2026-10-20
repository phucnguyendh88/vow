-- ==============================================================================
-- 1. Helper kiểm tra quyền xem khoảnh khắc (STABLE, SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.can_view_moment_of(owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- ==============================================================================
-- 2. RLS policy cho moments & comments
-- ==============================================================================
DROP POLICY IF EXISTS "moments_select_authenticated" ON public.moments;
DROP POLICY IF EXISTS "moments_select_visible" ON public.moments;
CREATE POLICY "moments_select_visible" ON public.moments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.check_admin(auth.uid())
    OR (is_deleted = FALSE AND public.can_view_moment_of(user_id))
  );

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='moment_comments' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.moment_comments', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "moment_comments_select_visible" ON public.moment_comments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.check_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.moments mo WHERE mo.id = moment_id)
  );

-- ==============================================================================
-- 3. Siết chặt bảo mật friend_requests & matches
-- ==============================================================================
DROP POLICY IF EXISTS "friend_requests_insert_sender" ON public.friend_requests;
CREATE POLICY "friend_requests_insert_sender" ON public.friend_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND status = 'pending');

DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
CREATE POLICY "friend_requests_update" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id) OR public.check_admin(auth.uid()))
  WITH CHECK (
    (auth.uid() = receiver_id AND status IN ('accepted', 'rejected'))
    OR (auth.uid() = sender_id AND status = 'cancelled')
    OR public.check_admin(auth.uid())
  );

DROP POLICY IF EXISTS "matches_insert_members" ON public.matches;

-- ==============================================================================
-- 4. RPC lấy hoặc tạo cuộc trò chuyện 1-1 an toàn
-- ==============================================================================
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

  SELECT c.id INTO conv
  FROM public.conversations c
  JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = me
  JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = other_user
  WHERE c.type IN ('friend', 'match')
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF conv IS NULL THEN
    INSERT INTO public.conversations (type) VALUES ('friend') RETURNING id INTO conv;
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (conv, me), (conv, other_user)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN conv;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID) TO authenticated;

-- ==============================================================================
-- 5. Trigger tự động tạo cuộc trò chuyện khi kết bạn + Backfill
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_friendship_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = NEW.user1_id
    JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = NEW.user2_id
    WHERE c.type IN ('friend', 'match')
  ) THEN
    INSERT INTO public.conversations (type) VALUES ('friend') RETURNING id INTO conv;
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (conv, NEW.user1_id), (conv, NEW.user2_id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_friendship_conversation ON public.friendships;
CREATE TRIGGER trigger_friendship_conversation
  AFTER INSERT ON public.friendships
  FOR EACH ROW EXECUTE PROCEDURE public.handle_friendship_conversation();

-- Backfill dữ liệu cho những bạn bè cũ chưa có cuộc trò chuyện
DO $$
DECLARE
  f RECORD;
  conv UUID;
BEGIN
  FOR f IN SELECT user1_id, user2_id FROM public.friendships LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = f.user1_id
      JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = f.user2_id
      WHERE c.type IN ('friend', 'match')
    ) THEN
      INSERT INTO public.conversations (type) VALUES ('friend') RETURNING id INTO conv;
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES (conv, f.user1_id), (conv, f.user2_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 6. Kích hoạt Supabase Realtime cho bảng messages
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;