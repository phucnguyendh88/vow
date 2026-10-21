import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/swipe
 * Ghi nhận quyết định Like/Pass của người dùng.
 *
 * Logic bảo mật:
 * - Xác thực user từ session (không tin request body)
 * - swiper_id luôn là auth.uid() — không để client tự set
 * - Kiểm tra không tự swipe chính mình
 * - DB trigger handle_match() tự động tạo Match + Conversation nếu 2 bên cùng Like
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
  if (!swiped_id || typeof swiped_id !== 'string') {
    return NextResponse.json({ error: 'swiped_id is required' }, { status: 400 })
  }

  if (!['like', 'pass'].includes(action)) {
    return NextResponse.json({ error: 'action must be "like" or "pass"' }, { status: 400 })
  }

  // Không tự swipe chính mình
  if (swiped_id === user.id) {
    return NextResponse.json({ error: 'Cannot swipe yourself' }, { status: 400 })
  }

  // Kiểm tra profile target tồn tại và không bị ban
  const { data: profileResult, error: profileError } = await supabase
    .from('profiles')
    .select('id, is_active, is_banned')
    .eq('id', swiped_id)
    .single()

  const targetProfile = profileResult as { id: string; is_active: boolean; is_banned: boolean } | null

  if (profileError || !targetProfile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!targetProfile.is_active || targetProfile.is_banned) {
    return NextResponse.json({ error: 'Profile is not available' }, { status: 410 })
  }

  // Kiểm tra block (2 chiều)
  const { data: blockExists } = await supabase
    .from('blocks')
    .select('id')
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${swiped_id}),and(blocker_id.eq.${swiped_id},blocked_id.eq.${user.id})`
    )
    .limit(1)

  if (blockExists && blockExists.length > 0) {
    return NextResponse.json({ error: 'Cannot interact with this user' }, { status: 403 })
  }

  // Ghi nhận swipe — UNIQUE constraint sẽ ngăn duplicate
  const { data: swipe, error: swipeError } = await (supabase
    .from('swipes') as any)
    .upsert(
      {
        swiper_id: user.id,
        swiped_id,
        action,
        context,
      },
      {
        onConflict: 'swiper_id,swiped_id,context',
        ignoreDuplicates: false, // Cho phép update action nếu cần
      }
    )
    .select()
    .single()

  if (swipeError) {
    console.error('Swipe error:', swipeError)
    return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 })
  }

  // Kiểm tra xem đã tạo Match chưa (DB trigger xử lý, ta chỉ query kết quả)
  let match = null
  let conversationId = null
  if (action === 'like') {
    const minId = user.id < swiped_id ? user.id : swiped_id
    const maxId = user.id < swiped_id ? swiped_id : user.id

    const { data: matchData } = await (supabase
      .from('matches') as any)
      .select('id, created_at, conversations(id)')
      .eq('user1_id', minId)
      .eq('user2_id', maxId)
      .maybeSingle()

    if (matchData) {
      match = matchData

      // Tự động kết bạn khi Match: đảm bảo có bản ghi trong bảng friendships
      try {
        await (supabase.from('friendships') as any)
          .upsert(
            { user1_id: minId, user2_id: maxId },
            { onConflict: 'user1_id,user2_id' }
          )
      } catch {}

      const convList = (matchData as any).conversations
      conversationId = Array.isArray(convList) ? convList[0]?.id : convList?.id ?? null
      if (!conversationId) {
        try {
          const { data: convRpc } = await (supabase.rpc as any)('get_or_create_direct_conversation', {
            other_user: swiped_id,
          })
          conversationId = convRpc ?? null
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
