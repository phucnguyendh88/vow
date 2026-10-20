'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DailyVerse } from '@/types/database'
import { getTodayLesson, type BibleLesson } from '@/lib/bible'
import WallpaperModal from './WallpaperModal'
import SettingsModal from './SettingsModal'

interface Props {
  verse: DailyVerse | null
  verseError: string | null
  streaks: string[]
  totalStreak: number
  todayRead: boolean
  userId: string
  userName: string
  today: string
  isAdmin?: boolean
}

const DAY_NAMES = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY']
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MUSIC_STORAGE_KEY = 'fc_music_on'

function getWeekDates(today: string): string[] {
  const date = new Date(today)
  const dayOfWeek = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 11) return 'buổi sáng'
  if (hour >= 11 && hour < 13) return 'buổi trưa'
  if (hour >= 13 && hour < 18) return 'buổi chiều'
  return 'buổi tối'
}

function FlameIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MusicOnIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function MusicOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="m2 2 20 20" strokeLinecap="round" />
    </svg>
  )
}

function PictureIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path
        d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GearIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function QuoteWatermark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10.7 5.6C7 7.2 4.8 10 4.8 13.6c0 3 1.8 4.8 4 4.8 1.9 0 3.4-1.4 3.4-3.2 0-1.7-1.2-3-2.9-3.1.3-1.9 1.8-3.7 3.9-4.7l-2.5-1.8zm8.5 0c-3.7 1.6-5.9 4.4-5.9 8 0 3 1.8 4.8 4 4.8 1.9 0 3.4-1.4 3.4-3.2 0-1.7-1.2-3-2.9-3.1.3-1.9 1.8-3.7 3.9-4.7l-2.5-1.8z" />
    </svg>
  )
}

