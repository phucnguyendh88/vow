'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STICKERS } from '@/lib/stickers'
import UserProfileModal from '@/components/profile/UserProfileModal'

interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  profiles?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface ConversationMember {
  id: string
  name: string
  avatarUrl: string | null
}

interface Props {
  conversationId: string
  allConversationIds?: string[]
  currentUserId: string
  initialMessages: ChatMessage[]
  partner: ConversationMember | null
}

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function safeText(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  try {
    return JSON.stringify(val)
  } catch {
    return ''
  }
}

function resolveSafeMediaUrl(rawPath?: unknown, supabase?: any): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null
  const trimmed = rawPath.trim()
  if (!trimmed) return null
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed
  }
  try {
    const sb = supabase || createClient()
    const { data } = sb.storage.from('moment-images').getPublicUrl(trimmed)
    return data?.publicUrl || null
  } catch {
    return null
  }
}

function normalizeMessage(rawMsg: any, fallbackConvId = ''): ChatMessage {
  let prof = rawMsg?.profiles
  if (Array.isArray(prof)) prof = prof[0]
  return {
    id: safeText(rawMsg?.id) || safeUUID(),
    conversation_id: safeText(rawMsg?.conversation_id) || fallbackConvId,
    sender_id: safeText(rawMsg?.sender_id),
    content: safeText(rawMsg?.content),
    created_at:
      typeof rawMsg?.created_at === 'string' && rawMsg.created_at.trim()
        ? rawMsg.created_at
        : new Date().toISOString(),
    profiles:
      prof && typeof prof === 'object'
        ? {
            id: safeText(prof.id),
            username: typeof prof.username === 'string' ? prof.username : null,
            full_name: typeof prof.full_name === 'string' ? prof.full_name : null,
            avatar_url: typeof prof.avatar_url === 'string' ? prof.avatar_url : null,
          }
        : null,
  }
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

function MemberAvatar({
  name,
  photo,
  size = 40,
}: {
  name?: string | null
  photo?: string | null
  size?: number
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const safeName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'U'
  const safePhoto = resolveSafeMediaUrl(photo)
  if (safePhoto && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={safePhoto}
        alt={safeName}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  const { background, initial } = computeAvatarGradient(safeName)
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

function formatDayLabel(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const timestamp = d.getTime()
    if (isNaN(timestamp)) return ''
    const now = new Date()
    const startOfDay = (x: Date) => {
      const c = new Date(x)
      c.setHours(0, 0, 0, 0)
      return c.getTime()
    }
    const diff = startOfDay(now) - startOfDay(d)
    if (diff === 0) return 'Hôm nay'
    if (diff === 86400000) return 'Hôm qua'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return d.getFullYear() === now.getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`
  } catch {
    return ''
  }
}

function formatTimeHHMM(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function BackArrowIcon({ size = 22 }: { size?: number }) {
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

function SendPaperPlaneIcon({ size = 18 }: { size?: number }) {
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
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

function MoreDotsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

function ReactionSvg({
  kind,
  size = 20,
  filled = false,
}: {
  kind: 'heart' | 'laugh' | 'like'
  size?: number
  filled?: boolean
}) {
  if (kind === 'heart') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      </svg>
    )
  }
  if (kind === 'laugh') {
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
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14.5s1.6 2.5 4 2.5 4-2.5 4-2.5" />
        <path d="M9 9.5h.01" />
        <path d="M15 9.5h.01" />
      </svg>
    )
  }
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
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  )
}

const REACTION_TYPES: Array<'heart' | 'laugh' | 'like'> = ['heart', 'laugh', 'like']

interface MomentReplyData {
  momentId: string
  thumbUrl: string
  caption: string
  bodyText: string
}

function parseMomentReply(rawContent: string): MomentReplyData | null {
  const match = rawContent.match(/^\[moment_reply:([^|]+)\|([^|]*)\|([^\]]*)\](?:\s*([\s\S]*))?$/)
  if (!match) return null
  return {
    momentId: match[1],
    thumbUrl: match[2],
    caption: match[3],
    bodyText: (match[4] || '').trim(),
  }
}

export default function ChatClient({
  conversationId,
  allConversationIds,
  currentUserId,
  initialMessages,
  partner,
}: Props) {
  const router = useRouter()

  // 1. Khởi tạo ngay thông tin đối phương từ props hoặc sessionStorage để vẽ Header 0ms
  const [partnerState, setPartnerState] = useState(() => {
    if (partner && partner.name && partner.name !== 'Thành viên') {
      return partner
    }
    if (typeof window !== 'undefined') {
      try {
        const preview = sessionStorage.getItem(`vow_chat_preview_${conversationId}`)
        if (preview) {
          const parsed = JSON.parse(preview)
          return {
            id: parsed.partnerId || partner?.id || '',
            name: parsed.partnerName || partner?.name || 'Thành viên',
            avatarUrl: parsed.partnerAvatar || partner?.avatarUrl || null,
          }
        }
      } catch {}
    }
    return partner || { id: '', name: 'Thành viên', avatarUrl: null }
  })

  useEffect(() => {
    if (partner && partner.name && partner.name !== 'Thành viên') {
      setPartnerState(partner)
    }
  }, [partner])

  // 2. Khởi tạo 30 tin nhắn ngay lập tức từ props hoặc sessionStorage cache (0ms)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const rawList = Array.isArray(initialMessages) ? initialMessages : []
    if (rawList.length > 0) {
      return rawList.map((m) => normalizeMessage(m, conversationId))
    }
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(`vow_chat_messages_${conversationId}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((m) => normalizeMessage(m, conversationId))
          }
        }
      } catch {}
    }
    return []
  })

  // Lưu 30 tin nhắn mới nhất vào sessionStorage cache để mở lại lần sau với tốc độ 0ms
  // Đồng thời cập nhật ngay preview tin nhắn cuối vào vow_last_msg_updates và vow_conversations_cache
  // để khi thoát ra trang /tin-nhan trên iPhone (router.back / BFCache), tin nhắn mới hiện ngay lập tức!
  useEffect(() => {
    if (Array.isArray(messages) && messages.length > 0) {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            `vow_chat_messages_${conversationId}`,
            JSON.stringify(messages.slice(-30))
          )

          const lastMsg = messages[messages.length - 1]
          if (lastMsg && lastMsg.content) {
            const rawUpdates = sessionStorage.getItem('vow_last_msg_updates')
            const updatesMap: Record<
              string,
              { content: string; createdAt: string; senderId: string; readAt: number }
            > = rawUpdates ? JSON.parse(rawUpdates) : {}

            const entry = {
              content: lastMsg.content,
              createdAt: lastMsg.created_at || new Date().toISOString(),
              senderId: lastMsg.sender_id || currentUserId,
              readAt: Date.now(),
            }

            updatesMap[conversationId] = entry
            if (Array.isArray(allConversationIds)) {
              for (const cid of allConversationIds) {
                if (cid) updatesMap[cid] = entry
              }
            }
            sessionStorage.setItem('vow_last_msg_updates', JSON.stringify(updatesMap))
          }
        }
      } catch {}
    }
  }, [conversationId, allConversationIds, currentUserId, messages])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null)
  const [reactionsMap, setReactionsMap] = useState<
    Record<string, Record<'heart' | 'laugh' | 'like', string[]>>
  >({})
  const [sendError, setSendError] = useState<string | null>(null)
  const [showPartnerProfile, setShowPartnerProfile] = useState(false)

  const [viewportHeight, setViewportHeight] = useState<number | null>(null)

  const streamRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const isInitialScrollRef = useRef<boolean>(true)
  const fetchedReactionMsgIdsRef = useRef<Set<string>>(new Set())
  const optimisticMsgIdsRef = useRef<Set<string>>(new Set())
  const supabase = createClient()

  const mergedConvIdsKey = Array.from(
    new Set(
      [conversationId, ...(Array.isArray(allConversationIds) ? allConversationIds : [])].filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0
      )
    )
  ).join(',')

  const mergedConvIds = useMemo(
    () => mergedConvIdsKey.split(',').filter(Boolean),
    [mergedConvIdsKey]
  )

  useEffect(() => {
    isInitialScrollRef.current = true
    fetchedReactionMsgIdsRef.current.clear()
    optimisticMsgIdsRef.current.clear()
  }, [conversationId])

  useEffect(() => {
    const el = streamRef.current
    if (!el) return
    const safeList = Array.isArray(messages) ? messages : []
    const lastMsg = safeList.length > 0 ? safeList[safeList.length - 1] : null
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    const isOwnLatest = lastMsg?.sender_id === currentUserId

    if (isInitialScrollRef.current || isNearBottom || isOwnLatest) {
      el.scrollTop = el.scrollHeight
      isInitialScrollRef.current = false
    }
  }, [messages, currentUserId])

  // Hỗ trợ iOS Safari visualViewport khi bàn phím ảo bật/tắt
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const handleResize = () => {
      const el = streamRef.current
      const wasNearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 160 : true
      setViewportHeight(Math.round(vv.height))
      if (el && wasNearBottom) {
        requestAnimationFrame(() => {
          if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight
          }
        })
      }
    }
    vv.addEventListener('resize', handleResize)
    return () => {
      vv.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [])

  // Đánh dấu đã đọc tất cả cuộc trò chuyện gộp của đối phương khi mở
  useEffect(() => {
    for (const cid of mergedConvIds) {
      try {
        Promise.resolve(
          (supabase.rpc as any)('mark_conversation_read', { conv_id: cid })
        ).catch(() => {})
      } catch {}
    }
  }, [mergedConvIds, supabase])

  // Lấy danh sách cảm xúc hiện có cho các tin nhắn mới chưa được tải
  useEffect(() => {
    const unfetchedIds = (Array.isArray(messages) ? messages : [])
      .map((m) => m?.id)
      .filter(
        (id): id is string =>
          typeof id === 'string' &&
          id.length > 0 &&
          !optimisticMsgIdsRef.current.has(id) &&
          !fetchedReactionMsgIdsRef.current.has(id)
      )
    if (unfetchedIds.length === 0) return

    for (const id of unfetchedIds) {
      fetchedReactionMsgIdsRef.current.add(id)
    }

    try {
      Promise.resolve(
        (supabase.from('message_reactions') as any)
          .select('message_id, user_id, reaction')
          .in('message_id', unfetchedIds)
      )
        .then(({ data, error }: any) => {
          if (error) {
            for (const id of unfetchedIds) {
              fetchedReactionMsgIdsRef.current.delete(id)
            }
            return
          }
          if (!Array.isArray(data)) return
          setReactionsMap((prev) => {
            const next = { ...prev }
            for (const row of data) {
              if (!row?.message_id || !row?.reaction || !row?.user_id) continue
              if (!next[row.message_id]) {
                next[row.message_id] = { heart: [], laugh: [], like: [] }
              }
              const rType = row.reaction as 'heart' | 'laugh' | 'like'
              if (
                next[row.message_id][rType] &&
                !next[row.message_id][rType].includes(row.user_id)
              ) {
                next[row.message_id][rType] = [...next[row.message_id][rType], row.user_id]
              }
            }
            return next
          })
        })
        .catch(() => {
          for (const id of unfetchedIds) {
            fetchedReactionMsgIdsRef.current.delete(id)
          }
        })
    } catch {}
  }, [messages, supabase])

  // Đồng bộ tin nhắn mới nhất từ server (xóa bỏ độ trễ và tránh sót tin nhắn trên mobile)
  const syncLatestMessages = useCallback(async () => {
    if (!conversationId) return
    try {
      const fetchConvs = mergedConvIds.length > 0 ? mergedConvIds : [conversationId]
      const results = await Promise.all(
        fetchConvs.map((cid) =>
          fetch(`/api/messages?conversation_id=${encodeURIComponent(cid)}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      )

      const allIncoming: any[] = []
      for (const res of results) {
        if (Array.isArray(res?.messages)) {
          allIncoming.push(...res.messages)
        }
      }

      if (allIncoming.length === 0) return

      setMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : []
        const existingIds = new Set(safePrev.map((m) => m.id))
        const newOnes = allIncoming
          .map((m) => normalizeMessage(m, conversationId))
          .filter((m) => !existingIds.has(m.id))

        if (newOnes.length === 0) return safePrev
        return [...safePrev, ...newOnes].sort((a, b) =>
          (a.created_at || '').localeCompare(b.created_at || '')
        )
      })
    } catch {}
  }, [conversationId, mergedConvIds])

  // Đồng bộ tin nhắn ngay khi mount, khi tab hiển thị lại và định kỳ an toàn
  useEffect(() => {
    void syncLatestMessages()

    const handleVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void syncLatestMessages()
        }
      } catch {}
    }

    const interval = setInterval(() => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void syncLatestMessages()
        }
      } catch {}
    }, 15000)

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('focus', handleVisibility)
    }

    return () => {
      clearInterval(interval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleVisibility)
      }
    }
  }, [syncLatestMessages])

  // Realtime subscription cho messages và message_reactions
  useEffect(() => {
    if (!conversationId || typeof conversationId !== 'string') return
    let channel: any = null

    try {
      const convFilter =
        mergedConvIds.length === 1
          ? `conversation_id=eq.${conversationId}`
          : mergedConvIds.length > 1
            ? `conversation_id=in.(${mergedConvIds.join(',')})`
            : undefined

      channel = supabase
        .channel(`chat_${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            ...(convFilter ? { filter: convFilter } : {}),
          },
          (payload) => {
            try {
              const rawNew = payload?.new as any
              if (!rawNew || !rawNew.id) return
              if (!mergedConvIds.includes(rawNew.conversation_id)) return
              const newMsg = normalizeMessage(rawNew, conversationId)
              setMessages((prev) => {
                const safePrev = Array.isArray(prev) ? prev : []
                if (safePrev.some((m) => m?.id === newMsg.id)) return safePrev
                return [...safePrev, newMsg]
              })
              Promise.resolve(
                (supabase.rpc as any)('mark_conversation_read', {
                  conv_id: newMsg.conversation_id || conversationId,
                })
              ).catch(() => {})
            } catch {}
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload) => {
            try {
              if (payload.eventType === 'INSERT') {
                const row = payload.new as {
                  message_id: string
                  user_id: string
                  reaction: 'heart' | 'laugh' | 'like'
                }
                if (!row?.message_id || !row?.reaction) return
                setReactionsMap((prev) => {
                  const msgReacts = prev[row.message_id] || { heart: [], laugh: [], like: [] }
                  const list = msgReacts[row.reaction] || []
                  if (list.includes(row.user_id)) return prev
                  return {
                    ...prev,
                    [row.message_id]: {
                      ...msgReacts,
                      [row.reaction]: [...list, row.user_id],
                    },
                  }
                })
              } else if (payload.eventType === 'DELETE') {
                const oldRow = payload.old as {
                  message_id?: string
                  user_id?: string
                  reaction?: 'heart' | 'laugh' | 'like'
                }
                if (oldRow?.message_id && oldRow?.reaction && oldRow?.user_id) {
                  setReactionsMap((prev) => {
                    const msgReacts = prev[oldRow.message_id!] || {
                      heart: [],
                      laugh: [],
                      like: [],
                    }
                    const list = msgReacts[oldRow.reaction!] || []
                    return {
                      ...prev,
                      [oldRow.message_id!]: {
                        ...msgReacts,
                        [oldRow.reaction!]: list.filter((u) => u !== oldRow.user_id),
                      },
                    }
                  })
                }
              }
            } catch {}
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void syncLatestMessages()
          }
        })
    } catch (err) {
      console.warn('Realtime channel error:', err)
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {}
      }
    }
  }, [conversationId, mergedConvIds, supabase, syncLatestMessages])

  const handleSendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim()
    if (!text || sending) return

    // 1. Phản hồi tức thì 0ms (Optimistic UI Update): hiển thị tin nhắn ngay trên màn hình
    const tempId = safeUUID()
    optimisticMsgIdsRef.current.add(tempId)
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      profiles: null,
    }

    setMessages((prev) => [...(Array.isArray(prev) ? prev : []), optimisticMsg])
    if (!textOverride) setInputText('')
    setShowStickers(false)
    setSending(true)
    setSendError(null)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: text,
          idempotency_key: tempId,
        }),
      })

      if (!res.ok) {
        optimisticMsgIdsRef.current.delete(tempId)
        setSendError('Gửi tin nhắn thất bại. Thử lại.')
        // Rollback nếu thất bại
        setMessages((prev) => (Array.isArray(prev) ? prev.filter((m) => m.id !== tempId) : []))
        return
      }

      const { message } = await res.json()
      optimisticMsgIdsRef.current.delete(tempId)
      if (message) {
        const normalized = normalizeMessage(message, conversationId)
        setMessages((prev) => {
          const safePrev = Array.isArray(prev) ? prev : []
          // Thay thế tin nhắn optimistic tạm thời bằng bản ghi chính thức từ server
          const filtered = safePrev.filter((m) => m.id !== tempId && m.id !== normalized.id)
          return [...filtered, normalized]
        })
      }
    } catch {
      optimisticMsgIdsRef.current.delete(tempId)
      setSendError('Gửi tin nhắn thất bại. Thử lại.')
      setMessages((prev) => (Array.isArray(prev) ? prev.filter((m) => m.id !== tempId) : []))
    } finally {
      setSending(false)
    }
  }

  const handleSendSticker = (stickerKey: string) => {
    setShowStickers(false)
    void handleSendMessage(`[sticker:${stickerKey}]`)
  }

  const handleToggleReaction = async (msgId: string, kind: 'heart' | 'laugh' | 'like') => {
    setActiveReactionMsgId(null)
    const currentList = reactionsMap[msgId]?.[kind] || []
    const exists = currentList.includes(currentUserId)

    // Cập nhật giao diện tức thì (optimistic)
    setReactionsMap((prev) => {
      const msgReacts = prev[msgId] || { heart: [], laugh: [], like: [] }
      const list = msgReacts[kind] || []
      const nextList = exists
        ? list.filter((u) => u !== currentUserId)
        : [...list, currentUserId]
      return {
        ...prev,
        [msgId]: {
          ...msgReacts,
          [kind]: nextList,
        },
      }
    })

    // Lưu vào database
    try {
      if (exists) {
        await (supabase.from('message_reactions') as any)
          .delete()
          .match({ message_id: msgId, user_id: currentUserId, reaction: kind })
      } else {
        await (supabase.from('message_reactions') as any).insert({
          message_id: msgId,
          user_id: currentUserId,
          reaction: kind,
        })
      }
    } catch {}
  }

  const effectivePartner =
    partnerState && partnerState.name && partnerState.name !== 'Thành viên'
      ? partnerState
      : partner || partnerState
  const partnerName =
    typeof effectivePartner?.name === 'string' && effectivePartner.name.trim().length > 0
      ? effectivePartner.name.trim()
      : 'Cuộc trò chuyện'
  const partnerPhoto =
    typeof effectivePartner?.avatarUrl === 'string' ? effectivePartner.avatarUrl : null

  // Group messages by day safely
  const dayGroups: Array<{ day: string; items: ChatMessage[] }> = []
  const safeMsgs = Array.isArray(messages) ? messages : []
  for (const m of safeMsgs) {
    if (!m || !m.id) continue
    const day = formatDayLabel(m.created_at) || 'Tin nhắn'
    const last = dayGroups[dayGroups.length - 1]
    if (last && last.day === day) {
      last.items.push(m)
    } else {
      dayGroups.push({ day, items: [m] })
    }
  }

  return (
    <div
      style={viewportHeight ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` } : undefined}
      className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#050505] overscroll-none text-cream"
    >
      {/* Khối 1 — Header cuộc trò chuyện (Cố định ở trên cùng) */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#050505]/95 backdrop-blur-md border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back()
            } else {
              router.push('/tin-nhan')
            }
          }}
          aria-label="Quay lại danh sách tin nhắn"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cream transition duration-75 active:scale-95 active:bg-white/10"
        >
          <BackArrowIcon />
        </button>

        <button
          type="button"
          onClick={() => effectivePartner?.id && setShowPartnerProfile(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-85 transition duration-75 active:scale-[0.99] cursor-pointer"
        >
          <MemberAvatar name={partnerName} photo={partnerPhoto} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-cream">{safeText(partnerName)}</span>
            <span className="block text-[11px] text-muted">Xem hồ sơ</span>
          </span>
        </button>
      </header>

      {/* Khối 2 — Danh sách tin nhắn (Vùng duy nhất được cuộn) */}
      <div
        ref={streamRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 overscroll-y-contain nice-scroll"
      >
        {dayGroups.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            Chưa có tin nhắn. Gửi lời chào đầu tiên nhé.
          </p>
        ) : (
          dayGroups.map((group) => (
            <div key={group.day + (group.items[0]?.id || '')}>
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-surface2 px-3 py-1 text-xs text-muted">
                  {safeText(group.day)}
                </span>
              </div>

              {group.items.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                const rawContent = safeText(msg?.content)
                const replyData = rawContent ? parseMomentReply(rawContent) : null
                const safeReplyThumbUrl = replyData
                  ? resolveSafeMediaUrl(replyData.thumbUrl, supabase)
                  : null
                const effectiveContent = safeText(replyData ? replyData.bodyText : rawContent)
                const isSticker =
                  typeof effectiveContent === 'string' &&
                  effectiveContent.startsWith('[sticker:') &&
                  effectiveContent.endsWith(']')
                const stickerKey = isSticker ? effectiveContent.slice(9, -1) : null
                const stickerObj = stickerKey
                  ? STICKERS.find((s) => s.key === stickerKey)
                  : null
                const msgReactions = reactionsMap[msg.id] || {}

                return (
                  <div
                    key={msg.id}
                    className={`group mb-2 flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="relative max-w-[78%]"
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setActiveReactionMsgId(msg.id)
                      }}
                      onTouchStart={() => {
                        if (longPressTimerRef.current)
                          window.clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = window.setTimeout(
                          () => setActiveReactionMsgId(msg.id),
                          500
                        )
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                      onTouchMove={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                    >
                      {activeReactionMsgId === msg.id && (
                        <>
                          <button
                            type="button"
                            aria-label="Đóng"
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => setActiveReactionMsgId(null)}
                          />
                          <div
                            className={`absolute -top-12 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-surface px-2 py-1.5 shadow-xl ${
                              isMe ? 'right-0' : 'left-0'
                            }`}
                            role="dialog"
                            aria-label="Chọn cảm xúc"
                          >
                            {REACTION_TYPES.map((rt) => (
                              <button
                                key={rt}
                                type="button"
                                aria-label={rt}
                                onClick={() => handleToggleReaction(msg.id, rt)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-gold transition active:scale-90 active:bg-goldsoft"
                              >
                                <ReactionSvg kind={rt} filled={rt === 'heart'} size={22} />
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <div
                        className={`flex items-center gap-1 ${
                          isMe ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {replyData ? (
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full`}>
                            {/* Khung ảnh khoảnh khắc HIỂN THỊ LỚN */}
                            <div className="relative mb-2 w-[270px] sm:w-[310px] max-w-full aspect-square overflow-hidden rounded-2xl border border-[rgba(232,208,141,0.35)] bg-[#121214] shadow-xl">
                              {safeReplyThumbUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={safeReplyThumbUrl}
                                  alt="Khoảnh khắc"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                                  Khoảnh khắc
                                </div>
                              )}

                              {/* Tag Khoảnh khắc ở góc trên */}
                              <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-[rgba(232,208,141,0.4)] bg-black/65 px-2.5 py-1 backdrop-blur-md shadow-md">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#E8D08D] shadow-[0_0_6px_#E8D08D]" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8D08D]">
                                  Khoảnh khắc
                                </span>
                              </div>

                              {/* Caption nếu có ở đáy ảnh */}
                              {replyData.caption && (
                                <div className="absolute inset-x-0 bottom-2.5 flex justify-center px-3 z-10">
                                  <p className="max-w-[95%] truncate rounded-full border border-white/10 bg-black/70 px-3.5 py-1 text-center text-xs text-white backdrop-blur-md shadow-lg">
                                    {safeText(replyData.caption)}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Nội dung tin nhắn trả lời trong bong bóng chat theo style VOW */}
                            {(effectiveContent || stickerObj) && (
                              <div
                                className={`rounded-2xl px-3.5 pb-1.5 pt-2.5 font-chat text-[15px] font-medium leading-relaxed max-w-[270px] sm:max-w-[310px] shadow-md ${
                                  isMe
                                    ? 'rounded-br-sm bg-gradient-to-br from-[#FFF5D6] via-[#E8D08D] to-[#D4AF37] text-black border border-[#E8D08D]/60'
                                    : 'rounded-bl-sm bg-[#1c1c1e] text-white border border-white/10'
                                }`}
                              >
                                {stickerObj ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={stickerObj.src}
                                    alt={safeText(stickerObj.label || 'Sticker')}
                                    className="h-24 w-24 object-contain"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                ) : (
                                  <div>{safeText(effectiveContent)}</div>
                                )}

                                <div
                                  className={`mt-1 text-[11px] font-normal leading-none ${
                                    isMe ? 'text-black/65 text-right' : 'text-white/45 text-left'
                                  }`}
                                >
                                  {formatTimeHHMM(msg.created_at)}
                                </div>
                              </div>
                            )}

                            {!effectiveContent && !stickerObj && (
                              <div
                                className={`mt-0.5 text-[11px] ${
                                  isMe ? 'text-white/50 text-right' : 'text-white/50 text-left'
                                }`}
                              >
                                {formatTimeHHMM(msg.created_at)}
                              </div>
                            )}
                          </div>
                        ) : stickerObj ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={stickerObj.src}
                            alt={safeText(stickerObj.label || 'Sticker')}
                            className="h-28 w-28 object-contain"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            className={`rounded-2xl px-3.5 pb-1.5 pt-2.5 font-chat text-[15px] font-medium leading-relaxed shadow-md ${
                              isMe
                                ? 'rounded-br-sm bg-gradient-to-br from-[#FFF5D6] via-[#E8D08D] to-[#D4AF37] text-black border border-[#E8D08D]/50'
                                : 'rounded-bl-sm bg-[#1c1c1e] text-white border border-white/10'
                            }`}
                          >
                            {effectiveContent && <div>{safeText(effectiveContent)}</div>}

                            <div
                              className={`mt-1 text-[11px] font-normal leading-none ${
                                isMe ? 'text-black/65 text-right' : 'text-white/45 text-left'
                              }`}
                            >
                              {formatTimeHHMM(msg.created_at)}
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          aria-label="Thả cảm xúc"
                          onClick={() =>
                            setActiveReactionMsgId(
                              activeReactionMsgId === msg.id ? null : msg.id
                            )
                          }
                          className="shrink-0 rounded-full p-1 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                        >
                          <MoreDotsIcon />
                        </button>
                      </div>

                      {Object.keys(msgReactions).length > 0 && (
                        <div
                          className={`mt-1 flex flex-wrap gap-1 ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {REACTION_TYPES.map((rt) => {
                            const users = msgReactions[rt] || []
                            if (users.length === 0) return null
                            const mine = users.includes(currentUserId)
                            return (
                              <button
                                key={rt}
                                type="button"
                                onClick={() => handleToggleReaction(msg.id, rt)}
                                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition active:scale-95 ${
                                  mine
                                    ? 'border-gold/60 bg-goldsoft text-gold'
                                    : 'border-white/10 bg-surface2 text-cream'
                                }`}
                              >
                                <ReactionSvg kind={rt} filled size={13} />
                                <span>{users.length}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-2 shrink-0" />
      </div>

      {/* Khối 3 — Thanh nhập tin nhắn & Sticker tray (Cố định sát đáy màn hình) */}
      <footer className="shrink-0 w-full bg-[#050505] border-t border-white/10">
        {showStickers && (
          <div className="border-b border-white/10 bg-surface px-4 py-3 max-h-48 overflow-y-auto nice-scroll">
            <div className="grid grid-cols-4 gap-2">
              {STICKERS.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleSendSticker(st.key)}
                  aria-label={st.label}
                  title={st.label}
                  className="flex items-center justify-center rounded-xl bg-surface2 p-2 transition duration-75 active:scale-95 hover:bg-white/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={st.src}
                    alt={st.label}
                    className="h-16 w-16 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {sendError && (
          <p className="px-4 pt-2 text-xs text-red-400">{sendError}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSendMessage()
          }}
          className="flex items-center gap-2 px-3 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={() => setShowStickers((v) => !v)}
            aria-label="Chọn sticker"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-cream transition duration-75 active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="9" />
              <path
                strokeLinecap="round"
                d="M8.5 14.5c.8 1 2 1.5 3.5 1.5s2.7-.5 3.5-1.5M9 9.5h.01M15 9.5h.01"
              />
            </svg>
          </button>

          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhắn tin…"
            maxLength={1000}
            aria-label="Nhắn tin"
            className="flex-1 rounded-full bg-surface2 px-4 py-2.5 text-[15px] text-cream outline-none placeholder:text-muted focus:ring-1 focus:ring-gold/60"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            aria-label="Gửi tin nhắn"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink transition duration-75 active:scale-95 disabled:opacity-40"
          >
            <SendPaperPlaneIcon />
          </button>
        </form>
      </footer>

      {/* Profile Modal */}
      <UserProfileModal
        userId={effectivePartner?.id ?? partner?.id ?? null}
        open={showPartnerProfile}
        onClose={() => setShowPartnerProfile(false)}
      />
    </div>
  )
}
