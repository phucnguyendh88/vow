import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { STICKERS } from '@/lib/stickers'
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary'

const getInitial = (name?: string | null): string => {
  if (typeof name === 'string' && name.trim().length > 0) {
    return name.trim().charAt(0).toUpperCase()
  }
  return 'U'
}

function computeAvatarGradient(name?: string | null): { background: string; initial: string } {
  const safeName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'U'
  let hash = 0
  for (let i = 0; i < safeName.length; i++) {
    hash = (hash * 31 + safeName.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 62%, 44%) 0%, hsl(${
      (hue + 55) % 360
    }, 66%, 26%) 100%)`,
    initial: getInitial(safeName),
  }
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const timestamp = d.getTime()
    if (isNaN(timestamp)) return ''
    const diff = Date.now() - timestamp
    if (diff < 0) return 'Vừa xong'
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins} phút trước`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} giờ trước`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} ngày trước`
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return d.getFullYear() === new Date().getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`
  } catch {
    return ''
  }
}

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

function PeopleBadgeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ConversationAvatar({
  name,
  photo,
  size = 52,
}: {
  name: string
  photo?: string | null
  size?: number
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  const { background, initial } = computeAvatarGradient(name)
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-cream"
      style={{ width: size, height: size, background }}
    >
      <span className="font-serif font-semibold" style={{ fontSize: size * 0.42 }}>
        {initial}
      </span>
    </div>
  )
}

export default async function TinNhanPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/dang-nhap')

  // 1. Fetch conversations where current user is a member
  const { data: myMemberships, error } = await supabase
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

  const rawConvs = (myMemberships ?? [])
    .map((r: any) => r.conversations)
    .filter(Boolean) as Array<{
    id: string
    type: string
    created_at: string
    match_id: string | null
  }>

  const convIds = rawConvs.map((c) => c.id)

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
    friendIds.add(f.user1_id === user.id ? f.user2_id : f.user1_id)
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

  const enrichedConversations = rawConvs
    .map((conv) => {
      const members = membersByConv.get(conv.id) || []
      const peer = members.find((m) => m.id !== user.id) || members[0]
      const lastMsg = latestMsgByConv.get(conv.id)
      const isFriendOrGroup =
        conv.type === 'friend' ||
        conv.type === 'group' ||
        (peer ? friendIds.has(peer.id) : false)
      const unreadCount = Number(unreadCountByConv.get(conv.id)) || 0

      return {
        id: String(conv.id),
        name: String(peer?.name || 'Người dùng VOW'),
        photo: typeof peer?.avatar === 'string' ? peer.avatar : null,
        isFriendOrGroup: Boolean(isFriendOrGroup),
        unreadCount,
        lastMessage: String(formatMessagePreview(lastMsg?.content)),
        lastMessageAt: lastMsg?.created_at || conv.created_at || null,
      }
    })
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))

  return (
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
          ) : enrichedConversations.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <p className="font-serif text-2xl text-cream">Chưa có tin nhắn</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ghép đôi ở tab Kết nối để bắt đầu trò chuyện.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {enrichedConversations.map((conv) => (
                <li key={conv.id}>
                  <Link
                    href={`/tin-nhan/${conv.id}`}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface2"
                  >
                    <ConversationAvatar name={conv.name} photo={conv.photo} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`truncate ${conv.unreadCount > 0 ? 'font-semibold text-white' : 'font-medium text-cream'}`}>
                          {conv.name}
                        </span>
                        {conv.isFriendOrGroup && (
                          <span className="shrink-0 text-muted">
                            <PeopleBadgeIcon size={16} />
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 truncate text-sm ${conv.unreadCount > 0 ? 'font-medium text-white' : 'text-muted'}`}>
                        {conv.lastMessage}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-xs text-muted">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E8D08D] px-1.5 text-[11px] font-bold text-black shadow-[0_0_8px_rgba(232,208,141,0.5)]">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ChatErrorBoundary>
  )
}
