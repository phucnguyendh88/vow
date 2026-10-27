import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PAGE_SIZE = 30
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/messages?conversation_id=<id>&before=<created_at>
 * Lấy lịch sử tin nhắn có phân trang (cursor-based).
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversation_id')?.trim()
  const before = searchParams.get('before')?.trim() // cursor: created_at của tin nhắn cuối đã load

  if (!conversationId || !UUID_REGEX.test(conversationId)) {
    return NextResponse.json({ error: 'Valid conversation_id is required' }, { status: 400 })
  }

  let query = supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      is_deleted,
      created_at,
      idempotency_key,
      profiles:sender_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (before) {
    query = query.lt('created_at', before)
  }

  // Chạy song song kiểm tra membership và lấy danh sách tin nhắn để giảm 1 vòng đợi mạng
  const [memberRes, messagesRes] = await Promise.all([
    (supabase.rpc as any)('is_conversation_member', {
      conv_id: conversationId,
      check_user_id: user.id,
    }),
    query,
  ])

  if (!memberRes.data) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (messagesRes.error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  const messages = messagesRes.data ?? []

  return NextResponse.json({
    messages,
    hasMore: messages.length === PAGE_SIZE,
  })
}

/**
 * POST /api/messages
 * Gửi tin nhắn mới với idempotency_key để chống duplicate.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
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

  const { conversation_id, content, idempotency_key } = body

  if (!conversation_id || typeof conversation_id !== 'string' || !UUID_REGEX.test(conversation_id)) {
    return NextResponse.json({ error: 'Valid conversation_id is required' }, { status: 400 })
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  if (content.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 })
  }

  // Chỉ chấp nhận idempotency_key nếu đúng chuẩn UUID để tránh lỗi 22P02 trên cột UUID
  const safeIdempotencyKey =
    typeof idempotency_key === 'string' && UUID_REGEX.test(idempotency_key.trim())
      ? idempotency_key.trim()
      : null

  // 1. Chạy song song: kiểm tra membership, trạng thái khóa tài khoản và kiểm tra idempotency_key
  const [memberRes, profileRes, existingMsgRes] = await Promise.all([
    (supabase.rpc as any)('is_conversation_member', {
      conv_id: conversation_id,
      check_user_id: user.id,
    }),
    (supabase.from('profiles') as any).select('is_banned').eq('id', user.id).maybeSingle(),
    safeIdempotencyKey
      ? (supabase.from('messages') as any)
          .select('id, conversation_id, sender_id, content, is_deleted, created_at, idempotency_key')
          .eq('idempotency_key', safeIdempotencyKey)
          .eq('sender_id', user.id)
          .eq('conversation_id', conversation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if ((profileRes?.data as any)?.is_banned) {
    return NextResponse.json({ error: 'Account is suspended' }, { status: 403 })
  }

  let isMember = Boolean(memberRes?.data)
  if (!isMember) {
    // Fallback: nếu chưa ghi nhận membership nhưng thuộc về match của user
    const { data: conv } = await (supabase.from('conversations') as any)
      .select('id, match_id, matches(user1_id, user2_id)')
      .eq('id', conversation_id)
      .maybeSingle()

    const matchInfo = (conv as any)?.matches
    if (matchInfo && (matchInfo.user1_id === user.id || matchInfo.user2_id === user.id)) {
      try {
        await (supabase.from('conversation_members') as any).upsert(
          [
            { conversation_id, user_id: matchInfo.user1_id },
            { conversation_id, user_id: matchInfo.user2_id },
          ],
          { onConflict: 'conversation_id,user_id' }
        )
        isMember = true
      } catch {}
    }

    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Chỉ trả về tin nhắn trùng lặp SAU KHI đã xác minh isMember và ownership
  if (existingMsgRes?.data) {
    return NextResponse.json({ success: true, message: existingMsgRes.data, duplicate: true })
  }

  // Tạo message mới
  const { data: message, error: msgError } = await (supabase.from('messages') as any)
    .insert({
      conversation_id,
      sender_id: user.id,
      content: content.trim(),
      idempotency_key: safeIdempotencyKey,
    })
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      is_deleted,
      created_at,
      idempotency_key
    `)
    .single()

  if (msgError) {
    // Check if it's a unique violation (race condition với idempotency_key)
    if (msgError.code === '23505' && safeIdempotencyKey) {
      const { data: existing } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, is_deleted, created_at, idempotency_key')
        .eq('idempotency_key', safeIdempotencyKey)
        .eq('sender_id', user.id)
        .eq('conversation_id', conversation_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ success: true, message: existing, duplicate: true })
      }
    }
    console.error('Send message error:', msgError)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message, duplicate: false }, { status: 201 })
}
