'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Profile, Match } from '@/types/database'
import { SEED_PROFILES } from '@/lib/seed-profiles'
import FilterModal, { type FilterOptions } from './FilterModal'
import SettingsModal from '@/components/devotion/SettingsModal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUnreadCount } from '@/lib/hooks/useUnreadCount'
import UserProfileModal from '@/components/profile/UserProfileModal'

type DiscoverProfile = Pick<
  Profile,
  | 'id'
  | 'username'
  | 'full_name'
  | 'bio'
  | 'avatar_url'
  | 'date_of_birth'
  | 'gender'
  | 'location_text'
  | 'church_name'
  | 'interests'
>

interface MatchWithConversation extends Match {
  conversations: { id: string }[] | null
}

interface Props {
  discoverProfiles: DiscoverProfile[]
  matches: MatchWithConversation[]
  userId: string
  fetchError: string | null
}

function calculateAge(dob: string | null): number {
  if (!dob) return 24
  const diff = Date.now() - new Date(dob).getTime()
  const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  return age >= 18 && age <= 80 ? age : 24
}

interface NormalizedCandidate {
  id: string
  name: string
  age: number
  gender: string | null
  church: string | null
  area: string | null
  bio: string | null
  interests: string[]
  avatarUrl: string | null
  isSeed?: boolean
  likesBack?: boolean
}

/* --- Original VOW Icons --- */
function SlidersSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
    </svg>
  )
}

function ChatBubbleSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
    </svg>
  )
}

function GearSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function RefreshSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

