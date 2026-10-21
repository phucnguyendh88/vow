import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PAGE_SIZE = 30

/**
 * GET /api/messages?conversation_id=<id>&before=<created_at>
 * Lấy lịch sử tin nhắn có phân trang (cursor-based).
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversation_id')
  const before = searchParams.get('before') // cursor: created_at của tin nhắn cuối đã load

  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 })
  }

  // Kiểm tra membership
  // deno-lint-ignore no-explicit-any
  const { data: isMember } = await (supabase.rpc as any)('is_conversation_member', {
    conv_id: conversationId,
    check_user_id: user.id,
  })

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data: messages, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return NextResponse.json({
    messages: messages ?? [],
    hasMore: (messages?.length ?? 0) === PAGE_SIZE,
  })
}

/**
 * POST /api/messages
 * Gửi tin nhắn mới với idempotency_key để chống duplicate.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { conversation_id, content, idempotency_key } = body

  if (!conversation_id || typeof conversation_id !== 'string') {
    return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 })
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  if (content.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 })
  }

  // Kiểm tra membership
  // deno-lint-ignore no-explicit-any
  const { data: isMember } = await (supabase.rpc as any)('is_conversation_member', {
    conv_id: conversation_id,
    check_user_id: user.id,
  })

  if (!isMember) {
    // Kiểm tra nếu cuộc trò chuyện thuộc về match của user thì tự động đảm bảo ghi nhận thành viên
    const { data: conv } = await (supabase
      .from('conversations') as any)
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
      } catch {}
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Nếu có idempotency_key, kiểm tra xem message đã được tạo chưa
  if (idempotency_key) {
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id, conversation_id, content, created_at')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle()

    if (existingMsg) {
      // Message đã tồn tại — return nó (idempotent response)
      return NextResponse.json({ success: true, message: existingMsg, duplicate: true })
    }
  }

  // Tạo message mới
  const { data: message, error: msgError } = await (supabase
    .from('messages') as any)
    .insert({
      conversation_id,
      sender_id: user.id,
      content: content.trim(),
      idempotency_key: idempotency_key ?? null,
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
    if (msgError.code === '23505') {
      const { data: existing } = await supabase
        .from('messages')
        .select('*')
        .eq('idempotency_key', idempotency_key)
        .single()
      return NextResponse.json({ success: true, message: existing, duplicate: true })
    }
    console.error('Send message error:', msgError)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message, duplicate: false }, { status: 201 })
}
