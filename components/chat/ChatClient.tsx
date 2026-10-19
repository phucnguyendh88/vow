'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Smile, User } from 'lucide-react'
import { STICKERS } from '@/lib/stickers'
import toast from 'react-hot-toast'

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim()
    if (!text || sending) return
    setSending(true)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: text,
          idempotency_key: crypto.randomUUID(),
        }),
      })

      if (!res.ok) {
        toast.error('Gửi tin nhắn thất bại')
        return
      }

      const { message } = await res.json()
      if (message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
      }
      if (!textToSend) setInputText('')
      setShowStickers(false)
    } catch {
      toast.error('Lỗi mạng. Vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  const handleSendSticker = (stickerKey: string) => {
    handleSendMessage(`[sticker:${stickerKey}]`)
  }

  const renderMessageContent = (content: string) => {
    if (content.startsWith('[sticker:') && content.endsWith(']')) {
      const key = content.slice(9, -1)
      const sticker = STICKERS.find((s) => s.key === key)
      if (sticker) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sticker.src}
            alt={sticker.label}
            className="h-28 w-28 object-contain"
            loading="lazy"
          />
        )
      }
    }
    return <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>
  }

  return (
    <div className="flex flex-col h-dvh bg-ink text-cream max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface/80 backdrop-blur-md">
        <button
          type="button"
          onClick={() => router.push('/tin-nhan')}
          aria-label="Quay lại"
          className="flex h-10 w-10 items-center justify-center rounded-full text-cream hover:bg-surface2 transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-surface2 flex items-center justify-center shrink-0">
            {partner?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={20} className="text-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-cream truncate">
              {partner?.name ?? 'Cuộc trò chuyện'}
            </p>
            <p className="text-[11px] text-emerald-400">Đang hoạt động</p>
          </div>
        </div>
      </header>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 nice-scroll flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted">
            <p className="text-sm">Chưa có tin nhắn nào.</p>
            <p className="text-xs mt-1">Hãy gửi lời chào đầu tiên bằng tình yêu thương nhé!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            const isSticker = msg.content.startsWith('[sticker:')

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] ${
                    isSticker
                      ? 'p-0 bg-transparent'
                      : `rounded-2xl px-4 py-2.5 ${
                          isMe
                            ? 'bg-gold text-ink rounded-br-sm shadow-md'
                            : 'bg-surface2 text-cream rounded-bl-sm border border-white/5'
                        }`
                  }`}
                >
                  {renderMessageContent(msg.content)}
                  <span
                    className={`block text-[10px] mt-1 ${
                      isSticker
                        ? 'text-muted'
                        : isMe
                        ? 'text-ink/60 text-right'
                        : 'text-muted/70'
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Stickers Drawer */}
      {showStickers && (
        <div className="border-t border-white/5 bg-surface p-3 grid grid-cols-4 gap-2">
          {STICKERS.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => handleSendSticker(st.key)}
              className="flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-surface2 transition active:scale-95 cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={st.src} alt={st.label} className="h-14 w-14 object-contain" />
              <span className="text-[10px] text-muted truncate w-full text-center">
                {st.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSendMessage()
        }}
        className="flex items-center gap-2 p-3 bg-surface/90 border-t border-white/5"
      >
        <button
          type="button"
          onClick={() => setShowStickers(!showStickers)}
          aria-label="Chọn sticker"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-muted hover:text-cream transition active:scale-95 cursor-pointer"
        >
          <Smile size={20} />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhắn tin…"
          maxLength={1000}
          className="flex-1 rounded-full bg-surface2 px-4 py-2.5 text-sm text-cream placeholder:text-muted/60 outline-none focus:ring-1 focus:ring-gold/60"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          aria-label="Gửi"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink shadow-md shadow-gold/20 transition active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
