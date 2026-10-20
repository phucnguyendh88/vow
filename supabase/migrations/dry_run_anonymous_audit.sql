-- ==============================================================================
-- DRY RUN: AUDIT TÀI KHOẢN KHÁCH (ANONYMOUS USERS)
-- Lưu ý: Đây là script CHỈ ĐỌC (SELECT / DRY RUN).
-- TUYỆT ĐỐI KHÔNG CHẠY LỆNH XÓA (DELETE) VÀ KHÔNG KÍCH HOẠT CRON.
-- ==============================================================================

-- BƯỚC 1: Thống kê tổng số tài khoản Anonymous so với tài khoản chính thức
SELECT
  COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS total_anonymous_users,
  COUNT(*) FILTER (WHERE is_anonymous = FALSE OR is_anonymous IS NULL) AS total_permanent_users,
  COUNT(*) AS total_auth_users
FROM auth.users;

-- BƯỚC 2: Thống kê tài khoản Anonymous theo mốc thời gian tạo
SELECT
  COUNT(*) FILTER (WHERE is_anonymous = TRUE AND created_at < NOW() - INTERVAL '24 hours') AS anon_older_than_24h,
  COUNT(*) FILTER (WHERE is_anonymous = TRUE AND created_at < NOW() - INTERVAL '7 days') AS anon_older_than_7d,
  COUNT(*) FILTER (WHERE is_anonymous = TRUE AND created_at < NOW() - INTERVAL '30 days') AS anon_older_than_30d,
  COUNT(*) FILTER (WHERE is_anonymous = TRUE AND created_at >= NOW() - INTERVAL '24 hours') AS anon_created_last_24h
FROM auth.users;

-- BƯỚC 3: Liệt kê các tài khoản Anonymous là "ỨNG VIÊN RÁC" (DRY RUN)
-- Tiêu chí an toàn nghiêm ngặt:
-- 1. is_anonymous = TRUE
-- 2. Tạo hơn 24 giờ trước
-- 3. Profile chưa hoàn thiện (is_complete = FALSE) hoặc không có tên thật (chỉ có user_xxxxxx)
-- 4. Không có bất kỳ Khoảnh khắc nào (moments = 0)
-- 5. Không có bất kỳ Tin nhắn nào (messages = 0)
-- 6. Không có Bạn bè nào (friendships = 0)
-- 7. Không có Lượt ghép đôi nào (matches = 0)
-- 8. Không có Cảm xúc tin nhắn nào (reactions = 0)
WITH candidate_users AS (
  SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    p.username,
    p.full_name,
    p.is_complete,
    (SELECT COUNT(*) FROM public.moments m WHERE m.user_id = u.id) AS moments_count,
    (SELECT COUNT(*) FROM public.messages msg WHERE msg.sender_id = u.id) AS messages_sent_count,
    (SELECT COUNT(*) FROM public.friendships f WHERE f.user1_id = u.id OR f.user2_id = u.id) AS friendships_count,
    (SELECT COUNT(*) FROM public.matches mt WHERE mt.user1_id = u.id OR mt.user2_id = u.id) AS matches_count,
    (SELECT COUNT(*) FROM public.message_reactions mr WHERE mr.user_id = u.id) AS reactions_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.is_anonymous = TRUE
    AND u.created_at < NOW() - INTERVAL '24 hours'
)
SELECT
  id,
  created_at,
  last_sign_in_at,
  username,
  full_name,
  is_complete,
  moments_count,
  messages_sent_count,
  friendships_count,
  matches_count,
  reactions_count,
  CASE
    WHEN (moments_count = 0 AND messages_sent_count = 0 AND friendships_count = 0 AND matches_count = 0 AND reactions_count = 0)
      THEN 'UNG_VIEN_CO_THE_DON_DEP'
    ELSE 'GIU_LAI_CO_DU_LIEU_QUAN_TRONG'
  END AS evaluation_status
FROM candidate_users
ORDER BY created_at DESC
LIMIT 100;