function HeartSvg({ className = 'h-8 w-8', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function CloseSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function ChurchBuildingSvg({ className = 'h-4 w-4 shrink-0 text-gold' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m18 7 4 2v14H2V9l4-2" />
      <path d="M14 22v-4a2 2 0 1 0-4 0v4" />
      <path d="M18 7V4a2 2 0 0 0-2-2v5" />
      <path d="M6 7V3a2 2 0 0 1 2-2v6" />
    </svg>
  )
}

function PinSvg({ className = 'h-4 w-4 shrink-0 text-gold' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}



export default function DatingClient({
  discoverProfiles,
  matches = [],
  userId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { unreadCount } = useUnreadCount(userId)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [swipeAction, setSwipeAction] = useState<'like' | 'pass' | null>(null)
  const [dragX, setDragX] = useState(0)
  const [rediscoverMode, setRediscoverMode] = useState(false)
  const [swipedIds, setSwipedIds] = useState<string[]>([])
  const [persistedSwipedIds, setPersistedSwipedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem('vow_swiped_candidates')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [viewProfileId, setViewProfileId] = useState<string | null>(null)
  const [ownAvatar, setOwnAvatar] = useState<string | null>(null)

  const [matchedModal, setMatchedModal] = useState<{
    id: string
    name: string
    photo: string | null
    conversationId?: string
  } | null>(null)

  const [filters, setFilters] = useState<FilterOptions>({
    gender: 'all',
    minAge: 18,
    maxAge: 60,
  })

  const draggingRef = useRef(false)
  const startXRef = useRef(0)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(
        ({ data }) => {
          if ((data as any)?.avatar_url) setOwnAvatar((data as any).avatar_url)
        },
        () => {}
      )
  }, [supabase, userId])

  const matchedPartnerIds = useMemo(() => {
    const list: string[] = []
    for (const m of matches || []) {
      const other = m.user1_id === userId ? m.user2_id : m.user1_id
      if (other) list.push(other)
    }
    return list
  }, [matches, userId])

  const allCandidates: NormalizedCandidate[] = useMemo(() => {
    const real: NormalizedCandidate[] = discoverProfiles
      .filter(
        (p) =>
          !matchedPartnerIds.includes(p.id) &&
          (rediscoverMode || !persistedSwipedIds.includes(p.id))
      )
      .map((p) => ({
        id: p.id,
        name: p.full_name ?? p.username ?? 'Thành viên',
        age: calculateAge(p.date_of_birth),
        gender: p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : null,
        church: p.church_name,
        area: p.location_text,
        bio: p.bio,
        interests: p.interests ?? [],
        avatarUrl: p.avatar_url,
        isSeed: false,
      }))

    const seeds: NormalizedCandidate[] = SEED_PROFILES
      .filter(
        (s) =>
          !matchedPartnerIds.includes(s.id) &&
          (rediscoverMode || !persistedSwipedIds.includes(s.id))
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        age: s.age,
        gender: s.gender,
        church: s.church,
        area: s.area,
        bio: s.bio,
        interests: s.interests,
        avatarUrl: s.avatarUrl,
        isSeed: true,
        likesBack: s.likesBack,
      }))

    return [...real, ...seeds]
  }, [discoverProfiles, matchedPartnerIds, persistedSwipedIds, rediscoverMode])

  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((c) => {
      if (filters.gender !== 'all' && c.gender && c.gender !== filters.gender) return false
      if (c.age < filters.minAge || c.age > filters.maxAge) return false
      if (rediscoverMode) {
        return swipedIds.includes(c.id) || persistedSwipedIds.includes(c.id) || c.isSeed
      }
      return !swipedIds.includes(c.id)
    })
  }, [allCandidates, filters, rediscoverMode, swipedIds, persistedSwipedIds])

  const currentCandidate = filteredCandidates[currentIndex]

  const toggleRediscover = useCallback(() => {
    setRediscoverMode((prev) => {
      const next = !prev
      if (!next) {
        setSwipedIds([])
      }
      setCurrentIndex(0)
      return next
    })
  }, [])

  const handleSwipe = useCallback(
    async (action: 'like' | 'pass') => {
      if (swiping || swipeAction || !currentCandidate || matchedModal) return
      setSwiping(true)
      setSwipeAction(action)
      setErrorBanner(null)

      const target = currentCandidate

      if (!target.isSeed) {
        fetch('/api/swipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            swiped_id: target.id,
            action,
            context: 'dating',
          }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.matched && action === 'like') {
              setMatchedModal({
                id: target.id,
                name: target.name,
                photo: target.avatarUrl,
                conversationId:
                  data.conversation_id ||
                  data.match?.conversation_id ||
                  data.match?.conversations?.[0]?.id,
              })
            }
          })
          .catch(() => {})
      } else if (action === 'like' && target.likesBack) {
        window.setTimeout(() => {
          setMatchedModal({
            id: target.id,
            name: target.name,
            photo: target.avatarUrl,
          })
        }, 340)
      }

      window.setTimeout(() => {
        setSwipeAction(null)
        setSwiping(false)
        setSwipedIds((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]))
        setPersistedSwipedIds((prev) => {
          if (prev.includes(target.id)) return prev
          const next = [...prev, target.id]
          try {
            localStorage.setItem('vow_swiped_candidates', JSON.stringify(next))
          } catch {}
          return next
        })
        if (rediscoverMode) {
          setCurrentIndex((i) => i + 1)
        }
      }, 320)
    },
    [swiping, swipeAction, currentCandidate, matchedModal, rediscoverMode]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swiping || swipeAction) return
    draggingRef.current = true
    startXRef.current = e.clientX
    try {
      ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || swiping || swipeAction) return
    setDragX(e.clientX - startXRef.current)
  }

  const handlePointerEnd = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (dragX > 90) {
      void handleSwipe('like')
    } else if (dragX < -90) {
      void handleSwipe('pass')
    }
    setDragX(0)
  }

  const cardStyle: React.CSSProperties =
    swipeAction === null
      ? dragX === 0
        ? {
            transform: 'translateX(0) rotate(0)',
            transition: 'transform 0.25s ease-out',
          }
        : {
            transform: `translateX(${dragX}px) rotate(${dragX / 14}deg)`,
            transition: 'none',
          }
      : {
          transform: `translateX(${swipeAction === 'like' ? 420 : -420}px) rotate(${
            swipeAction === 'like' ? 18 : -18
          }deg)`,
          opacity: 0,
          transition: 'transform 0.32s ease-in, opacity 0.32s ease-in',
        }

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col bg-[#050505]">
      {/* Top Navigation: Minimalist Luxury */}
      <header className="relative flex items-center justify-between px-5 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          aria-label="Bộ lọc"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.03)] text-[#F0F0F0] backdrop-blur-md transition active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        >
          <SlidersSvg className="h-5 w-5 text-[#E8D08D]" />
        </button>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          <span className="font-serif text-2xl font-bold tracking-[0.25em] gold-gradient-text uppercase pl-[0.25em]">
            VOW
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/tin-nhan')}
            aria-label="Tin nhắn"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.03)] text-[#F0F0F0] backdrop-blur-md transition active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
          >
            <ChatBubbleSvg className="h-5 w-5 text-[#F0F0F0]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E8D08D] px-1 text-[10px] font-bold text-black shadow-[0_0_8px_#E8D08D]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            aria-label="Cài đặt"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.03)] text-[#F0F0F0] backdrop-blur-md transition active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
          >
            <GearSvg className="h-5 w-5 text-[#F0F0F0]" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4">
        {errorBanner && (
          <p className="mb-2 rounded-2xl bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
            {errorBanner}
          </p>
        )}

        {/* Rediscover Pill (Hiện lại hồ sơ đã quét) */}
        <div className="mb-3 flex justify-center">
          <button
            type="button"
            onClick={toggleRediscover}
            aria-pressed={rediscoverMode}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium tracking-wide transition-all active:scale-95 ${
              rediscoverMode
                ? 'bg-[#E8D08D] text-black font-semibold shadow-[0_0_15px_rgba(232,208,141,0.4)]'
                : 'border border-[rgba(232,208,141,0.25)] bg-[rgba(255,255,255,0.04)] text-[#E8D08D] backdrop-blur-lg shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
            }`}
          >
            <RefreshSvg className="h-3.5 w-3.5" />
            <span>{rediscoverMode ? 'Đang xem lại · Bấm để tắt' : 'Hiện lại hồ sơ đã quét'}</span>
          </button>
        </div>

        {!currentCandidate ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[2.5rem] border border-[rgba(232,208,141,0.25)] bg-[rgba(255,255,255,0.02)] px-8 text-center backdrop-blur-xl shadow-2xl">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[rgba(232,208,141,0.3)] bg-[rgba(232,208,141,0.08)] shadow-[0_0_25px_rgba(232,208,141,0.2)]">
              <HeartSvg className="h-10 w-10 text-[#E8D08D]" />
            </div>
            <h2 className="mt-6 font-serif text-3xl font-semibold text-[#F0F0F0]">
              {rediscoverMode ? 'Đã xem hết' : 'Hết người phù hợp'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#9E9E9E]">
              {rediscoverMode
                ? 'Không còn hồ sơ nào đã bỏ qua để xem lại.'
                : 'Thử mở rộng bộ lọc hoặc xem lại những người đã bỏ qua.'}
            </p>
            <div className="mt-6 flex gap-3">
              {!rediscoverMode && (
                <button
                  type="button"
                  onClick={() => setShowFilterModal(true)}
                  className="rounded-full border border-[rgba(232,208,141,0.25)] bg-[rgba(255,255,255,0.05)] px-6 py-2.5 text-sm font-medium text-[#F0F0F0] backdrop-blur transition active:scale-95"
                >
                  Bộ lọc
                </button>
              )}
              <button
                type="button"
                onClick={toggleRediscover}
                className="flex items-center gap-2 rounded-full bg-[#E8D08D] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_0_15px_rgba(232,208,141,0.3)] transition active:scale-95"
              >
                <RefreshSvg className="h-4 w-4" />
                {rediscoverMode ? 'Về khám phá mới' : 'Xem lại'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* The Core Element: Luxury Dark Glassmorphism Profile Card */}
            <div
              className="relative flex min-h-0 flex-1 touch-none select-none"
              style={{ perspective: 800 }}
            >
              <div
                className="flex w-full min-h-0 flex-col overflow-hidden rounded-[2.2rem] border border-[rgba(232,208,141,0.28)] bg-[rgba(20,20,22,0.65)] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(232,208,141,0.25)]"
                style={cardStyle}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                {dragX > 20 && (
                  <div
                    className="pointer-events-none absolute top-6 left-6 z-10 rounded-xl border border-[#E8D08D] bg-black/60 px-4 py-1.5 font-serif font-bold tracking-widest text-[#E8D08D] shadow-[0_0_20px_rgba(232,208,141,0.5)] backdrop-blur"
                    style={{
                      opacity: Math.min(dragX / 120, 1),
                      transform: 'rotate(-12deg)',
                    }}
                  >
                    CHẤP NHẬN
                  </div>
                )}

                {dragX < -20 && (
                  <div
                    className="pointer-events-none absolute top-6 right-6 z-10 rounded-xl border border-[rgba(244,114,114,0.8)] bg-black/60 px-4 py-1.5 font-serif font-bold tracking-widest text-[#F47272] shadow-[0_0_20px_rgba(244,114,114,0.4)] backdrop-blur"
                    style={{
                      opacity: Math.min(-dragX / 120, 1),
                      transform: 'rotate(12deg)',
                    }}
                  >
                    TỪ CHỐI
                  </div>
                )}

                {/* Top Half: High-quality portrait with soft dark gradient fade at the bottom */}
                <div className="relative shrink-0">
                  {currentCandidate.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentCandidate.avatarUrl}
                      alt={currentCandidate.name}
                      draggable={false}
                      className="h-80 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-80 w-full items-center justify-center bg-gradient-to-br from-[#1c1c24] to-[#0a0a0d]">
                      <span className="font-serif text-7xl text-[#E8D08D]/60 drop-shadow-[0_0_20px_rgba(232,208,141,0.3)]">
                        {(currentCandidate.name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Subtle dark gradient overlay to blend portrait into info glass area */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[rgba(15,15,18,0.95)] via-[rgba(15,15,18,0.5)] to-transparent" />
                </div>

                {/* Bottom Half: Inside the glassmorphism card info area */}
                <div className="nice-scroll min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      onClick={() => setViewProfileId(currentCandidate.id)}
                      className="font-serif text-3xl font-semibold text-[#F0F0F0] tracking-wide hover:text-[#E8D08D] transition cursor-pointer"
                    >
                      {currentCandidate.name}, {currentCandidate.age}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setViewProfileId(currentCandidate.id)}
                      className="rounded-full border border-[rgba(232,208,141,0.3)] bg-white/[0.04] px-3.5 py-1 text-xs font-semibold text-[#E8D08D] hover:bg-white/10 transition active:scale-95 cursor-pointer shadow-sm"
                    >
                      Hồ sơ
                    </button>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-[13px] text-[#A0A0A5]">
                    {currentCandidate.church && (
                      <div className="flex items-center gap-2">
                        <ChurchBuildingSvg className="h-4 w-4 shrink-0 text-[#E8D08D]" />
                        <span className="font-normal">{currentCandidate.church}</span>
                      </div>
                    )}
                    {currentCandidate.area && (
                      <div className="flex items-center gap-2">
                        <PinSvg className="h-4 w-4 shrink-0 text-[#E8D08D]" />
                        <span className="font-normal">{currentCandidate.area}</span>
                      </div>
                    )}
                  </div>

                  {/* 3 small pill-shaped tags with thin gold borders */}
                  {currentCandidate.interests.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {currentCandidate.interests.map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full border border-[rgba(232,208,141,0.3)] bg-[rgba(255,255,255,0.04)] px-3.5 py-1 text-xs text-[#E8D08D] backdrop-blur-md"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentCandidate.bio && (
                    <p className="mt-3.5 text-[13.5px] leading-relaxed text-[#D0D0D5] font-light">
                      {currentCandidate.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Dark glass circles with metallic Rose-Gold and Champagne-Gold borders */}
            <div className="flex items-center justify-center gap-14 py-5">
              {/* Left Button (Reject): Rose-Gold border, white X */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSwipe('pass')}
                  disabled={swiping}
                  aria-label="Từ chối"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[rgba(224,155,140,0.45)] bg-[rgba(255,255,255,0.03)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_0_16px_rgba(224,155,140,0.1)] backdrop-blur-xl transition active:scale-90 disabled:opacity-40"
                >
                  <CloseSvg className="h-7 w-7 text-[#F0F0F0]" />
                </button>
                <span className="text-[11px] font-medium tracking-[0.2em] text-[rgba(224,155,140,0.9)]">
                  TỪ CHỐI
                </span>
              </div>

              {/* Right Button (Accept): Champagne-Gold border, gold heart */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSwipe('like')}
                  disabled={swiping}
                  aria-label="Chấp nhận"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[rgba(232,208,141,0.55)] bg-[rgba(255,255,255,0.03)] text-[#E8D08D] shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(232,208,141,0.15)] backdrop-blur-xl transition active:scale-90 disabled:opacity-40"
                >
                  <HeartSvg className="h-7 w-7 text-[#E8D08D]" filled={true} />
                </button>
                <span className="text-[11px] font-semibold tracking-[0.2em] text-[#E8D08D]">
                  CHẤP NHẬN
                </span>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Filter Modal */}
      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilters={filters}
        onApply={(next) => {
          setFilters(next)
          setCurrentIndex(0)
        }}
      />

      {/* Match Modal (1:1 Original VOW) */}
      {matchedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Kết nối thành công"
        >
          <div className="relative w-full max-w-sm rounded-[2rem] bg-surface p-8 text-center">
            <button
              type="button"
              onClick={() => setMatchedModal(null)}
              aria-label="Để sau"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-muted active:scale-95"
            >
              <CloseSvg className="h-4 w-4" />
            </button>

            <div className="flex items-start justify-center">
              <div className="flex w-24 flex-col items-center">
                {ownAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ownAvatar}
                    alt="Bạn"
                    className="h-20 w-20 rounded-full border-2 border-gold object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold bg-ink font-serif text-3xl text-gold">
                    B
                  </div>
                )}
                <span className="mt-2 w-full truncate text-sm font-medium text-cream">
                  Bạn
                </span>
              </div>

              <div className="mx-2 mt-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
                <HeartSvg className="h-5 w-5" filled />
              </div>

              <div className="flex w-24 flex-col items-center">
                {matchedModal.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={matchedModal.photo}
                    alt={matchedModal.name}
                    className="h-20 w-20 rounded-full border-2 border-gold object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold bg-ink font-serif text-3xl text-gold">
                    {(matchedModal.name.trim().charAt(0) || '?').toUpperCase()}
                  </div>
                )}
                <span className="mt-2 w-full truncate text-sm font-medium text-cream">
                  {matchedModal.name}
                </span>
              </div>
            </div>

            <h2 className="mt-5 font-serif text-3xl text-cream">Hai bạn đã kết nối!</h2>
            <p className="mt-2 text-sm text-muted">Hãy bắt đầu bằng một lời chào nhé.</p>

            <button
              type="button"
              onClick={() => {
                const cid = matchedModal.conversationId
                setMatchedModal(null)
                if (cid) {
                  router.push(`/tin-nhan/${cid}`)
                } else {
                  router.push('/tin-nhan')
                }
              }}
              className="mt-7 w-full rounded-full bg-gold py-3.5 font-semibold text-ink transition active:scale-[0.98]"
            >
              Nhắn tin ngay
            </button>

            <button
              type="button"
              onClick={() => {
                const id = matchedModal.id
                const name = matchedModal.name
                setMatchedModal(null)
                router.push(
                  `/khoang-khac?locket=${encodeURIComponent(id)}&name=${encodeURIComponent(
                    name
                  )}`
                )
              }}
              className="mt-2 w-full rounded-full bg-surface2 py-3.5 font-semibold text-cream transition active:scale-[0.98]"
            >
              Xem Locket
            </button>

            <button
              type="button"
              onClick={() => setMatchedModal(null)}
              className="mt-2 w-full rounded-full py-2.5 text-sm text-muted"
            >
              Để sau
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* User Profile Modal */}
      <UserProfileModal
        userId={viewProfileId}
        open={Boolean(viewProfileId)}
        onClose={() => setViewProfileId(null)}
      />
    </div>
  )
}
