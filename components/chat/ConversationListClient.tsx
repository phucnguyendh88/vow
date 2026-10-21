'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { STICKERS } from '@/lib/stickers'

export interface EnrichedConversation {
  id: string
  partnerId: string
  name: string
  photo: string | null
  isFriendOrGroup: boolean
  unreadCount: number
  hasActualMessage: boolean
  lastMessage: string
  lastMessageAt: string | null
  mergedConvIds?: string[]
}

interface Props {
  initialConversations: EnrichedConversation[]
  currentUserId: string
}

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

export default function ConversationListClient({ initialConversations, currentUserId }: Props) {
  const router = useRouter()
  const [conversations, setConversations] = useState<EnrichedConversation[]>(initialConversations)
  const supabase = createClient()

  // Đồng bộ khi server gửi dữ liệu mới (ví dụ sau router.refresh)
  useEffect(() => {
    setConversations(initialConversations)
  }, [initialConversations])

  // Lắng nghe Realtime tin nhắn mới để cập nhật tức thì danh sách mà không cần tải lại trang
  useEffect(() => {
    let channel: any = null

    try {
      channel = supabase
        .channel('tin_nhan_list_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const rawNew = payload?.new as any
            if (!rawNew || !rawNew.id || !rawNew.conversation_id) return

            const convId = String(rawNew.conversation_id)
            const senderId = String(rawNew.sender_id || '')
            const isMe = senderId === currentUserId

            setConversations((prev) => {
              const safePrev = Array.isArray(prev) ? prev : []
              const idx = safePrev.findIndex(
                (c) => c.id === convId || (Array.isArray(c.mergedConvIds) && c.mergedConvIds.includes(convId))
              )

              if (idx === -1) {
                // Cuộc trò chuyện mới chưa có trong danh sách -> gọi server refresh
                router.refresh()
                return safePrev
              }

              const target = safePrev[idx]
              const updatedItem: EnrichedConversation = {
                ...target,
                hasActualMessage: true,
                lastMessage: formatMessagePreview(rawNew.content),
                lastMessageAt: rawNew.created_at || new Date().toISOString(),
                unreadCount: isMe ? target.unreadCount : target.unreadCount + 1,
              }

              // Đẩy cuộc trò chuyện vừa có tin nhắn lên đầu bảng
              const remaining = safePrev.filter((_, i) => i !== idx)
              return [updatedItem, ...remaining]
            })
          }
        )
        .subscribe()
    } catch (err) {
      console.warn('Realtime conversation list error:', err)
    }

    // Tự động làm mới khi người dùng mở lại tab hoặc mở khóa màn hình điện thoại
    const handleVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          router.refresh()
        }
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('focus', handleVisibility)
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {}
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleVisibility)
      }
    }
  }, [currentUserId, router, supabase])

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface2 text-muted">
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="mt-4 font-serif text-lg text-cream">Chưa có tin nhắn nào</p>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Kết nối với những người bạn mới tại mục Kết nối để bắt đầu trò chuyện.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-white/5">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <Link
            href={`/tin-nhan/${conv.id}`}
            prefetch={false}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface2"
          >
            <ConversationAvatar name={conv.name} photo={conv.photo} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`truncate ${
                    conv.unreadCount > 0 ? 'font-semibold text-white' : 'font-medium text-cream'
                  }`}
                >
                  {conv.name}
                </span>
                {conv.isFriendOrGroup && (
                  <span className="shrink-0 text-muted">
                    <PeopleBadgeIcon size={16} />
                  </span>
                )}
              </div>
              <p
                className={`mt-0.5 truncate text-sm ${
                  conv.unreadCount > 0 ? 'font-medium text-white' : 'text-muted'
                }`}
              >
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
  )
}
