export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary'
import ConversationListClient, { EnrichedConversation } from '@/components/chat/ConversationListClient'
import { STICKERS } from '@/lib/stickers'

function formatMessagePreview(content?: any): string {
  if (!content) return 'Bắt đầu cuộc trò chuyện'
  if (typeof content !== 'string') return 'Tin nhắn mới'
  if (content.startsWith('[moment_reply:')) {
    const body = content.replace(/^\[moment_reply:[^\]]*\]\s*/, '')
    if (body.startsWith('[sticker:') && body.endsWith(']')) {
      const key = body.slice(9, -1)
      const found = STICKERS.find((s) => s.key === key)
      return `[Khoảnh khắc] Nhãn dán ${found ? found.label : ''}`
    }
    return `[Khoảnh khắc] ${body || 'Đã gửi phản hồi'}`
  }
  if (content.startsWith('[sticker:') && content.endsWith(']')) {
    const key = content.slice(9, -1)
    const found = STICKERS.find((s) => s.key === key)
    return found ? `[Nhãn dán] ${found.label}` : 'Đã gửi một nhãn dán'
  }
  return content
}

export default async function TinNhanPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/dang-nhap')

  let error: any = null
  let enrichedConversations: EnrichedConversation[] = []

  try {
    // 1. Fetch conversations where current user is a member
    const membershipsRes = await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        joined_at,
        last_read_at,
        conversations (
          id,
          type,
          created_at,
          match_id
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(50)

    error = membershipsRes.error
    const myMemberships = membershipsRes.data ?? []

    const rawConvs = (myMemberships ?? [])
      .map((r: any) => {
        const c = Array.isArray(r?.conversations) ? r.conversations[0] : r?.conversations
        return c && typeof c.id === 'string' ? c : null
      })
      .filter(Boolean) as Array<{
      id: string
      type: string
      created_at: string
      match_id: string | null
    }>

    const convIds = Array.from(new Set(rawConvs.map((c) => c.id)))

    // 2. Fetch all members + profiles, latest messages, and friendships in parallel
    const [allMembersRes, messagesRes, friendshipsRes] =
      convIds.length > 0
        ? await Promise.all([
            supabase
              .from('conversation_members')
              .select(`
                conversation_id,
                user_id,
                profiles:user_id (
                  id,
                  username,
                  full_name,
                  avatar_url
                )
              `)
              .in('conversation_id', convIds),

            supabase
              .from('messages')
              .select('id, conversation_id, sender_id, content, created_at')
              .in('conversation_id', convIds)
              .eq('is_deleted', false)
              .order('created_at', { ascending: false })
              .limit(200),

            supabase
              .from('friendships')
              .select('user1_id, user2_id')
              .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }]

    const friendIds = new Set<string>()
    for (const f of (friendshipsRes.data ?? []) as any[]) {
      if (f?.user1_id && f?.user2_id) {
        friendIds.add(f.user1_id === user.id ? f.user2_id : f.user1_id)
      }
    }

    const membersByConv = new Map<
      string,
      Array<{ id: string; name: string; avatar: string | null }>
    >()
    const safeMembersList: any[] = Array.isArray(allMembersRes?.data) ? allMembersRes.data : []
    for (const row of safeMembersList) {
      let prof: any = row?.profiles
      if (Array.isArray(prof)) prof = prof[0]
      const convId = String(row?.conversation_id || '')
      if (!convId) continue
      const list = membersByConv.get(convId) || []
      const memberName =
        typeof prof?.full_name === 'string' && prof.full_name.trim().length > 0
          ? prof.full_name.trim()
          : typeof prof?.username === 'string' && prof.username.trim().length > 0
          ? prof.username.trim()
          : 'Người dùng VOW'
      list.push({
        id: String(row?.user_id || ''),
        name: memberName,
        avatar: typeof prof?.avatar_url === 'string' ? prof.avatar_url : null,
      })
      membersByConv.set(convId, list)
    }

    const latestMsgByConv = new Map<string, { content: string; created_at: string }>()
    const safeMessagesList: any[] = Array.isArray(messagesRes?.data) ? messagesRes.data : []
    for (const msg of safeMessagesList) {
      const convId = String(msg?.conversation_id || '')
      if (convId && !latestMsgByConv.has(convId)) {
        latestMsgByConv.set(convId, {
          content: typeof msg?.content === 'string' ? msg.content : '',
          created_at: typeof msg?.created_at === 'string' ? msg.created_at : '',
        })
      }
    }

    const lastReadByConv = new Map<string, string | null>()
    const safeMembershipsList: any[] = Array.isArray(myMemberships) ? myMemberships : []
    for (const m of safeMembershipsList) {
      if (m?.conversation_id) {
        lastReadByConv.set(String(m.conversation_id), m.last_read_at ?? m.joined_at ?? null)
      }
    }

    const unreadCountByConv = new Map<string, number>()
    for (const msg of safeMessagesList) {
      const convId = String(msg?.conversation_id || '')
      if (convId && msg.sender_id !== user.id) {
        const lastRead = lastReadByConv.get(convId)
        if (!lastRead || msg.created_at > lastRead) {
          unreadCountByConv.set(
            convId,
            (unreadCountByConv.get(convId) || 0) + 1
          )
        }
      }
    }

    const candidateConversations = rawConvs.map((conv) => {
      const members = membersByConv.get(conv.id) || []
      const peer = members.find((m) => m.id !== user.id) || members[0]
      const lastMsg = latestMsgByConv.get(conv.id)
      const hasActualMessage = Boolean(
        lastMsg && typeof lastMsg.content === 'string' && lastMsg.content.trim().length > 0
      )
      const isFriendOrGroup =
        conv.type === 'friend' ||
        conv.type === 'group' ||
        (peer ? friendIds.has(peer.id) : false)
      const unreadCount = Number(unreadCountByConv.get(conv.id)) || 0
      const partnerId =
        conv.type === 'group'
          ? `group_${conv.id}`
          : String(peer?.id || `conv_${conv.id}`)

      return {
        id: String(conv.id),
        partnerId,
        name: String(peer?.name || 'Người dùng VOW'),
        photo: typeof peer?.avatar === 'string' ? peer.avatar : null,
        isFriendOrGroup: Boolean(isFriendOrGroup),
        unreadCount,
        hasActualMessage,
        lastMessage: String(formatMessagePreview(lastMsg?.content)),
        lastMessageAt: lastMsg?.created_at || conv.created_at || null,
        mergedConvIds: [String(conv.id)],
      }
    })

    // Deduplicate conversations by partnerId (1 row per user pair)
    const dedupedByPartner = new Map<string, (typeof candidateConversations)[number]>()
    for (const item of candidateConversations) {
      const existing = dedupedByPartner.get(item.partnerId)
      if (!existing) {
        dedupedByPartner.set(item.partnerId, item)
        continue
      }

      // Prefer the conversation that has actual messages; otherwise prefer the newer timestamp
      let itemWins = false
      if (item.hasActualMessage && !existing.hasActualMessage) {
        itemWins = true
      } else if (!item.hasActualMessage && existing.hasActualMessage) {
        itemWins = false
      } else {
        itemWins = (item.lastMessageAt || '') > (existing.lastMessageAt || '')
      }

      const primary = itemWins ? item : existing
      const secondary = itemWins ? existing : item

      dedupedByPartner.set(item.partnerId, {
        ...primary,
        name: primary.name !== 'Người dùng VOW' ? primary.name : secondary.name,
        photo: primary.photo || secondary.photo,
        isFriendOrGroup: primary.isFriendOrGroup || secondary.isFriendOrGroup,
        unreadCount: existing.unreadCount + item.unreadCount,
        mergedConvIds: Array.from(
          new Set([...(existing.mergedConvIds || [existing.id]), ...(item.mergedConvIds || [item.id])])
        ),
      })
    }

    enrichedConversations = Array.from(dedupedByPartner.values()).sort((a, b) =>
      (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')
    )
  } catch (err) {
    console.error('[TinNhanPage] Error loading conversations:', err)
    error = err
  }

  return (
    <Suspense fallback={<div className="min-h-[calc(100dvh-6rem)] bg-[#050505]" />}>
      <ChatErrorBoundary>
        <div className="flex h-full min-h-[calc(100dvh-6rem)] flex-col bg-ink">
          <header className="flex items-center px-4 pb-2 pt-4">
            <h1 className="font-serif text-3xl text-cream">Tin nhắn</h1>
          </header>

          <div className="nice-scroll flex-1 overflow-y-auto pb-6">
            {error ? (
              <div className="px-4 py-10 text-center text-sm text-muted">
                Không tải được tin nhắn. Vui lòng thử lại sau.
              </div>
            ) : (
              <ConversationListClient
                initialConversations={enrichedConversations}
                currentUserId={user.id}
              />
            )}
          </div>
        </div>
      </ChatErrorBoundary>
    </Suspense>
  )
}
