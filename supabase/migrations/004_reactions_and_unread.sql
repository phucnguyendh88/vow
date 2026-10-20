-- ==============================================================================
-- Migration 004: Reactions & Unread Tracking
-- ==============================================================================

-- 1. Thêm cột last_read_at vào conversation_members để tính unread messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversation_members'
      AND column_name = 'last_read_at'
  ) THEN
    ALTER TABLE public.conversation_members
      ADD COLUMN last_read_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conv_members_user_last_read
  ON public.conversation_members(user_id, last_read_at);

-- 2. Tạo bảng message_reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction TEXT NOT NULL CHECK (reaction IN ('heart', 'laugh', 'like')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
    CONSTRAINT unique_message_user_reaction UNIQUE (message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON public.message_reactions(user_id);

-- 3. RLS cho message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reactions_select" ON public.message_reactions;
CREATE POLICY "message_reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_reactions_insert" ON public.message_reactions;
CREATE POLICY "message_reactions_insert" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_reactions_delete" ON public.message_reactions;
CREATE POLICY "message_reactions_delete" ON public.message_reactions
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
  );

-- 4. Kích hoạt Supabase Realtime cho bảng message_reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

-- 5. RPC đánh dấu đã đọc cuộc trò chuyện
CREATE OR REPLACE FUNCTION public.mark_conversation_read(conv_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.conversation_members
  SET last_read_at = TIMEZONE('utc'::TEXT, NOW())
  WHERE conversation_id = conv_id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

-- 6. RPC đếm tổng số tin nhắn chưa đọc của user hiện tại
CREATE OR REPLACE FUNCTION public.get_unread_messages_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(m.id)::INTEGER, 0)
  FROM public.messages m
  JOIN public.conversation_members cm
    ON cm.conversation_id = m.conversation_id
   AND cm.user_id = auth.uid()
  WHERE m.sender_id <> auth.uid()
    AND m.is_deleted = FALSE
    AND m.created_at > cm.joined_at
    AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at);
$$;

REVOKE ALL ON FUNCTION public.get_unread_messages_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_messages_count() TO authenticated;
