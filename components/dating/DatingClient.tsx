'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import type { Profile, Match } from '@/types/database'

interface DiscoverProfile extends Pick<Profile, 'id' | 'username' | 'full_name' | 'bio' | 'avatar_url' | 'date_of_birth' | 'gender' | 'location_text' | 'church_name' | 'interests'> {}

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

const SWIPE_THRESHOLD = 100

export default function DatingClient({ discoverProfiles, matches, userId, fetchError }: Props) {
  const [tab, setTab] = useState<TabView>('discover')
  const [profiles, setProfiles] = useState(discoverProfiles)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [matchList, setMatchList] = useState(matches)
  const [newMatch, setNewMatch] = useState<{ name: string } | null>(null)

  const currentProfile = profiles[currentIndex]

  const handleSwipe = useCallback(async (action: 'like' | 'pass') => {
    if (!currentProfile || swiping) return
    setSwiping(true)
    setSwipeDir(action === 'like' ? 'right' : 'left')

    try {
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
        setNewMatch({ name: currentProfile.full_name ?? currentProfile.username ?? 'ai đó' })
        if (data.match) {
          setMatchList((prev) => [
            { ...data.match, conversations: data.match.conversations ?? [] },
            ...prev,
          ])
        }
      }
    } catch {
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      // Chuyển sang profile tiếp theo sau animation
      setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setSwiping(false)
        setSwipeDir(null)
      }, 300)
    }
  }, [currentProfile, swiping])

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-14 pb-4">
        <button className="text-xl">⚙️</button>
        <h1 className="vow-title text-gold-gradient text-xl font-bold tracking-widest">V O W</h1>
        <button className="text-xl">💬</button>
      </header>

      {/* Tab switcher */}
      <div className="flex px-4 gap-2 mb-4">
        <button
          onClick={() => setTab('discover')}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: tab === 'discover' ? 'var(--gold)' : 'var(--surface-2)',
            color: tab === 'discover' ? '#000' : 'var(--text-muted)',
          }}
        >
          Khám phá
        </button>
        <button
          onClick={() => setTab('matches')}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: tab === 'matches' ? 'var(--gold)' : 'var(--surface-2)',
            color: tab === 'matches' ? '#000' : 'var(--text-muted)',
          }}
        >
          Tương hợp ({matchList.length})
        </button>
      </div>

      {/* === DISCOVER TAB === */}
      {tab === 'discover' && (
        <div className="flex-1 flex flex-col items-center px-4 gap-6">
          {fetchError && (
            <p className="text-red-400 text-sm">Lỗi tải dữ liệu. Vui lòng thử lại.</p>
          )}

          {!currentProfile && !fetchError && (
            <div
              className="w-full rounded-3xl p-8 text-center flex flex-col items-center gap-3"
              style={{ background: 'var(--surface)' }}
            >
              <span className="text-4xl">🎉</span>
              <p className="font-medium text-white">Đã xem hết mọi người!</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Quay lại sau để khám phá thêm nhé.
              </p>
            </div>
          )}

          {currentProfile && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentProfile.id}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{
                  x: swipeDir === 'right' ? 300 : swipeDir === 'left' ? -300 : 0,
                  opacity: 0,
                  rotate: swipeDir === 'right' ? 15 : swipeDir === 'left' ? -15 : 0,
                }}
                transition={{ duration: 0.25 }}
                className="w-full rounded-3xl overflow-hidden card-shadow"
                style={{ background: 'var(--surface)' }}
              >
                {/* Profile image */}
                <div className="relative w-full" style={{ paddingTop: '120%' }}>
                  {currentProfile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentProfile.avatar_url}
                      alt={currentProfile.full_name ?? ''}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-6xl"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      👤
                    </div>
                  )}
                </div>

                {/* Profile info */}
                <div className="p-5 flex flex-col gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {currentProfile.full_name ?? currentProfile.username}
                      {calculateAge(currentProfile.date_of_birth) && (
                        <span className="font-light text-white/70">
                          , {calculateAge(currentProfile.date_of_birth)}
                        </span>
                      )}
                    </h2>
                    {currentProfile.church_name && (
                      <p className="text-sm mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        ⛪ {currentProfile.church_name}
                      </p>
                    )}
                    {currentProfile.location_text && (
                      <p className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        📍 {currentProfile.location_text}
                      </p>
                    )}
                  </div>

                  {/* Interests */}
                  {currentProfile.interests.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {currentProfile.interests.slice(0, 5).map((interest) => (
                        <span
                          key={interest}
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            background: 'var(--surface-3)',
                            color: 'var(--foreground)',
                          }}
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentProfile.bio && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {currentProfile.bio}
                    </p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Action buttons */}
          {currentProfile && (
            <div className="flex items-center justify-center gap-8 pb-4">
              <button
                onClick={() => handleSwipe('pass')}
                disabled={swiping}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg disabled:opacity-50 transition-transform active:scale-95"
                style={{ background: '#1a0000', border: '2px solid #ef4444' }}
              >
                📵
              </button>
              <button
                onClick={() => handleSwipe('like')}
                disabled={swiping}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg disabled:opacity-50 transition-transform active:scale-95"
                style={{ background: '#001a00', border: '2px solid #22c55e' }}
              >
                📲
              </button>
            </div>
          )}
        </div>
      )}

      {/* === MATCHES TAB === */}
      {tab === 'matches' && (
        <div className="flex-1 px-4 overflow-y-auto">
          {matchList.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-4xl mb-3">♡</p>
              <p className="font-medium text-white">Chưa có tương hợp nào</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Tiếp tục khám phá để tìm người phù hợp!
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2 pb-4">
            {matchList.map((match) => {
              const partnerId = match.user1_id === userId ? match.user2_id : match.user1_id
              const conversationId = match.conversations?.[0]?.id
              return (
                <div
                  key={match.id}
                  className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ background: 'var(--surface)' }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-xl"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">Match mới</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {new Date(match.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  {conversationId && (
                    <a
                      href={`/chat/${conversationId}`}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: 'var(--gold)', color: '#000' }}
                    >
                      Nhắn tin
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Match celebration modal */}
      <AnimatePresence>
        {newMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setNewMatch(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="rounded-3xl p-8 text-center w-full max-w-sm"
              style={{ background: 'var(--surface)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-5xl mb-4">🎉</p>
              <h2 className="text-xl font-bold text-white mb-2">Tương hợp!</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                Bạn và <span style={{ color: 'var(--gold)' }}>{newMatch.name}</span> đã tương hợp nhau!
              </p>
              <button
                onClick={() => { setNewMatch(null); setTab('matches') }}
                className="w-full py-3 rounded-2xl font-semibold text-black"
                style={{ background: 'var(--gold)' }}
              >
                Xem tương hợp
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
