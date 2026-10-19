'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Settings,
  MessageCircle,
  Church,
  MapPin,
  X,
  Heart,
  User,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react'
import type { Profile, Match } from '@/types/database'
import { SEED_PROFILES, type SeedProfile } from '@/lib/seed-profiles'
import FilterModal, { type FilterOptions } from './FilterModal'
import SettingsModal from '@/components/devotion/SettingsModal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface DiscoverProfile
  extends Pick<
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
  > {}

interface MatchWithConversation extends Match {
  conversations: { id: string }[] | null
}

interface Props {
  discoverProfiles: DiscoverProfile[]
  matches: MatchWithConversation[]
  userId: string
  fetchError: string | null
}

type TabView = 'discover' | 'matches'

function calculateAge(dob: string | null): number | null {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

interface NormalizedCandidate {
  id: string
  name: string
  age: number | null
  gender: string | null
  church: string | null
  area: string | null
  bio: string | null
  interests: string[]
  avatarUrl: string | null
  isSeed?: boolean
  likesBack?: boolean
}

export default function DatingClient({
  discoverProfiles,
  matches,
  userId,
  fetchError,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<TabView>('discover')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [matchList, setMatchList] = useState(matches)
  const [newMatch, setNewMatch] = useState<{ name: string; convId?: string } | null>(null)
  const [passedProfiles, setPassedProfiles] = useState<NormalizedCandidate[]>([])

  // Modals
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Filters
  const [filters, setFilters] = useState<FilterOptions>({
    gender: 'all',
    minAge: 18,
    maxAge: 45,
    area: 'all',
  })

  // Normalize real and seed profiles
  const allCandidates: NormalizedCandidate[] = useMemo(() => {
    const real: NormalizedCandidate[] = discoverProfiles.map((p) => ({
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

    const seeds: NormalizedCandidate[] = SEED_PROFILES.map((s) => ({
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

    // Combine real candidates first, then seeds
    return [...real, ...seeds]
  }, [discoverProfiles])

  // Apply filters
  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((c) => {
      if (filters.gender !== 'all' && c.gender && c.gender !== filters.gender) return false
      if (c.age && (c.age < filters.minAge || c.age > filters.maxAge)) return false
      if (filters.area !== 'all' && c.area && !c.area.includes(filters.area)) return false
      return true
    })
  }, [allCandidates, filters])

  const currentProfile = filteredCandidates[currentIndex]

  const handleSwipe = useCallback(
    async (action: 'like' | 'pass') => {
      if (!currentProfile || swiping) return
      setSwiping(true)
      setSwipeDir(action === 'like' ? 'right' : 'left')

      if (action === 'pass') {
        setPassedProfiles((prev) => [...prev, currentProfile])
      }

      try {
        if (!currentProfile.isSeed) {
          // Ghi Swipe vào Supabase thật
          const res = await fetch('/api/swipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              swiped_id: currentProfile.id,
              action,
              context: 'dating',
            }),
          })

          const data = await res.json()
          if (!res.ok) {
            toast.error(data.error ?? 'Đã xảy ra lỗi')
            setSwiping(false)
            setSwipeDir(null)
            return
          }

          if (data.matched && action === 'like') {
            setNewMatch({
              name: currentProfile.name,
              convId: data.match?.conversations?.[0]?.id,
            })
            if (data.match) {
              setMatchList((prev) => [
                { ...data.match, conversations: data.match.conversations ?? [] },
                ...prev,
              ])
            }
          }
        } else {
          // Seed profile
          if (action === 'like' && currentProfile.likesBack) {
            setNewMatch({
              name: currentProfile.name,
            })
          }
        }
      } catch {
        toast.error('Lỗi kết nối. Vui lòng thử lại.')
      } finally {
        setTimeout(() => {
          setCurrentIndex((i) => i + 1)
          setSwiping(false)
          setSwipeDir(null)
        }, 280)
      }
    },
    [currentProfile, swiping]
  )

  const handleResetPassed = () => {
    setCurrentIndex(0)
    setPassedProfiles([])
    toast.success('Đã tải lại danh sách khám phá')
  }

  return (
    <div className="flex flex-col min-h-dvh pb-28 max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-8 pb-3">
        {/* Settings button */}
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          aria-label="Cài đặt"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-muted hover:text-cream transition active:scale-95 cursor-pointer border border-white/5"
        >
          <Settings size={18} />
        </button>

        {/* Brand V O W */}
        <p className="font-serif text-xl font-semibold tracking-[0.35em] text-gold">
          VOW
        </p>

        {/* Filter and Messages */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            aria-label="Bộ lọc"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-muted hover:text-cream transition active:scale-95 cursor-pointer border border-white/5"
          >
            <SlidersHorizontal size={18} />
          </button>

          <Link
            href="/tin-nhan"
            aria-label="Tin nhắn"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-muted hover:text-cream transition active:scale-95 cursor-pointer border border-white/5"
          >
            <MessageCircle size={18} />
          </Link>
        </div>
      </header>

      {/* Tabs Switcher: Khám phá / Tương hợp */}
      <div className="flex px-5 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('discover')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            tab === 'discover'
              ? 'bg-gold text-ink shadow-md shadow-gold/20'
              : 'bg-surface2 text-muted hover:text-cream'
          }`}
        >
          Khám phá
        </button>
        <button
          type="button"
          onClick={() => setTab('matches')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            tab === 'matches'
              ? 'bg-gold text-ink shadow-md shadow-gold/20'
              : 'bg-surface2 text-muted hover:text-cream'
          }`}
        >
          Tương hợp ({matchList.length})
        </button>
      </div>

      {/* === DISCOVER TAB === */}
      {tab === 'discover' && (
        <div className="flex-1 flex flex-col items-center justify-between px-5">
          {fetchError && (
            <p className="text-rose-400 text-xs mb-2">Lỗi tải dữ liệu mạng. Hiển thị hồ sơ đề xuất.</p>
          )}

          {/* If No More Profiles */}
          {!currentProfile && (
            <div className="w-full flex-1 flex flex-col items-center justify-center rounded-3xl bg-surface border border-surface2 p-8 text-center my-auto">
              <div className="h-16 w-16 rounded-full bg-surface2 flex items-center justify-center text-gold mb-3">
                <Sparkles size={28} />
              </div>
              <h3 className="font-serif text-xl font-semibold text-cream">Đã xem hết hồ sơ!</h3>
              <p className="mt-2 text-sm text-muted max-w-xs">
                Bạn đã xem hết các hồ sơ phù hợp với bộ lọc hiện tại.
              </p>

              {passedProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetPassed}
                  className="mt-6 flex items-center gap-2 rounded-full bg-surface2 px-5 py-2.5 text-xs font-semibold text-gold border border-gold/30 hover:bg-surface3 transition active:scale-95 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Xem lại {passedProfiles.length} người đã bỏ qua</span>
                </button>
              )}
            </div>
          )}

          {/* Active Profile Card */}
          {currentProfile && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentProfile.id}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{
                  x: swipeDir === 'right' ? 320 : swipeDir === 'left' ? -320 : 0,
                  opacity: 0,
                  rotate: swipeDir === 'right' ? 14 : swipeDir === 'left' ? -14 : 0,
                }}
                transition={{ duration: 0.25 }}
                className="relative w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-surface flex flex-col"
              >
                {/* Swipe Stamp Badges */}
                {swipeDir === 'right' && (
                  <div className="absolute top-8 left-8 z-30 rounded-2xl border-4 border-emerald-400 px-4 py-1.5 -rotate-12 bg-black/40 backdrop-blur-sm">
                    <span className="font-bold text-2xl text-emerald-400 tracking-wider">THÍCH</span>
                  </div>
                )}
                {swipeDir === 'left' && (
                  <div className="absolute top-8 right-8 z-30 rounded-2xl border-4 border-rose-500 px-4 py-1.5 rotate-12 bg-black/40 backdrop-blur-sm">
                    <span className="font-bold text-2xl text-rose-500 tracking-wider">BỎ QUA</span>
                  </div>
                )}

                {/* Profile Portrait Image */}
                <div className="relative w-full aspect-[4/5] bg-surface2 overflow-hidden">
                  {currentProfile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentProfile.avatarUrl}
                      alt={currentProfile.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted">
                      <User size={64} />
                    </div>
                  )}

                  {/* Gradient Shadow over bottom image */}
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
                </div>

                {/* Info Container */}
                <div className="p-6 pt-2 flex flex-col gap-3">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-cream">
                      {currentProfile.name}
                      {currentProfile.age && (
                        <span className="font-light text-cream/70 ml-2">
                          {currentProfile.age}
                        </span>
                      )}
                    </h2>

                    {currentProfile.church && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <Church size={13} className="text-gold shrink-0" />
                        <span>{currentProfile.church}</span>
                      </p>
                    )}

                    {currentProfile.area && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <MapPin size={13} className="text-gold shrink-0" />
                        <span>{currentProfile.area}</span>
                      </p>
                    )}
                  </div>

                  {/* Interests Pills */}
                  {currentProfile.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentProfile.interests.map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full bg-surface2 px-3 py-1 text-xs text-cream/90 border border-white/5"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bio */}
                  {currentProfile.bio && (
                    <p className="text-xs leading-relaxed text-cream/80 line-clamp-3">
                      {currentProfile.bio}
                    </p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Action Buttons: Pass & Like */}
          {currentProfile && (
            <div className="flex items-center justify-center gap-8 py-5">
              {/* Pass / Decline Button */}
              <button
                type="button"
                onClick={() => handleSwipe('pass')}
                disabled={swiping}
                aria-label="Bỏ qua"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-surface border border-rose-500/30 text-rose-400 shadow-xl transition-all active:scale-90 hover:bg-rose-500/10 cursor-pointer disabled:opacity-40"
              >
                <X size={28} strokeWidth={2.5} />
              </button>

              {/* Like / Accept Button */}
              <button
                type="button"
                onClick={() => handleSwipe('like')}
                disabled={swiping}
                aria-label="Thích"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-surface border border-emerald-500/30 text-emerald-400 shadow-xl transition-all active:scale-90 hover:bg-emerald-500/10 cursor-pointer disabled:opacity-40"
              >
                <Heart size={28} strokeWidth={2.5} fill="currentColor" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* === MATCHES TAB === */}
      {tab === 'matches' && (
        <div className="flex-1 px-5 overflow-y-auto nice-scroll">
          {matchList.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-surface2 flex items-center justify-center text-muted mb-4">
                <Heart size={28} />
              </div>
              <p className="font-serif text-lg font-semibold text-cream">Chưa có tương hợp nào</p>
              <p className="mt-1 text-xs text-muted max-w-xs">
                Tiếp tục khám phá và bấm Thích những người bạn cùng đức tin nhé!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matchList.map((m) => {
                const convId = m.conversations?.[0]?.id
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3.5 rounded-2xl bg-surface p-3.5 border border-white/5 shadow-md"
                  >
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-surface2 flex items-center justify-center">
                      <User size={22} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-cream truncate">Kết nối mới</p>
                      <p className="text-xs text-muted">
                        {new Date(m.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    {convId && (
                      <Link
                        href={`/tin-nhan/${convId}`}
                        className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:brightness-105 active:scale-95 transition"
                      >
                        Nhắn tin
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Match Celebration ("Hai bạn đã kết nối!") */}
      <AnimatePresence>
        {newMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
            onClick={() => setNewMatch(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[2.5rem] bg-surface border border-gold/30 p-8 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-gold mb-4">
                <Sparkles size={32} />
              </div>
              <h2 className="font-serif text-2xl font-bold text-cream">
                Hai bạn đã kết nối!
              </h2>
              <p className="mt-2 text-sm text-cream/90 leading-relaxed">
                Bạn và <span className="font-semibold text-gold">{newMatch.name}</span> đã cùng bày tỏ sự quan tâm.
              </p>
              <p className="mt-1 text-xs text-muted italic">
                “Chào bạn! Mình rất vui vì chúng ta đã ghép đôi. Cảm ơn Chúa vì sự kết nối này!”
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const conv = newMatch.convId
                    setNewMatch(null)
                    if (conv) {
                      router.push(`/tin-nhan/${conv}`)
                    } else {
                      setTab('matches')
                    }
                  }}
                  className="w-full rounded-full bg-gold py-3.5 text-sm font-semibold text-ink shadow-lg shadow-gold/20 hover:brightness-105 active:scale-95 transition cursor-pointer"
                >
                  Nhắn tin ngay
                </button>
                <button
                  type="button"
                  onClick={() => setNewMatch(null)}
                  className="w-full rounded-full bg-surface2 py-3 text-xs font-semibold text-muted hover:text-cream active:scale-95 transition cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Modal */}
      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilters={filters}
        onApply={(f) => setFilters(f)}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  )
}
