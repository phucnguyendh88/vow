import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { STICKERS } from '@/lib/stickers'

function computeAvatarGradient(name: string): { background: string; initial: string } {
  let hash = 0
  const trimmed = name.trim()
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 62%, 44%) 0%, hsl(${
      (hue + 55) % 360
    }, 66%, 26%) 100%)`,
    initial: (trimmed.charAt(0) || '?').toUpperCase(),
  }
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return 'Vừa xong'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMessagePreview(content?: string | null): string {
  if (!content) return 'Bắt đầu cuộc trò chuyện'
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
  for (const row of (allMembersRes.data ?? []) as any[]) {
    const prof = row.profiles
    const list = membersByConv.get(row.conversation_id) || []
    list.push({
      id: row.user_id,
      name: prof?.full_name || prof?.username || 'Người dùng VOW',
      avatar: prof?.avatar_url || null,
    })
    membersByConv.set(row.conversation_id, list)
  }

  const latestMsgByConv = new Map<string, { content: string; created_at: string }>()
  for (const msg of (messagesRes.data ?? []) as any[]) {
    if (!latestMsgByConv.has(msg.conversation_id)) {
      latestMsgByConv.set(msg.conversation_id, {
        content: msg.content,
        created_at: msg.created_at,
      })
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

      return {
        id: conv.id,
        name: peer?.name || 'Người dùng VOW',
        photo: peer?.avatar || null,
        isFriendOrGroup,
        lastMessage: formatMessagePreview(lastMsg?.content),
        lastMessageAt: lastMsg?.created_at || conv.created_at,
      }
    })
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))

  return (
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
                      <span className="truncate font-medium text-cream">{conv.name}</span>
                      {conv.isFriendOrGroup && (
                        <span className="shrink-0 text-muted">
                          <PeopleBadgeIcon size={16} />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">{conv.lastMessage}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-xs text-muted">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
