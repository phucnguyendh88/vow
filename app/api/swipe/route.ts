import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/swipe
 * Ghi nhận quyết định Like/Pass của người dùng.
 *
 * Logic bảo mật:
 * - Xác thực user từ session (không tin request body)
 * - swiper_id luôn là auth.uid() — không để client tự set
 * - Kiểm tra không tự swipe chính mình
 * - DB trigger handle_match() tự động tạo Match + Conversation + Friendship nếu 2 bên cùng Like
 * - UNIQUE constraint (swiper_id, swiped_id, context) chống duplicate
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  // Xác thực user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { swiped_id, action, context = 'dating' } = body

  // Validate input
  if (!swiped_id || typeof swiped_id !== 'string' || !UUID_REGEX.test(swiped_id)) {
    return NextResponse.json({ error: 'Valid swiped_id is required' }, { status: 400 })
  }

  if (!['like', 'pass'].includes(action)) {
    return NextResponse.json({ error: 'action must be "like" or "pass"' }, { status: 400 })
  }

  if (typeof context !== 'string' || !['dating', 'friend'].includes(context)) {
    return NextResponse.json({ error: 'context must be "dating" or "friend"' }, { status: 400 })
  }

  // Không tự swipe chính mình
  if (swiped_id === user.id) {
    return NextResponse.json({ error: 'Cannot swipe yourself' }, { status: 400 })
  }

  // Chạy song song: kiểm tra profiles (cả người quẹt lẫn đối phương) và kiểm tra block 2 chiều
  const [profilesRes, blockRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, is_active, is_banned')
      .in('id', [user.id, swiped_id]),
    supabase
      .from('blocks')
      .select('id')
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.eq.${swiped_id}),and(blocker_id.eq.${swiped_id},blocked_id.eq.${user.id})`
      )
      .limit(1),
  ])

  const profilesList = (profilesRes.data ?? []) as Array<{
    id: string
    is_active: boolean
    is_banned: boolean
  }>
  const swiperProfile = profilesList.find((p) => p.id === user.id)
  const targetProfile = profilesList.find((p) => p.id === swiped_id)

  if (swiperProfile?.is_banned) {
    return NextResponse.json({ error: 'Account is suspended' }, { status: 403 })
  }

  if (profilesRes.error || !targetProfile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!targetProfile.is_active || targetProfile.is_banned) {
    return NextResponse.json({ error: 'Profile is not available' }, { status: 410 })
  }

  if (blockRes.data && blockRes.data.length > 0) {
    return NextResponse.json({ error: 'Cannot interact with this user' }, { status: 403 })
  }

  // Ghi nhận swipe — UNIQUE constraint sẽ ngăn duplicate
  const { data: swipe, error: swipeError } = await (supabase.from('swipes') as any)
    .upsert(
      {
        swiper_id: user.id,
        swiped_id,
        action: action as 'like' | 'pass',
        context,
      },
      {
        onConflict: 'swiper_id,swiped_id,context',
        ignoreDuplicates: false, // Cho phép update action nếu cần (rediscoverMode)
      }
    )
    .select()
    .single()

  if (swipeError) {
    console.error('Swipe error:', swipeError)
    return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 })
  }

  // Kiểm tra xem đã tạo Match chưa (DB trigger handle_match xử lý tạo match + friendship + conversation)
  let match = null
  let conversationId: string | null = null
  if (action === 'like') {
    const minId = user.id < swiped_id ? user.id : swiped_id
    const maxId = user.id < swiped_id ? swiped_id : user.id

    const { data: matchData } = await (supabase.from('matches') as any)
      .select('id, created_at, conversations(id)')
      .eq('user1_id', minId)
      .eq('user2_id', maxId)
      .maybeSingle()

    if (matchData) {
      match = matchData
      const convList = (matchData as any).conversations
      conversationId = Array.isArray(convList) ? convList[0]?.id ?? null : convList?.id ?? null

      // Chỉ gọi RPC fallback nếu trigger chưa kịp liên kết match_id vào conversation
      if (!conversationId) {
        try {
          const { data: convRpc } = await (supabase.rpc as any)('get_or_create_direct_conversation', {
            other_user: swiped_id,
          })
          if (convRpc) {
            conversationId = convRpc
          }
        } catch {}
      }
    }
  }

  return NextResponse.json({
    success: true,
    swipe,
    matched: !!match,
    match: match ? { ...match, conversation_id: conversationId } : null,
    conversation_id: conversationId,
  })
}
