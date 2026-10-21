'use client'

import { useState, useEffect, useRef } from 'react'
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
  return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12)
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
  const safeName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'U'
  if (photo && typeof photo === 'string') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={safeName}
        width={size}
        height={size}
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
  currentUserId,
  initialMessages,
  partner,
}: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null)
  const [reactionsMap, setReactionsMap] = useState<
    Record<string, Record<'heart' | 'laugh' | 'like', string[]>>
  >({})
  const [sendError, setSendError] = useState<string | null>(null)
  const [showPartnerProfile, setShowPartnerProfile] = useState(false)

  const streamRef = useRef<HTMLDivElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const el = streamRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // Đánh dấu đã đọc cuộc trò chuyện khi mở
  useEffect(() => {
    ;(supabase.rpc as any)('mark_conversation_read', { conv_id: conversationId }).catch(() => {})
  }, [conversationId, supabase])

  // Lấy danh sách cảm xúc hiện có cho các tin nhắn
  useEffect(() => {
    const msgIds = messages.map((m) => m.id)
    if (msgIds.length === 0) return

    ;(supabase.from('message_reactions') as any)
      .select('message_id, user_id, reaction')
      .in('message_id', msgIds)
      .then(({ data, error }: any) => {
        if (error || !data) return
        setReactionsMap((prev) => {
          const next = { ...prev }
          for (const row of data) {
            if (!next[row.message_id]) {
              next[row.message_id] = { heart: [], laugh: [], like: [] }
            }
            const rType = row.reaction as 'heart' | 'laugh' | 'like'
            if (next[row.message_id][rType] && !next[row.message_id][rType].includes(row.user_id)) {
              next[row.message_id][rType] = [...next[row.message_id][rType], row.user_id]
            }
          }
          return next
        })
      })
      .catch(() => {})
  }, [messages, supabase])

  // Realtime subscription cho messages và message_reactions
  useEffect(() => {
    if (!conversationId || typeof conversationId !== 'string') return
    let channel: any = null
    try {
      channel = supabase
        .channel(`chat_${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage
            if (!newMsg || !newMsg.id) return
            setMessages((prev) => {
              const safePrev = Array.isArray(prev) ? prev : []
              if (safePrev.some((m) => m?.id === newMsg.id)) return safePrev
              return [...safePrev, newMsg]
            })
            ;(supabase.rpc as any)('mark_conversation_read', { conv_id: conversationId }).catch(() => {})
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
                const row = payload.new as { message_id: string; user_id: string; reaction: 'heart' | 'laugh' | 'like' }
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
                const oldRow = payload.old as { message_id?: string; user_id?: string; reaction?: 'heart' | 'laugh' | 'like' }
                if (oldRow?.message_id && oldRow?.reaction && oldRow?.user_id) {
                  setReactionsMap((prev) => {
                    const msgReacts = prev[oldRow.message_id!] || { heart: [], laugh: [], like: [] }
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
        .subscribe()
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
  }, [conversationId, supabase])

  const handleSendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: text,
          idempotency_key: safeUUID(),
        }),
      })

      if (!res.ok) {
        setSendError('Gửi tin nhắn thất bại. Thử lại.')
        return
      }

      const { message } = await res.json()
      if (message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
      }
      if (!textOverride) setInputText('')
      setShowStickers(false)
    } catch {
      setSendError('Gửi tin nhắn thất bại. Thử lại.')
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

  const partnerName =
    typeof partner?.name === 'string' && partner.name.trim().length > 0
      ? partner.name.trim()
      : 'Cuộc trò chuyện'
  const partnerPhoto = typeof partner?.avatarUrl === 'string' ? partner.avatarUrl : null

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
    <div className="flex h-dvh flex-col bg-ink">
      <header className="flex items-center gap-2 border-b border-white/5 px-2 py-2.5">
        <button
          type="button"
          onClick={() => router.push('/tin-nhan')}
          aria-label="Quay lại danh sách tin nhắn"
          className="flex h-10 w-10 items-center justify-center rounded-full text-cream transition active:bg-surface2"
        >
          <BackArrowIcon />
        </button>

        <button
          type="button"
          onClick={() => partner?.id && setShowPartnerProfile(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-85 transition active:scale-[0.99] cursor-pointer"
        >
          <MemberAvatar name={partnerName} photo={partnerPhoto} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-cream">{partnerName}</span>
            <span className="block text-[11px] text-muted">Xem hồ sơ</span>
          </span>
        </button>
      </header>

      <div ref={streamRef} className="nice-scroll flex-1 overflow-y-auto px-3 py-4">
        {dayGroups.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            Chưa có tin nhắn. Gửi lời chào đầu tiên nhé.
          </p>
        ) : (
          dayGroups.map((group) => (
            <div key={group.day + (group.items[0]?.id || '')}>
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-surface2 px-3 py-1 text-xs text-muted">
                  {group.day}
                </span>
              </div>

              {group.items.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                const rawContent = typeof msg?.content === 'string' ? msg.content : ''
                const replyData = rawContent ? parseMomentReply(rawContent) : null
                const effectiveContent = replyData ? replyData.bodyText : rawContent
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
                        {!replyData && stickerObj ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={stickerObj.src}
                            alt="Sticker"
                            className="h-28 w-28 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className={`rounded-2xl bg-chatbubble px-3.5 pb-1.5 pt-2.5 font-chat text-[15px] font-medium leading-relaxed text-white ${
                              isMe ? 'rounded-br-md' : 'rounded-bl-md'
                            }`}
                          >
                            {replyData && (
                              <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-[rgba(232,208,141,0.25)] bg-black/50 p-2 backdrop-blur-sm">
                                {replyData.thumbUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={replyData.thumbUrl}
                                    alt="Khoảnh khắc"
                                    className="h-12 w-12 shrink-0 rounded-lg border border-[rgba(232,208,141,0.4)] object-cover shadow"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#E8D08D]">
                                    Khoảnh khắc
                                  </p>
                                  {replyData.caption ? (
                                    <p className="truncate text-xs italic text-white/80">
                                      &ldquo;{replyData.caption}&rdquo;
                                    </p>
                                  ) : (
                                    <p className="text-xs text-white/50">Phản hồi khoảnh khắc</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {stickerObj ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={stickerObj.src}
                                alt="Sticker"
                                className="h-24 w-24 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              effectiveContent && <div>{effectiveContent}</div>
                            )}

                            <div
                              className={`mt-1 text-[11px] leading-none text-chattime ${
                                isMe ? 'text-right' : 'text-left'
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
      </div>

      {sendError && (
        <p className="border-t border-white/5 px-4 pt-2 text-xs text-red-400">{sendError}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSendMessage()
        }}
        className={`flex items-center gap-2 px-3 py-3 ${
          sendError ? '' : 'border-t border-white/5'
        }`}
      >
        <button
          type="button"
          onClick={() => setShowStickers((v) => !v)}
          aria-label="Chọn sticker"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-cream transition active:scale-95"
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink transition active:scale-95 disabled:opacity-40"
        >
          <SendPaperPlaneIcon />
        </button>
      </form>

      {showStickers && (
        <div className="border-t border-white/5 bg-surface px-4 py-3">
          <div className="grid grid-cols-4 gap-2">
            {STICKERS.map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => handleSendSticker(st.key)}
                aria-label={st.label}
                title={st.label}
                className="flex items-center justify-center rounded-xl bg-surface2 p-2 transition active:scale-95 hover:bg-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={st.src}
                  alt={st.label}
                  className="h-16 w-16 object-contain"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <UserProfileModal
        userId={partner?.id ?? null}
        open={showPartnerProfile}
        onClose={() => setShowPartnerProfile(false)}
      />
    </div>
  )
}
