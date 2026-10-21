-- ==============================================================================
-- FIX CHAT PERFORMANCE INDEXES
-- Tối ưu hóa truy vấn tin nhắn và hội thoại tức thì (<50ms)
-- ==============================================================================

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
