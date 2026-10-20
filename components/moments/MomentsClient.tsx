'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import imageCompression from 'browser-image-compression'
import type { Moment } from '@/types/database'
import { STICKERS } from '@/lib/stickers'

interface MomentWithProfile extends Moment {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    church_name?: string | null
  } | null
}

interface FriendItem {
  id: string
  profile: {
    id: string
    name: string
    photos: string[]
    church: string
  }
}

interface CurrentUserProfile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

interface Props {
  initialMoments: MomentWithProfile[]
  myMoments?: any[]
  userId: string
  fetchError: string | null
  myInviteCode?: string
  currentUser?: CurrentUserProfile | null
  initialFriends?: FriendItem[]
  initialIncoming?: FriendItem[]
  initialOutgoing?: FriendItem[]
}

function timeAgoVi(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days} ngày trước` : new Date(dateStr).toLocaleDateString('vi-VN')
}

function isGoldTrialActive(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('fc_gold_trial')
    return raw ? JSON.parse(raw).active === true : false
  } catch {
    return false
  }
}

/* --- Original VOW Icons --- */
function CloseSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function ChevronDownSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  )
}

function TrashSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

function SendPlaneSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M3.4 20.4l17.5-8.4L3.4 3.6l-.01 6.53L14 12 3.39 13.87l.01 6.53z" />
    </svg>
  )
}

function UsersSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path strokeLinecap="round" d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path strokeLinecap="round" d="M15.5 5.2a3.5 3.5 0 0 1 0 5.7M17.8 15.3c1.7.7 2.8 2.2 3.1 4.2" />
    </svg>
  )
}

function CameraOutlineSvg({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path
        strokeLinejoin="round"
        d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
      />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  )
}

function GalleryAddSvg({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 17.5l4.5-4.5 3 3 3.5-3.5 4 4" />
      <path strokeLinecap="round" d="M18 3.5v3M16.5 5h3" />
    </svg>
  )
}

function FlipCameraSvg({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9a8 8 0 0 1 14.9-3M20 15a8 8 0 0 1-14.9 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 3v4h-4M5 21v-4h4" />
    </svg>
  )
}

function FlashBoltSvg({ className = 'h-5 w-5', off = false }: { className?: string; off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {off ? (
        <path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" opacity="0.35" />
      ) : (
        <path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" />
      )}
    </svg>
  )
}

function CopySvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path strokeLinecap="round" d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  )
}

function ChatBubbleSvg({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
    </svg>
  )
}

function GridFourSvg({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

/* --- Reply Box inside History Viewer (Vp) --- */
function MomentReplyBox({
  onReply,
}: {
  onReply: (text: string, stickerKey?: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [openStickers, setOpenStickers] = useState(false)

  const handleSend = useCallback(
    async (msg: string, sticker?: string) => {
      const trimmed = msg.trim()
      if ((!trimmed && !sticker) || sending) return
      setSending(true)
      try {
        await onReply(trimmed, sticker)
        setText('')
        setOpenStickers(false)
      } finally {
        setSending(false)
      }
    },
    [onReply, sending]
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 rounded-full bg-[#1c1c1e] py-2 pl-5 pr-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSend(text)
          }}
          placeholder="Send message..."
          maxLength={200}
          aria-label="Nhắn tin về khoảnh khắc này"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOpenStickers((v) => !v)}
          aria-label="Chọn sticker"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[22px] transition active:scale-90"
        >
          😊
        </button>
        <button
          type="button"
          onClick={() => void handleSend(text)}
          disabled={!text.trim() || sending}
          aria-label="Gửi tin nhắn"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-90 disabled:opacity-30"
        >
          <SendPlaneSvg />
        </button>
      </div>

      {openStickers && (
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#1c1c1e] p-3">
          {STICKERS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => void handleSend('', s.key)}
              disabled={sending}
              aria-label={s.label}
              title={s.label}
              className="flex items-center justify-center rounded-xl bg-white/5 p-2 transition active:scale-95 hover:bg-white/10 disabled:opacity-40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.label} className="h-14 w-14 object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* --- Floating Locket Bar inside Full-Screen History Viewer (Ip) --- */
function LocketFloatingNav({ onTabClick }: { onTabClick: () => void }) {
  return (
    <div className="pointer-events-none flex items-end justify-center gap-3 px-6">
      <nav
        aria-label="Điều hướng chính"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#1c1c1e]/95 px-2 py-2 shadow-2xl shadow-black/60 backdrop-blur"
      >
        <Link
          href="/tim-chua-truoc"
          aria-label="Tìm Chúa trước"
          title="Tìm Chúa trước"
          onClick={onTabClick}
          className="flex h-12 w-14 items-center justify-center rounded-full text-white/55 hover:text-white transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </Link>
        <button
          type="button"
          aria-label="Khoảnh khắc"
          title="Khoảnh khắc"
          onClick={onTabClick}
          className="flex h-12 w-14 items-center justify-center rounded-full bg-white/15 text-gold transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path
              strokeLinejoin="round"
              d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
            />
            <circle cx="12" cy="13.5" r="3.5" />
          </svg>
        </button>
        <Link
          href="/ket-noi-sau"
          aria-label="Kết nối sau"
          title="Kết nối sau"
          onClick={onTabClick}
          className="flex h-12 w-14 items-center justify-center rounded-full text-white/55 hover:text-white transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </Link>
      </nav>
      <Link
        href="/tin-nhan"
        aria-label="Tin nhắn"
        title="Tin nhắn"
        onClick={onTabClick}
        className="pointer-events-auto relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1c1c1e]/95 text-white/80 shadow-2xl shadow-black/60 backdrop-blur transition active:scale-95"
      >
        <ChatBubbleSvg className="h-6 w-6" />
      </Link>
    </div>
  )
}

/* --- Full-Screen History Viewer (Hp) --- */
function HistoryViewer({
  moments,
  initialId,
  filterName,
  onClearFilter,
  onOpenFriends,
  onClose,
  uid,
  peerOf,
  onDelete,
  onReplyMoment,
  ownAvatar,
  onOpenProfile,
}: {
  moments: MomentWithProfile[]
  initialId: string | null
  filterName: string | null
  onClearFilter: () => void
  onOpenFriends: () => void
  onClose: () => void
  uid: string
  peerOf: (userId: string, m?: MomentWithProfile) => { name: string; avatar: string | null }
  onDelete: (id: string) => void
  onReplyMoment: (m: MomentWithProfile, text: string, stickerKey?: string) => Promise<void>
  ownAvatar: string | null
  onOpenProfile: () => void
}) {
  const total = moments.length
  const containerRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [viewportH, setViewportH] = useState(0)
  const [index, setIndex] = useState(() => {
    if (!initialId) return 0
    const found = moments.findIndex((m) => m.id === initialId)
    return found >= 0 ? found : 0
  })
  const [translateY, setTranslateY] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [edgeNotice, setEdgeNotice] = useState<'start' | 'end' | null>(null)

  const indexRef = useRef(index)
  const animatingRef = useRef(false)
  const dragRef = useRef<{ startY: number; baseOffset: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateH = () => {
      const h = el.clientHeight
      setViewportH((prev) => {
        if (prev !== h && h > 0) {
          setTranslateY(-indexRef.current * h)
        }
        return h
      })
    }
    updateH()
    const ro = new ResizeObserver(updateH)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const snapTo = useCallback(
    (targetIdx: number, animate: boolean) => {
      if (total === 0 || viewportH === 0) return
      const clamped = Math.max(0, Math.min(total - 1, targetIdx))
      indexRef.current = clamped
      setIndex(clamped)
      if (animate) {
        animatingRef.current = true
        setAnimating(true)
        setTranslateY(-clamped * viewportH)
        window.setTimeout(() => {
          animatingRef.current = false
          setAnimating(false)
        }, 300)
      } else {
        setTranslateY(-clamped * viewportH)
      }
    },
    [total, viewportH]
  )

  const showEdge = (kind: 'start' | 'end') => {
    setEdgeNotice(kind)
    window.setTimeout(() => {
      setEdgeNotice((cur) => (cur === kind ? null : cur))
    }, 1400)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (animatingRef.current || total === 0 || viewportH === 0) return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'BUTTON' || (e.target as HTMLElement)?.closest('button, input')) {
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
    dragRef.current = {
      startY: e.clientY,
      baseOffset: -indexRef.current * viewportH,
      moved: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || viewportH === 0) return
    const dy = e.clientY - drag.startY
    if (Math.abs(dy) > 10) drag.moved = true
    let nextY = drag.baseOffset + dy
    const minOffset = -(total - 1) * viewportH
    if (nextY > 0) nextY = nextY * 0.35
    else if (nextY < minOffset) nextY = minOffset + (nextY - minOffset) * 0.35
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(0, ${nextY}px, 0)`
    }
  }

  const finishDrag = (clientY: number) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || viewportH === 0 || !drag.moved) return
    suppressClickRef.current = true
    const dy = clientY - drag.startY
    const threshold = Math.max(45, Math.min(100, viewportH * 0.12))
    if (indexRef.current <= 0 && dy >= 120) {
      onClose()
    } else if (dy <= -threshold && indexRef.current < total - 1) {
      snapTo(indexRef.current + 1, true)
    } else if (dy >= threshold && indexRef.current > 0) {
      snapTo(indexRef.current - 1, true)
    } else {
      if (dy <= -threshold && indexRef.current >= total - 1) showEdge('end')
      else if (dy >= threshold && indexRef.current <= 0) showEdge('start')
      snapTo(indexRef.current, true)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        snapTo(indexRef.current + 1, true)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        snapTo(indexRef.current - 1, true)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [snapTo, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Xem khoảnh khắc"
    >
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1c1c1e] text-white active:scale-95"
        >
          <CloseSvg />
        </button>

        <button
          type="button"
          onClick={filterName ? onClearFilter : onOpenFriends}
          aria-label={filterName ? `Bỏ lọc ${filterName}` : 'Lọc theo bạn bè'}
          className="flex h-12 items-center gap-2 rounded-full bg-[#1c1c1e] px-5 text-[17px] font-semibold text-white active:scale-95"
        >
          {filterName ? (
            <>
              <span className="max-w-40 truncate">{filterName}</span>
              <CloseSvg className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>All Friends</span>
              <ChevronDownSvg />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Hồ sơ của tôi"
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#1c1c1e] text-[17px] font-bold text-white/70 active:scale-95"
        >
          {ownAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ownAvatar} alt="Tôi" className="h-full w-full object-cover" />
          ) : (
            <span>PR</span>
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="font-serif text-2xl text-white">Chưa có khoảnh khắc nào</p>
            <p className="text-sm text-white/60">
              {filterName
                ? `${filterName} chưa chia sẻ khoảnh khắc nào.`
                : 'Chụp tấm đầu tiên để bắt đầu chia sẻ với bạn bè nhé!'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black active:scale-95"
            >
              {filterName ? 'Xem tất cả' : 'Chụp ảnh ngay'}
            </button>
          </div>
        ) : (
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => finishDrag(e.clientY)}
            onPointerCancel={() => {
              const drag = dragRef.current
              dragRef.current = null
              if (drag?.moved) snapTo(indexRef.current, true)
            }}
            onClickCapture={(e) => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false
                e.stopPropagation()
                e.preventDefault()
              }
            }}
            className="h-full w-full overflow-hidden"
            style={{ touchAction: 'none' }}
          >
            <div
              ref={trackRef}
              className="w-full will-change-transform"
              style={{
                transform: `translate3d(0, ${translateY}px, 0)`,
                transition: animating ? 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
              }}
            >
              {moments.map((m, i) => {
                const isMine = m.user_id === uid
                const author = peerOf(m.user_id, m)
                return (
                  <div
                    key={m.id}
                    className="flex w-full shrink-0 flex-col px-4"
                    style={{ height: viewportH > 0 ? viewportH : '100%' }}
                    aria-hidden={i !== index}
                  >
                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[2.5rem] bg-[#1c1c1e]">
                      {m.media_type === 'video' ? (
                        <video
                          src={m.media_url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.media_url}
                          alt={m.caption || `Khoảnh khắc của ${author.name}`}
                          className="h-full w-full object-cover"
                          decoding="async"
                          loading="lazy"
                          draggable={false}
                        />
                      )}
                      {m.caption && (
                        <div className="absolute inset-x-0 bottom-4 flex justify-center px-6">
                          <p className="max-w-full truncate rounded-full bg-black/45 px-4 py-2 text-center text-[15px] text-white backdrop-blur-sm">
                            {m.caption}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 px-2 py-3">
                      {author.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1c1c1e] text-sm font-bold text-white">
                          {author.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <p className="min-w-0 flex-1 truncate text-[17px] font-semibold text-white">
                        {author.name}
                        <span className="ml-2 font-normal text-white/50">
                          {timeAgoVi(m.created_at)}
                        </span>
                      </p>
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => onDelete(m.id)}
                          aria-label="Xóa khoảnh khắc"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1c1c1e] text-red-300 active:scale-95"
                        >
                          <TrashSvg />
                        </button>
                      )}
                    </div>

                    {!isMine && (
                      <div className="shrink-0 pb-1">
                        <MomentReplyBox onReply={(text, sticker) => onReplyMoment(m, text, sticker)} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="relative shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {edgeNotice && (
          <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full">
            <p className="whitespace-nowrap rounded-full bg-[#1c1c1e] px-4 py-2 text-sm font-medium text-white/80 shadow-lg">
              {edgeNotice === 'end' ? 'Đã xem hết khoảnh khắc' : 'Đây là khoảnh khắc mới nhất'}
            </p>
          </div>
        )}
        <LocketFloatingNav onTabClick={onClose} />
      </div>
    </div>
  )
}

/* --- Memories Monthly Calendar View (Matches z8356973358098.jpg) --- */
function MemoriesCalendarView({
  moments,
  onSelectMoment,
}: {
  moments: MomentWithProfile[]
  onSelectMoment: (id: string) => void
}) {
  // Group moments by YYYY-MM and day of month
  const { months, streakDays } = useMemo(() => {
    const byDate = new Map<string, MomentWithProfile>()
    const uniqueDays = new Set<string>()
    for (const m of moments) {
      const d = new Date(m.created_at)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const key = `${yyyy}-${mm}-${dd}`
      uniqueDays.add(key)
      if (!byDate.has(key)) {
        byDate.set(key, m)
      }
    }

    const now = new Date()
    const monthList: Array<{ year: number; month: number }> = []
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthList.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }

    return {
      months: monthList.map(({ year, month }) => {
        const firstDay = new Date(year, month - 1, 1)
        const daysInMonth = new Date(year, month, 0).getDate()
        // Monday-based index (0 = T2 .. 6 = CN)
        const startOffset = (firstDay.getDay() + 6) % 7
        const cells: Array<{ day: number | null; moment?: MomentWithProfile }> = []
        for (let i = 0; i < startOffset; i++) cells.push({ day: null })
        for (let day = 1; day <= daysInMonth; day++) {
          const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          cells.push({ day, moment: byDate.get(key) })
        }
        return { year, month, cells }
      }),
      streakDays: Math.max(uniqueDays.size, moments.length > 0 ? 1 : 0),
    }
  }, [moments])

  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="nice-scroll flex-1 overflow-y-auto px-4 pb-20 space-y-8">
        {months.map(({ year, month, cells }) => (
          <div key={`${year}-${month}`}>
            <h3 className="mb-3 text-lg font-bold text-white">
              Tháng {month} {year}
            </h3>
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-white/40 mb-2">
              {weekDays.map((wd) => (
                <span key={wd}>{wd}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell, idx) =>
                cell.day === null ? (
                  <div key={idx} className="aspect-[3/4]" />
                ) : cell.moment ? (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectMoment(cell.moment!.id)}
                    className="relative aspect-[3/4] overflow-hidden rounded-xl border border-gold/60 bg-[#1c1c1e] active:scale-95"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cell.moment.thumbnail_url || cell.moment.media_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-xs font-bold text-white drop-shadow">
                      {cell.day}
                    </span>
                  </button>
                ) : (
                  <div
                    key={idx}
                    className="flex aspect-[3/4] items-center justify-center rounded-xl text-sm font-medium text-white/35"
                  >
                    {cell.day}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/95 px-6 py-3.5 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>💛 {moments.length} khoảnh khắc</span>
        <span className="text-white/20">|</span>
        <span>🔥 {streakDays} ngày liên tiếp</span>
      </div>
    </div>
  )
}

export default function MomentsClient({
  initialMoments,
  userId,
  fetchError,
  myInviteCode = 'FC-VOW123',
  currentUser,
  initialFriends = [],
  initialIncoming = [],
  initialOutgoing = [],
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [moments, setMoments] = useState<MomentWithProfile[]>(initialMoments)
  const [friends, setFriends] = useState<FriendItem[]>(initialFriends)
  const [incoming, setIncoming] = useState<FriendItem[]>(initialIncoming)
  const [outgoing, setOutgoing] = useState<FriendItem[]>(initialOutgoing)

  // Modals & Overlays
  const [showFriendsDialog, setShowFriendsDialog] = useState(false)
  const [showGridModal, setShowGridModal] = useState(false)
  const [gridTab, setGridTab] = useState<'grid' | 'memories'>('grid')
  const [showHistoryViewer, setShowHistoryViewer] = useState(false)
  const [historyInitialId, setHistoryInitialId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<{ userId: string; name: string } | null>(null)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [premiumActive, setPremiumActive] = useState<boolean>(isGoldTrialActive)

  // Capture & Post state
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [capturedMediaType, setCapturedMediaType] = useState<'image' | 'video'>('image')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  const [postFailed, setPostFailed] = useState(false)
  const [processError, setProcessError] = useState('')

  // Friends invite state
  const [inviteInput, setInviteInput] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Toast notice banner (pe in original)
  const [toastBanner, setToastBanner] = useState<{
    id: number
    message: string
    kind: 'ok' | 'error'
  } | null>(null)

  const notify = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => {
    setToastBanner({ id: Date.now(), message, kind })
  }, [])

  useEffect(() => {
    if (!toastBanner) return
    const t = setTimeout(() => setToastBanner(null), 2600)
    return () => clearTimeout(t)
  }, [toastBanner])

  useEffect(() => {
    if (fetchError) notify(fetchError, 'error')
  }, [fetchError, notify])

  // Check URL params (?code=FC-XXXXXX or ?locket=USER_ID)
  useEffect(() => {
    const code = (searchParams.get('code') ?? '').trim().toUpperCase()
    if (/^FC-[A-Z0-9]{6,8}$/.test(code)) {
      setInviteInput(code)
      setShowFriendsDialog(true)
    }
    const locketUid = (searchParams.get('locket') ?? '').trim()
    if (locketUid) {
      const name = (searchParams.get('name') ?? '').trim() || 'Bạn bè'
      setHistoryInitialId(null)
      setHistoryFilter({ userId: locketUid, name })
      setShowHistoryViewer(true)
    }
  }, [searchParams])

  // Camera state
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [cameraErrorKind, setCameraErrorKind] = useState<
    'permission' | 'notfound' | 'busy' | 'unsupported' | 'unknown' | null
  >(null)
  const [torchOn, setTorchOn] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null)
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const swipeStartRef = useRef<{ y: number; scrollY: number } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const pressTimerRef = useRef<number | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const attachStream = (el: HTMLVideoElement | null, stream: MediaStream) => {
    if (!el) return
    el.srcObject = stream
    el.muted = true
    const play = () => {
      el.play().catch(() => undefined)
    }
    if (el.readyState >= 1) play()
    else el.onloadedmetadata = () => play()
  }

  const startCamera = useCallback(
    async (mode: 'user' | 'environment') => {
      stopCamera()
      setCameraErrorKind(null)
      setTorchOn(false)
      setZoomRange(null)
      setZoom(1)

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('no-camera')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        streamRef.current = stream
        attachStream(videoRef.current, stream)

        const track = stream.getVideoTracks()[0]
        try {
          const caps = (track as any)?.getCapabilities?.()
          if (caps?.zoom && caps.zoom.max > caps.zoom.min) {
            setZoomRange({
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step || 0.1,
            })
          }
          if (caps?.focusMode?.includes('continuous')) {
            await track
              .applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] })
              .catch(() => undefined)
          }
        } catch {}
      } catch (err: any) {
        if (err instanceof Error && err.message === 'no-camera') {
          setCameraErrorKind('unsupported')
        } else {
          const name = err?.name
          if (name === 'NotAllowedError' || name === 'SecurityError') setCameraErrorKind('permission')
          else if (name === 'NotFoundError' || name === 'OverconstrainedError')
            setCameraErrorKind('notfound')
          else if (name === 'NotReadableError' || name === 'AbortError') setCameraErrorKind('busy')
          else setCameraErrorKind('unknown')
        }
      }
    },
    [stopCamera]
  )

  useEffect(() => {
    startCamera(facingMode)
    return stopCamera
  }, [facingMode, startCamera, stopCamera])

  useEffect(() => {
    if (!capturedDataUrl && !cameraErrorKind && videoRef.current && streamRef.current) {
      attachStream(videoRef.current, streamRef.current)
    }
  }, [capturedDataUrl, cameraErrorKind])

  const handleToggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    const next = !torchOn
    setTorchOn(next)
    if (track) {
      try {
        await track.applyConstraints({ advanced: [{ torch: next } as any] })
      } catch {}
    }
  }, [torchOn])

  const handleSetZoom = useCallback(
    async (targetZoom: number) => {
      setZoom(targetZoom)
      const track = streamRef.current?.getVideoTracks()[0]
      if (track && zoomRange) {
        const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, targetZoom))
        try {
          await track.applyConstraints({ advanced: [{ zoom: clamped } as any] })
        } catch {}
      }
    },
    [zoomRange]
  )

  const handleCapturePhoto = useCallback(async () => {
    const video = videoRef.current
    if (!video || cameraErrorKind || !streamRef.current) return
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (facingMode === 'user') {
      ctx.translate(vw, 0)
      ctx.scale(-1, 1)
    }

    if (zoom > 1 && !zoomRange) {
      const sw = vw / zoom
      const sh = vh / zoom
      const sx = (vw - sw) / 2
      const sy = (vh - sh) / 2
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh)
    } else {
      ctx.drawImage(video, 0, 0, vw, vh)
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setCapturedMediaType('image')
        setCapturedDataUrl(canvas.toDataURL('image/jpeg', 0.85))
        setProcessError('')
        setPostFailed(false)
      },
      'image/jpeg',
      0.85
    )
  }, [cameraErrorKind, facingMode, zoom, zoomRange])

  // Support 3-second short video on long press
  const startShortVideoRecording = useCallback(() => {
    if (!streamRef.current || cameraErrorKind || typeof MediaRecorder === 'undefined') return
    try {
      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(streamRef.current)
      mediaRecorderRef.current = recorder
      setIsRecordingVideo(true)

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        setIsRecordingVideo(false)
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
          setCapturedBlob(blob)
          setCapturedMediaType('video')
          setCapturedDataUrl(URL.createObjectURL(blob))
          setProcessError('')
          setPostFailed(false)
        }
      }
      recorder.start()
      window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop()
        }
      }, 3000)
    } catch {
      setIsRecordingVideo(false)
    }
  }, [cameraErrorKind])

  const handleShutterPointerDown = () => {
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null
      startShortVideoRecording()
    }, 350)
  }

  const handleShutterPointerUp = () => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
      void handleCapturePhoto()
    } else if (isRecordingVideo && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    setCapturedBlob(file)
    setCapturedMediaType(isVideo ? 'video' : 'image')
    setCapturedDataUrl(URL.createObjectURL(file))
    setProcessError('')
    setPostFailed(false)
  }, [])

  const handleClickGallery = useCallback(() => {
    if (premiumActive) {
      fileInputRef.current?.click()
    } else {
      setShowPremiumModal(true)
    }
  }, [premiumActive])

  const handleActivateTrial = useCallback(() => {
    try {
      localStorage.setItem(
        'fc_gold_trial',
        JSON.stringify({ active: true, since: new Date().toISOString() })
      )
    } catch {}
    setPremiumActive(true)
    setShowPremiumModal(false)
    notify('Đã kích hoạt VOW Premium dùng thử')
    setTimeout(() => fileInputRef.current?.click(), 300)
  }, [notify])

  const openHistory = useCallback(
    (initialId: string | null = null, filter: { userId: string; name: string } | null = null) => {
      setHistoryInitialId(initialId)
      setHistoryFilter(filter)
      setShowHistoryViewer(true)
    },
    []
  )

  const handlePostMoment = useCallback(async () => {
    if (!capturedDataUrl || !capturedBlob || posting) return
    setPosting(true)
    setPostFailed(false)

    try {
      let uploadBlob: Blob = capturedBlob
      let ext = capturedMediaType === 'video' ? 'webm' : 'jpg'
      let contentType = capturedBlob.type || (capturedMediaType === 'video' ? 'video/webm' : 'image/jpeg')

      if (capturedMediaType === 'image') {
        const fileObj = new File([capturedBlob], `moment_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        const compressed = await imageCompression(fileObj, {
          maxSizeMB: 0.45,
          maxWidthOrHeight: 1080,
          useWebWorker: true,
          fileType: 'image/jpeg',
        })
        uploadBlob = compressed
        ext = 'jpg'
        contentType = 'image/jpeg'
      }

      const storagePath = `${userId}/${Date.now()}.${ext}`
      const targetBucket =
        capturedMediaType === 'video' ? 'moment-videos' : 'moment-images'

      // Try uploading to moment-images / moment-videos first, fallback to 'moments' bucket seamlessly
      let publicUrl = ''
      const primaryUpload = await supabase.storage
        .from(targetBucket)
        .upload(storagePath, uploadBlob, { contentType, upsert: false })

      if (!primaryUpload.error && primaryUpload.data) {
        const { data: urlData } = supabase.storage
          .from(targetBucket)
          .getPublicUrl(primaryUpload.data.path)
        publicUrl = urlData.publicUrl
      } else {
        const fallbackUpload = await supabase.storage
          .from('moments')
          .upload(storagePath, uploadBlob, { contentType, upsert: false })
        if (fallbackUpload.error || !fallbackUpload.data) {
          throw fallbackUpload.error || new Error('Không tải được tệp lên bộ nhớ')
        }
        const { data: urlData } = supabase.storage
          .from('moments')
          .getPublicUrl(fallbackUpload.data.path)
        publicUrl = urlData.publicUrl
      }

      const res = await fetch('/api/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: publicUrl,
          media_type: capturedMediaType,
          caption: caption.trim() || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Gửi khoảnh khắc thất bại')
      }

      const { moment } = await res.json()
      const newMoment: MomentWithProfile = {
        ...moment,
        profiles: {
          id: userId,
          username: currentUser?.username ?? null,
          full_name: currentUser?.full_name ?? null,
          avatar_url: currentUser?.avatar_url ?? null,
        },
      }

      setMoments((prev) => [newMoment, ...prev])
      setCapturedDataUrl(null)
      setCapturedBlob(null)
      setCaption('')
      notify('Chỉ bạn bè mới thấy khoảnh khắc của bạn')
      openHistory(newMoment.id, null)
    } catch (err: any) {
      setPostFailed(true)
      notify(err?.message || 'Gửi khoảnh khắc thất bại', 'error')
    } finally {
      setPosting(false)
    }
  }, [
    capturedDataUrl,
    capturedBlob,
    posting,
    capturedMediaType,
    userId,
    supabase,
    caption,
    currentUser,
    notify,
    openHistory,
  ])

  const handleDeleteMoment = useCallback(
    async (momentId: string) => {
      if (!window.confirm('Xóa khoảnh khắc này?')) return
      try {
        const { error } = await (supabase.from('moments') as any)
          .update({ is_deleted: true })
          .eq('id', momentId)
        if (error) throw error
        setMoments((prev) => prev.filter((m) => m.id !== momentId))
      } catch (err: any) {
        notify(err?.message || 'Xóa thất bại', 'error')
      }
    },
    [supabase, notify]
  )

  const handleCopyInviteLink = useCallback(async () => {
    try {
      const link = `${window.location.origin}/khoang-khac?code=${encodeURIComponent(myInviteCode)}`
      await navigator.clipboard.writeText(`Kết bạn trên VOW với mình nhé: ${link}`)
      notify('Đã sao chép link mời kết bạn')
    } catch {
      notify('Không sao chép được', 'error')
    }
  }, [myInviteCode, notify])

  const handleSendFriendRequest = useCallback(async () => {
    const code = inviteInput.trim().toUpperCase()
    if (!code || sendingInvite) return
    setSendingInvite(true)
    try {
      const cleanPrefix = code.replace(/^FC-/, '').toLowerCase()
      const { data: candidates } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, church_name')
        .neq('id', userId)
        .limit(100)

      const target = ((candidates ?? []) as any[]).find(
        (p) =>
          p.id.replace(/-/g, '').toLowerCase().startsWith(cleanPrefix) ||
          (p.username && p.username.toUpperCase() === code)
      )

      if (!target) {
        throw new Error('Không tìm thấy người dùng với mã mời này')
      }

      const { error } = await (supabase.from('friend_requests') as any).insert({
        sender_id: userId,
        receiver_id: target.id,
        status: 'pending',
      })
      if (error && error.code !== '23505') throw error

      setInviteInput('')
      setOutgoing((prev) => [
        ...prev,
        {
          id: `req-${Date.now()}`,
          profile: {
            id: target.id,
            name: target.full_name || target.username || 'Người dùng VOW',
            photos: target.avatar_url ? [target.avatar_url] : [],
            church: target.church_name || '',
          },
        },
      ])
      notify(`Đã gửi lời mời tới ${target.full_name || target.username || 'bạn mới'}`)
    } catch (err: any) {
      notify(err?.message || 'Gửi lời mời thất bại', 'error')
    } finally {
      setSendingInvite(false)
    }
  }, [inviteInput, sendingInvite, supabase, userId, notify])

  const handleAcceptRequest = useCallback(
    async (req: FriendItem) => {
      try {
        // DB trigger creates the friendship + conversation when a request is accepted.
        const { error: accErr } = await (supabase.from('friend_requests') as any)
          .update({ status: 'accepted' })
          .eq('id', req.id)
        if (accErr) throw accErr
        setIncoming((prev) => prev.filter((r) => r.id !== req.id))
        setFriends((prev) => [...prev, req])
        notify(`Đã kết bạn với ${req.profile.name}`)
      } catch (err: any) {
        notify(err?.message || 'Chấp nhận thất bại', 'error')
      }
    },
    [supabase, userId, notify]
  )

  const handleDeclineRequest = useCallback(
    async (req: FriendItem) => {
      try {
        await (supabase.from('friend_requests') as any)
          .update({ status: 'rejected' })
          .eq('id', req.id)
        setIncoming((prev) => prev.filter((r) => r.id !== req.id))
        notify(`Đã từ chối lời mời của ${req.profile.name}`)
      } catch (err: any) {
        notify(err?.message || 'Từ chối thất bại', 'error')
      }
    },
    [supabase, notify]
  )

  const handleCancelRequest = useCallback(
    async (req: FriendItem) => {
      try {
        await (supabase.from('friend_requests') as any).delete().eq('id', req.id)
        setOutgoing((prev) => prev.filter((r) => r.id !== req.id))
        notify(`Đã hủy lời mời tới ${req.profile.name}`)
      } catch (err: any) {
        notify(err?.message || 'Hủy lời mời thất bại', 'error')
      }
    },
    [supabase, notify]
  )

  const handleRemoveFriend = useCallback(
    async (fr: FriendItem) => {
      if (!window.confirm(`Hủy kết bạn với ${fr.profile.name}?`)) return
      try {
        await (supabase.from('friendships') as any).delete().eq('id', fr.id)
        setFriends((prev) => prev.filter((f) => f.id !== fr.id))
        notify(`Đã hủy kết bạn với ${fr.profile.name}`)
      } catch (err: any) {
        notify(err?.message || 'Hủy kết bạn thất bại', 'error')
      }
    },
    [supabase, notify]
  )

  const peerOf = useCallback(
    (uid: string, m?: MomentWithProfile) => {
      if (uid === userId) {
        return { name: 'Bạn', avatar: currentUser?.avatar_url ?? null }
      }
      if (m?.profiles) {
        return {
          name: m.profiles.full_name || m.profiles.username || 'Bạn bè',
          avatar: m.profiles.avatar_url || null,
        }
      }
      const f = friends.find((item) => item.profile.id === uid)
      if (f) return { name: f.profile.name, avatar: f.profile.photos[0] ?? null }
      return { name: 'Bạn bè', avatar: null }
    },
    [userId, currentUser, friends]
  )

  const handleReplyMoment = useCallback(
    async (moment: MomentWithProfile, text: string, stickerKey?: string) => {
      try {
        const targetUid = moment.user_id
        if (targetUid === userId) {
          notify('Đây là khoảnh khắc của bạn', 'error')
          return
        }

        // Get-or-create the unique direct conversation (checks friendship/match + block server-side)
        const { data: convData, error: convErr } = await (supabase as any).rpc(
          'get_or_create_direct_conversation',
          { other_user: targetUid }
        )
        if (convErr) throw convErr
        const convId = convData as string

        const content = stickerKey ? `[sticker:${stickerKey}]` : text
        const { error: msgErr } = await (supabase.from('messages') as any).insert({
          conversation_id: convId,
          sender_id: userId,
          content,
        })
        if (msgErr) throw msgErr

        notify('Đã gửi trả lời')
      } catch (err: any) {
        notify(err?.message || 'Gửi trả lời thất bại', 'error')
      }
    },
    [userId, supabase, notify]
  )

  const sortedMoments = useMemo(
    () => [...moments].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [moments]
  )
  const latestThumb = sortedMoments[0]?.thumbnail_url || sortedMoments[0]?.media_url || null
  const filteredMoments = historyFilter
    ? sortedMoments.filter((m) => m.user_id === historyFilter.userId)
    : sortedMoments

  const cameraErrorCopy = {
    permission: {
      title: 'Chưa được cấp quyền camera',
      hint: 'iPhone: mở Cài đặt → Safari → Camera → chọn "Cho phép", rồi quay lại đây bấm Thử lại.',
    },
    notfound: {
      title: 'Không tìm thấy camera',
      hint: 'Thiết bị này không có camera khả dụng, hoặc camera đang bị app khác giữ.',
    },
    busy: {
      title: 'Camera đang bận',
      hint: 'Có thể một app khác đang dùng camera. Tắt app đó rồi bấm Thử lại.',
    },
    unsupported: {
      title: 'Trình duyệt này không mở được camera',
      hint: 'Hãy mở VOW bằng Safari (iPhone) hoặc Chrome (Android) thay vì xem trong app khác.',
    },
    unknown: {
      title: 'Không mở được camera',
      hint: 'Kiểm tra quyền camera của trình duyệt rồi bấm Thử lại.',
    },
  }

  const availableZooms = useMemo(() => {
    const base = [1, 2]
    if (zoomRange && zoomRange.min <= 0.65) {
      return [0.6, 1, 2]
    }
    return base
  }, [zoomRange])

  const ownInitial = (
    currentUser?.full_name?.trim().charAt(0) ||
    currentUser?.username?.trim().charAt(0) ||
    '?'
  ).toUpperCase()

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-md flex-col bg-black">
      {/* Top Bar (1:1 Original VOW) */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => router.push('/ho-so')}
          aria-label="Hồ sơ của tôi"
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1c1c1e] text-[17px] font-bold text-white/70 transition active:scale-95"
        >
          {currentUser?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUser.avatar_url}
              alt="Tôi"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{ownInitial}</span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowGridModal(true)}
            aria-label="Xem tất cả khoảnh khắc dạng lưới"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1c1c1e] text-white transition active:scale-95"
          >
            <GridFourSvg className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => router.push('/tin-nhan')}
            aria-label="Tin nhắn"
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#1c1c1e] text-white transition active:scale-95"
          >
            <ChatBubbleSvg className="h-6 w-6" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFriendsDialog((v) => !v)}
          aria-label="Mở danh sách bạn bè"
          className="relative flex h-14 shrink-0 items-center gap-2 rounded-full bg-[#1c1c1e] px-6 text-white transition active:scale-95"
        >
          <UsersSvg className="h-5 w-5" />
          <span className="text-[17px] font-semibold">{friends.length} Bạn</span>
          {incoming.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-ink">
              {incoming.length}
            </span>
          )}
        </button>
      </div>

      {/* Full-Screen Friends Dialog (f in original) */}
      {showFriendsDialog && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-ink"
          role="dialog"
          aria-modal="true"
          aria-label="Bạn bè"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFriendsDialog(false)}
                aria-label="Quay lại"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-cream active:scale-95"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-serif text-2xl font-semibold text-cream">Bạn bè</h2>
            </div>
            <span className="text-sm font-medium text-muted">{friends.length} bạn bè</span>
          </div>

          <div className="nice-scroll flex-1 overflow-y-auto px-4 pb-8">
            <section className="rounded-3xl bg-surface p-5">
              {incoming.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">
                    Lời mời kết bạn ({incoming.length})
                  </p>
                  <ul className="space-y-2">
                    {incoming.map((req) => (
                      <li
                        key={req.id}
                        className="flex items-center gap-3 rounded-2xl bg-ink p-3"
                      >
                        {req.profile.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={req.profile.photos[0]}
                            alt={req.profile.name}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface2 text-gold">
                            <UsersSvg className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-cream">
                            {req.profile.name}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {req.profile.church || 'Muốn kết bạn với bạn'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleAcceptRequest(req)}
                          className="shrink-0 rounded-full bg-gold px-4 py-2 text-xs font-bold text-ink active:scale-95"
                        >
                          Đồng ý
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeclineRequest(req)}
                          className="shrink-0 rounded-full bg-surface2 px-4 py-2 text-xs font-semibold text-muted active:scale-95"
                        >
                          Từ chối
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {friends.length === 0 && incoming.length === 0 && (
                <p className="text-center text-sm text-muted">
                  Chưa có bạn nào. Chia sẻ mã mời để bắt đầu.
                </p>
              )}

              <div className="mt-3 rounded-2xl bg-surface2 p-4">
                <p className="text-xs uppercase tracking-wider text-muted">Mã mời của bạn</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xl font-bold tracking-widest text-gold">
                    {myInviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyInviteLink()}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-goldsoft px-4 py-2 text-sm font-semibold text-gold active:scale-95"
                  >
                    <CopySvg />
                    Sao chép
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Gửi link này cho bạn bè — họ mở link là tới thẳng trang kết bạn, mã tự điền sẵn.
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSendFriendRequest()
                  }}
                  placeholder="Nhập mã mời (VD: FC-ABC123)"
                  className="h-12 flex-1 rounded-2xl border border-surface2 bg-ink px-4 text-sm tracking-wider text-cream placeholder:normal-case placeholder:text-muted focus:border-gold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleSendFriendRequest()}
                  disabled={!inviteInput.trim() || sendingInvite}
                  className="h-12 shrink-0 rounded-2xl bg-gold px-5 text-sm font-bold text-ink disabled:opacity-40 active:scale-95"
                >
                  Gửi lời mời
                </button>
              </div>

              {outgoing.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    Đang chờ chấp nhận ({outgoing.length})
                  </p>
                  <ul className="space-y-2">
                    {outgoing.map((req) => (
                      <li
                        key={req.id}
                        className="flex items-center gap-3 rounded-2xl bg-ink p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-cream">
                            {req.profile.name}
                          </p>
                          <p className="text-xs text-muted">Đã gửi lời mời</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCancelRequest(req)}
                          className="shrink-0 rounded-full bg-surface2 px-3 py-1.5 text-xs text-muted active:scale-95"
                        >
                          Hủy lời mời
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {friends.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    Bạn bè ({friends.length})
                  </p>
                  <ul className="space-y-3">
                    {friends.map((fr) => (
                      <li
                        key={fr.id}
                        className="flex items-center gap-3 rounded-2xl bg-ink p-3"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowFriendsDialog(false)
                            openHistory(null, {
                              userId: fr.profile.id,
                              name: fr.profile.name,
                            })
                          }}
                          aria-label={`Xem khoảnh khắc của ${fr.profile.name}`}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.98]"
                        >
                          {fr.profile.photos[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={fr.profile.photos[0]}
                              alt={fr.profile.name}
                              className="h-11 w-11 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface2 text-gold">
                              <UsersSvg className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-cream">
                              {fr.profile.name}
                            </p>
                            <p className="truncate text-xs text-muted">{fr.profile.church}</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoveFriend(fr)}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-surface2 px-3 py-1.5 text-xs text-danger active:scale-95"
                        >
                          <CloseSvg className="h-3.5 w-3.5" />
                          Hủy kết bạn
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Full-Screen Grid & Memories Modal (m in original + Memories Calendar) */}
      {showGridModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Tất cả khoảnh khắc"
        >
          <div className="flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setShowGridModal(false)}
              aria-label="Đóng"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1c1c1e] text-white transition active:scale-95"
            >
              <CloseSvg className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-1 rounded-full bg-[#1c1c1e] p-1">
              <button
                type="button"
                onClick={() => setGridTab('grid')}
                className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
                  gridTab === 'grid' ? 'bg-white/15 text-white' : 'text-white/50'
                }`}
              >
                Khoảnh khắc
              </button>
              <button
                type="button"
                onClick={() => setGridTab('memories')}
                className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
                  gridTab === 'memories' ? 'bg-white/15 text-gold' : 'text-white/50'
                }`}
              >
                Ký ức
              </button>
            </div>

            <span className="w-11 text-center text-sm text-white/50">{moments.length}</span>
          </div>

          {gridTab === 'memories' ? (
            <MemoriesCalendarView
              moments={sortedMoments}
              onSelectMoment={(id) => {
                setShowGridModal(false)
                openHistory(id, null)
              }}
            />
          ) : (
            <div className="nice-scroll flex-1 overflow-y-auto px-3 pb-10">
              {sortedMoments.length === 0 ? (
                <p className="mt-24 px-8 text-center text-sm text-white/40">
                  Chưa có khoảnh khắc nào.
                  <br />
                  Chụp tấm đầu tiên để lưu lại nhé.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {sortedMoments.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setShowGridModal(false)
                        openHistory(m.id, null)
                      }}
                      aria-label={`Xem khoảnh khắc ${timeAgoVi(m.created_at)}`}
                      className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[#1c1c1e] transition active:scale-95"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.thumbnail_url || m.media_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Body: Captured Preview OR Live Camera Viewfinder */}
      {capturedDataUrl ? (
        <section className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="relative mt-3 min-h-[180px] flex-1 overflow-hidden rounded-[2.5rem] bg-[#1c1c1e]">
            {capturedMediaType === 'video' ? (
              <video
                src={capturedDataUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capturedDataUrl}
                alt="Khoảnh khắc vừa chụp"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>

          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Thêm chú thích (không bắt buộc)..."
            maxLength={140}
            className="mt-4 h-12 w-full shrink-0 rounded-full border border-white/10 bg-[#1c1c1e] px-5 text-sm text-white placeholder:text-white/40 focus:border-gold focus:outline-none"
          />

          <div className="mt-3 flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                setCapturedDataUrl(null)
                setCapturedBlob(null)
              }}
              className="flex-1 rounded-full bg-[#1c1c1e] py-3.5 text-sm font-semibold text-white active:scale-95"
            >
              Chụp lại
            </button>
            <button
              type="button"
              onClick={() => void handlePostMoment()}
              disabled={posting}
              className="flex-[2] rounded-full bg-gold py-3.5 text-sm font-bold text-ink disabled:opacity-40 active:scale-95"
            >
              {posting ? 'Đang gửi...' : postFailed ? 'Thử gửi lại' : 'Gửi cho bạn bè'}
            </button>
          </div>

          {postFailed && (
            <p className="mt-2 text-center text-xs text-danger">
              Gửi thất bại — ảnh vẫn còn đây, kiểm tra mạng rồi bấm thử lại nhé.
            </p>
          )}
          {processError && (
            <p className="mt-2 text-center text-xs text-danger">{processError}</p>
          )}
        </section>
      ) : (
        <section
          className="flex min-h-0 flex-1 flex-col px-4"
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              swipeStartRef.current = {
                y: e.touches[0].clientY,
                scrollY: window.scrollY,
              }
            } else {
              swipeStartRef.current = null
            }
          }}
          onTouchEnd={(e) => {
            const start = swipeStartRef.current
            swipeStartRef.current = null
            if (!start) return
            const touch = e.changedTouches[0]
            if (!touch || (e.target as HTMLElement)?.closest('input, textarea')) return
            const dy = start.y - touch.clientY
            const scrolled = Math.abs(window.scrollY - start.scrollY) > 8
            if (dy > 70 && !scrolled) {
              openHistory(null, null)
            }
          }}
        >
          {/* Camera Viewfinder */}
          <div className="relative mt-3 min-h-[180px] flex-1 overflow-hidden rounded-[3rem] bg-[#1c1c1e]">
            {cameraErrorKind ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center">
                <CameraOutlineSvg className="h-14 w-14 text-white/40" />
                <p className="text-sm font-semibold text-white">
                  {cameraErrorCopy[cameraErrorKind].title}
                </p>
                <p className="text-xs leading-relaxed text-white/50">
                  {cameraErrorCopy[cameraErrorKind].hint}
                </p>
                <button
                  type="button"
                  onClick={() => void startCamera(facingMode)}
                  className="mt-1 rounded-full bg-white/10 px-6 py-2.5 text-sm font-semibold text-white active:scale-95"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 h-full w-full bg-black object-cover transition-transform duration-150"
                style={{
                  transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} ${
                    facingMode !== 'user' && !zoomRange && zoom !== 1 ? `scale(${zoom})` : ''
                  }`.trim() || undefined,
                }}
              />
            )}

            {/* Top-left Flash button inside viewfinder (⚡) */}
            {!cameraErrorKind && (
              <button
                type="button"
                onClick={() => void handleToggleTorch()}
                aria-label={torchOn ? 'Tắt flash' : 'Bật flash'}
                className={`absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition active:scale-95 ${
                  torchOn ? 'bg-gold text-ink' : 'bg-black/30 text-white'
                }`}
              >
                <FlashBoltSvg off={!torchOn} />
              </button>
            )}

            {isRecordingVideo && (
              <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-red-600/80 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                REC 3s
              </div>
            )}
          </div>

          {/* Zoom Selector Row (1x / 2x) */}
          {!cameraErrorKind && facingMode !== 'user' && (
            <div className="mt-3 flex shrink-0 items-center justify-center gap-2">
              {availableZooms.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => void handleSetZoom(z)}
                  aria-label={`Zoom ${z}x`}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    Math.abs(zoom - z) < 0.001
                      ? 'bg-[#a3e635] text-ink'
                      : 'bg-black/30 text-white backdrop-blur'
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>
          )}

          {/* Capture Controls Row */}
          <div className="mt-4 flex shrink-0 items-center justify-between px-10">
            <button
              type="button"
              onClick={handleClickGallery}
              aria-label="Chọn ảnh từ thư viện (VOW Premium)"
              className="relative active:scale-90"
            >
              {latestThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latestThumb}
                  alt="Ảnh gần nhất"
                  className="h-14 w-14 -rotate-6 rounded-2xl border border-white/20 object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center text-white">
                  <GalleryAddSvg />
                </span>
              )}
              {!premiumActive && (
                <span className="absolute -right-2 -top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.14em] text-[#a3e635] backdrop-blur">
                  PREMIUM
                </span>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onPointerDown={handleShutterPointerDown}
              onPointerUp={handleShutterPointerUp}
              disabled={cameraErrorKind !== null}
              aria-label="Chụp"
              className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-[5px] ${
                isRecordingVideo ? 'border-red-500 scale-105' : 'border-[#a3e635]'
              } bg-black disabled:opacity-40 active:scale-95 transition`}
            >
              <span
                className={`h-16 w-16 rounded-full ${
                  isRecordingVideo ? 'bg-red-500 scale-75' : 'bg-white'
                } transition`}
              />
            </button>

            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
              aria-label="Đổi camera"
              className="text-white active:scale-90"
            >
              <FlipCameraSvg />
            </button>
          </div>

          {/* Bottom History Trigger (Lịch sử ⌄) */}
          <div className="mt-3 shrink-0 select-none pb-4 text-center">
            <button
              type="button"
              onClick={() => openHistory(null, null)}
              className="mx-auto flex items-center gap-1.5 text-[17px] font-semibold text-white active:scale-95"
            >
              Lịch sử
              <ChevronDownSvg />
            </button>
            {sortedMoments.length > 0 ? (
              <p className="mt-1.5 text-xs text-white/40">
                {sortedMoments.length} khoảnh khắc · mới nhất{' '}
                {timeAgoVi(sortedMoments[0].created_at)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-white/40">Vuốt lên để xem khoảnh khắc</p>
            )}
          </div>
        </section>
      )}

      {/* Full-Screen Locket History Viewer */}
      {showHistoryViewer && (
        <HistoryViewer
          moments={filteredMoments}
          initialId={historyInitialId}
          filterName={historyFilter?.name ?? null}
          onClearFilter={() => setHistoryFilter(null)}
          onOpenFriends={() => {
            setShowHistoryViewer(false)
            setShowFriendsDialog(true)
          }}
          onClose={() => setShowHistoryViewer(false)}
          uid={userId}
          peerOf={peerOf}
          onDelete={(id) => void handleDeleteMoment(id)}
          onReplyMoment={handleReplyMoment}
          ownAvatar={currentUser?.avatar_url ?? null}
          onOpenProfile={() => {
            setShowHistoryViewer(false)
            router.push('/ho-so')
          }}
        />
      )}

      {/* VOW Premium Trial Modal (E in original) */}
      {showPremiumModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setShowPremiumModal(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative w-full max-w-md rounded-t-[2rem] bg-[#a3e635] p-6 pb-8 text-ink">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink/20" />
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">VOW Premium</h3>
              <span className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#a3e635]">
                PREMIUM
              </span>
            </div>
            <p className="mt-2 text-sm font-medium">
              Chọn ảnh từ thư viện là tính năng VOW Premium. Dùng thử miễn phí 7 ngày:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>• Chọn ảnh có sẵn từ thư viện</li>
              <li>• Lịch sử không giới hạn</li>
              <li>• Huy hiệu premium</li>
            </ul>
            <button
              type="button"
              onClick={handleActivateTrial}
              className="mt-5 w-full rounded-2xl bg-ink py-3.5 text-sm font-bold text-[#a3e635] active:scale-95"
            >
              Kích hoạt dùng thử miễn phí
            </button>
            <button
              type="button"
              onClick={() => setShowPremiumModal(false)}
              className="mt-2 w-full rounded-2xl py-2.5 text-sm font-semibold text-ink/70 active:scale-95"
            >
              Để sau
            </button>
            <p className="mt-2 text-center text-[11px] opacity-70">
              Bản dùng thử mô phỏng — không thanh toán thật.
            </p>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastBanner && (
        <div
          key={toastBanner.id}
          className={`fixed bottom-24 left-1/2 z-50 max-w-xs -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm font-medium shadow-lg ${
            toastBanner.kind === 'error' ? 'bg-danger text-ink' : 'bg-surface2 text-cream'
          }`}
        >
          {toastBanner.message}
        </div>
      )}
    </div>
  )
}