export default function DevotionClient({
  verse,
  streaks,
  totalStreak,
  todayRead: initialTodayRead,
  userId,
  userName,
  today,
  isAdmin = false,
}: Props) {
  const [todayRead, setTodayRead] = useState(initialTodayRead)
  const [readStreaks, setReadStreaks] = useState<string[]>(streaks)
  const [currentStreak, setCurrentStreak] = useState(totalStreak)

  const [musicOn, setMusicOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = localStorage.getItem(MUSIC_STORAGE_KEY)
      return saved === null || saved === '1'
    } catch {
      return true
    }
  })

  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [lightMode, setLightMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('vow_devotion_light') === '1'
    } catch {
      return false
    }
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const musicOnRef = useRef(musicOn)
  musicOnRef.current = musicOn

  const [fallbackLesson, setFallbackLesson] = useState<BibleLesson | null>(null)
  const supabase = createClient()

  const now = new Date()
  const weekDates = getWeekDates(today)
  const dayIndex = (now.getDay() + 6) % 7
  const headerDateStr = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} THÁNG ${now.getMonth() + 1}`

  useEffect(() => {
    setFallbackLesson(getTodayLesson(new Date()))
  }, [])

  useEffect(() => {
    const audio = new Audio('/audio-bg.m4a')
    audio.loop = true
    audio.preload = 'auto'
    audioRef.current = audio

    const tryPlay = () => {
      if (musicOnRef.current) {
        audio.play().catch(() => {})
      }
    }
    tryPlay()

    const handleFirstInteraction = () => tryPlay()
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction)
      audio.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEY, musicOn ? '1' : '0')
    } catch {}
    const audio = audioRef.current
    if (audio) {
      if (musicOn) {
        audio.play().catch(() => undefined)
      } else {
        audio.pause()
      }
    }
  }, [musicOn])

  const toggleLightMode = () => {
    setLightMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('vow_devotion_light', next ? '1' : '0')
      } catch {}
      return next
    })
  }

  const handleMarkRead = useCallback(async () => {
    if (todayRead) return
    setTodayRead(true)
    setReadStreaks((prev) => (prev.includes(today) ? prev : [...prev, today]))
    setCurrentStreak((prev) => prev + 1)

    try {
      await (supabase.from('reading_streaks') as any).insert({
        user_id: userId,
        date: today,
      })
    } catch {}
  }, [todayRead, supabase, userId, today])

  const iconBtnClass =
    'flex h-10 w-10 items-center justify-center rounded-full bg-surface text-cream active:scale-95 transition'

  // Prefer the curated 574 Bible lessons (exact match to original VOW's bai-hoc-BqR8ZEkY.js) or DB verse
  const lesson = fallbackLesson
  const verseText = lesson?.loi_kinh_thanh || verse?.verse_text || ''
  const verseRef = lesson
    ? `${lesson.sach} ${lesson.chuong}:${lesson.cau}`
    : verse?.verse_reference || ''
  const meditationText = lesson?.bai_hoc || verse?.meditation_text || ''
  const prayerText = lesson?.loi_cau_nguyen || ''

  return (
    <div className={`pb-28 ${lightMode ? 'devotion-light bg-white' : ''}`}>
      <header className="px-5 pt-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {headerDateStr}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setMusicOn((prev) => !prev)}
              aria-label={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              title={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              className={`${iconBtnClass} ${musicOn ? 'text-gold' : 'text-muted'}`}
            >
              {musicOn ? <MusicOnIcon className="h-5 w-5" /> : <MusicOffIcon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={toggleLightMode}
              aria-label={lightMode ? 'Chế độ tối' : 'Chế độ sáng'}
              title={lightMode ? 'Chế độ tối' : 'Chế độ sáng'}
              className={`${iconBtnClass} ${lightMode ? 'text-gold' : 'text-muted'}`}
            >
              {lightMode ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={() => setShowWallpaperModal(true)}
              aria-label="Tạo hình nền"
              title="Tạo hình nền"
              className={iconBtnClass}
            >
              <PictureIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Cài đặt"
              title="Cài đặt"
              className={iconBtnClass}
            >
              <GearIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="min-w-0 flex-1 truncate font-serif text-[clamp(1rem,4.4vw,1.25rem)] font-semibold leading-snug text-cream">
            Chào {getGreeting(now.getHours())}
            {userName ? `, ${userName}.` : '.'}
          </h1>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-goldsoft px-3 py-1.5">
            <FlameIcon className="h-4 w-4 text-gold" />
            <span className="whitespace-nowrap text-sm font-semibold text-gold">
              {currentStreak} ngày
            </span>
          </div>
        </div>

        <p className="mt-1.5 whitespace-nowrap text-[clamp(0.8rem,3.9vw,0.95rem)] text-muted">
          Hãy dành 5 phút tìm kiếm Chúa trước nhé
        </p>

        <div className="mt-4 flex items-start justify-between px-1">
          {DAYS.map((day, idx) => {
            const dateStr = weekDates[idx]
            const isRead = readStreaks.includes(dateStr) || (idx === dayIndex && todayRead)
            const isToday = idx === dayIndex
            return (
              <div key={day} className="flex flex-col items-center gap-2">
                <span className={`text-xs font-medium ${isToday ? 'text-gold' : 'text-muted'}`}>
                  {day}
                </span>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    isRead
                      ? 'bg-gold'
                      : isToday
                      ? 'border-2 border-gold bg-transparent'
                      : 'bg-surface2'
                  }`}
                >
                  {isRead && <CheckIcon className="h-5 w-5 text-ink" />}
                </div>
              </div>
            )
          })}
        </div>
      </header>

      {verseText ? (
        <>
          <section className="relative mx-5 mt-7 overflow-hidden rounded-3xl bg-surface p-6">
            <QuoteWatermark className="absolute right-4 top-4 h-16 w-16 text-gold opacity-10" />
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
              01 · Câu gốc
            </p>
            <p className="mt-4 text-[1.25rem] font-normal leading-relaxed text-cream/90">
              {verseText}
            </p>
            <p className="mt-5 text-lg font-semibold text-gold">{verseRef}</p>
          </section>

          <section className="mx-5 mt-6 rounded-3xl bg-surface p-6">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
              02 · Suy ngẫm
            </p>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-cream/90">
              {meditationText}
            </p>
          </section>

          {prayerText && (
            <section className="mx-5 mt-6 rounded-3xl bg-surface p-6">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
                03 · Cầu nguyện
              </p>
              <p className="mt-4 font-serif text-[1.15rem] italic leading-relaxed text-cream/90">
                {prayerText}
              </p>
            </section>
          )}

          <div className="mx-5 mt-6">
            <button
              type="button"
              onClick={handleMarkRead}
              disabled={todayRead}
              className={`flex w-full items-center justify-center gap-2 rounded-full border-2 py-3 font-semibold ${
                todayRead
                  ? 'border-gold bg-goldsoft text-gold'
                  : 'border-gold bg-transparent text-gold'
              }`}
            >
              {todayRead && <CheckIcon className="h-5 w-5" />}
              {todayRead ? 'Đã đọc hôm nay' : 'Đánh dấu đã đọc'}
            </button>
          </div>
        </>
      ) : (
        <div className="mx-5 mt-7 flex items-center justify-center rounded-3xl bg-surface p-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface2 border-t-gold" />
        </div>
      )}

      {showWallpaperModal && <WallpaperModal onClose={() => setShowWallpaperModal(false)} />}

      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isAdmin={isAdmin}
      />
    </div>
  )
}
