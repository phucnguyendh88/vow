'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DailyVerse } from '@/types/database'
import { getTodayLesson, type BibleLesson } from '@/lib/bible'
import WallpaperModal from './WallpaperModal'
import SettingsModal from './SettingsModal'
import toast from 'react-hot-toast'
import {
  Flame,
  Check,
  Music,
  VolumeX,
  Sun,
  Moon,
  ImageIcon,
  Settings as SettingsIcon,
} from 'lucide-react'

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

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function getWeekDates(today: string): string[] {
  const date = new Date(today)
  const dayOfWeek = date.getDay() // 0 = CN, 1 = T2...
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

export default function DevotionClient({
  verse,
  verseError,
  streaks,
  totalStreak,
  todayRead: initialTodayRead,
  userId,
  userName,
  today,
  isAdmin = false,
}: Props) {
  const [todayRead, setTodayRead] = useState(initialTodayRead)
  const [marking, setMarking] = useState(false)
  const [readStreaks, setReadStreaks] = useState<string[]>(streaks)
  const [currentStreak, setCurrentStreak] = useState(totalStreak)

  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Light / Dark mode
  const [isLightMode, setIsLightMode] = useState(false)

  // Modals
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Fallback lesson from local 574 curated lessons
  const [fallbackLesson, setFallbackLesson] = useState<BibleLesson | null>(null)

  const supabase = createClient()
  const weekDates = getWeekDates(today)
  const todayDate = new Date(today)
  const dayIndex = (todayDate.getDay() + 6) % 7
  const dayNames = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY']
  const headerDateStr = `${dayNames[todayDate.getDay()]}, ${todayDate.getDate()} THÁNG ${
    todayDate.getMonth() + 1
  }`

  // Load fallback lesson
  useEffect(() => {
    const lesson = getTodayLesson(todayDate)
    setFallbackLesson(lesson)
  }, [todayDate])

  // Restore audio & theme preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('fc_devotion_theme')
      if (savedTheme === 'light') {
        setIsLightMode(true)
        document.documentElement.classList.add('devotion-light')
      }

      const savedMusic = localStorage.getItem('fc_music_on')
      if (savedMusic === '1') {
        // Prepare audio
        const audio = new Audio('/audio-bg.m4a')
        audio.loop = true
        audioRef.current = audio
        audio.play().then(() => setIsPlayingAudio(true)).catch(() => {})
      }
    } catch {}

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Toggle Theme
  const toggleTheme = () => {
    const next = !isLightMode
    setIsLightMode(next)
    if (next) {
      document.documentElement.classList.add('devotion-light')
      try {
        localStorage.setItem('fc_devotion_theme', 'light')
      } catch {}
    } else {
      document.documentElement.classList.remove('devotion-light')
      try {
        localStorage.setItem('fc_devotion_theme', 'dark')
      } catch {}
    }
  }

  // Toggle Audio
  const toggleAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio('/audio-bg.m4a')
      audio.loop = true
      audioRef.current = audio
    }
    if (isPlayingAudio) {
      audioRef.current.pause()
      setIsPlayingAudio(false)
      try {
        localStorage.setItem('fc_music_on', '0')
      } catch {}
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true)
        try {
          localStorage.setItem('fc_music_on', '1')
        } catch {}
      }).catch(() => {
        toast.error('Không thể phát nhạc nền')
      })
    }
  }

  const handleMarkRead = useCallback(async () => {
    if (todayRead || marking) return
    setMarking(true)

    const { error } = await (supabase.from('reading_streaks') as any).insert({
      user_id: userId,
      date: today,
    })

    if (error && error.code !== '23505') {
      toast.error('Không thể lưu. Vui lòng thử lại.')
      setMarking(false)
      return
    }

    setTodayRead(true)
    setReadStreaks((prev) => [...prev, today])
    setCurrentStreak((prev) => prev + 1)
    toast.success('🙏 Đã ghi nhận hôm nay!')
    setMarking(false)
  }, [todayRead, marking, supabase, userId, today])

  const iconBtnClass =
    'flex h-10 w-10 items-center justify-center rounded-full bg-surface text-cream active:scale-95 transition hover:brightness-110 border border-white/5 cursor-pointer shadow-md'

  // Determine current display texts
  const verseText = verse?.verse_text || fallbackLesson?.loi_kinh_thanh || 'Ban đầu Đức Chúa Trời dựng nên trời đất.'
  const verseRef =
    verse?.verse_reference ||
    (fallbackLesson ? `${fallbackLesson.sach} ${fallbackLesson.chuong}:${fallbackLesson.cau}` : 'Sáng Thế Ký 1:1')
  const meditationText = verse?.meditation_text || fallbackLesson?.bai_hoc
  const prayerText = fallbackLesson?.loi_cau_nguyen

  return (
    <div className="pb-32">
      {/* Top Header */}
      <header className="px-5 pt-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {headerDateStr}
          </p>

          <div className="flex shrink-0 items-center gap-2">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={toggleAudio}
              aria-label={isPlayingAudio ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              title={isPlayingAudio ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              className={`${iconBtnClass} ${isPlayingAudio ? 'text-gold' : 'text-muted'}`}
            >
              {isPlayingAudio ? <Music size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isLightMode ? 'Chế độ tối' : 'Chế độ sáng'}
              title={isLightMode ? 'Chế độ tối' : 'Chế độ sáng'}
              className={`${iconBtnClass} text-muted hover:text-cream`}
            >
              {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Wallpaper Generator Modal Button */}
            <button
              type="button"
              onClick={() => setShowWallpaperModal(true)}
              aria-label="Tạo hình nền"
              title="Tạo hình nền"
              className={`${iconBtnClass} text-muted hover:text-cream`}
            >
              <ImageIcon size={18} />
            </button>

            {/* Settings button */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Cài đặt"
              title="Cài đặt"
              className={`${iconBtnClass} text-muted hover:text-cream`}
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>

        {/* Greeting & Streak Badge */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <h1 className="min-w-0 font-serif text-[clamp(1.2rem,5.2vw,1.6rem)] font-semibold leading-snug text-cream">
            Chào {getGreeting(new Date().getHours())}{userName ? `, ${userName}.` : '.'}
          </h1>

          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 border border-gold/30">
            <Flame size={16} className="text-gold" />
            <span className="whitespace-nowrap text-sm font-semibold text-gold">
              {currentStreak} ngày
            </span>
          </div>
        </div>

        <p className="mt-1 text-[clamp(0.8rem,3.9vw,0.95rem)] text-muted">
          Hãy dành 5 phút tìm kiếm Chúa trước nhé
        </p>

        {/* 7-Day Streak Pills */}
        <div className="mt-5 flex items-start justify-between px-1">
          {DAYS.map((day, idx) => {
            const dateStr = weekDates[idx]
            const isRead = readStreaks.includes(dateStr)
            const isToday = idx === dayIndex

            return (
              <div key={day} className="flex flex-col items-center gap-2">
                <span className={`text-xs font-medium ${isToday ? 'text-gold' : 'text-muted'}`}>
                  {day}
                </span>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold transition-all ${
                    isRead
                      ? 'bg-gold text-ink shadow-sm'
                      : isToday
                      ? 'border-2 border-gold bg-transparent text-gold'
                      : 'bg-surface2 text-muted/60'
                  }`}
                >
                  {isRead ? <Check size={18} strokeWidth={3} /> : ''}
                </div>
              </div>
            )
          })}
        </div>
      </header>

      {/* Main Content */}
      {verseError && !fallbackLesson && (
        <div className="mx-5 mt-7 rounded-3xl bg-surface border border-surface2 p-6 text-center">
          <p className="text-sm text-rose-400">Không thể tải bài học hôm nay. Vui lòng kiểm tra kết nối.</p>
        </div>
      )}

      {/* Section 01: Câu gốc */}
      <section className="relative mx-5 mt-7 overflow-hidden rounded-3xl bg-surface border border-surface2 p-6 shadow-xl">
        <span
          className="absolute right-4 top-4 font-serif text-6xl text-gold opacity-10 select-none leading-none pointer-events-none"
          aria-hidden="true"
        >
          “
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          01 · Câu gốc
        </p>
        <p className="mt-4 font-serif text-[1.7rem] font-medium leading-snug text-cream">
          {verseText}
        </p>
        <p className="mt-5 text-lg font-semibold text-gold font-serif tracking-wide">
          {verseRef}
        </p>
      </section>

      {/* Section 02: Suy ngẫm */}
      {meditationText && (
        <section className="mx-5 mt-6 rounded-3xl bg-surface border border-surface2 p-6 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
            02 · Suy ngẫm
          </p>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-cream/90">
            {meditationText}
          </p>
        </section>
      )}

      {/* Section 03: Cầu nguyện (Phần Lời Cầu Nguyện của bản gốc) */}
      {prayerText && (
        <section className="mx-5 mt-6 rounded-3xl bg-surface border border-surface2 p-6 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
            03 · Cầu nguyện
          </p>
          <p className="mt-4 font-serif text-[1.15rem] italic leading-relaxed text-cream/90">
            {prayerText}
          </p>
        </section>
      )}

      {/* Check-in Button */}
      <div className="mx-5 mt-6">
        <button
          type="button"
          onClick={handleMarkRead}
          disabled={todayRead || marking}
          className={`flex w-full items-center justify-center gap-2 rounded-full border-2 py-3.5 font-semibold text-base transition-all ${
            todayRead
              ? 'border-gold bg-gold/15 text-gold'
              : 'border-gold bg-transparent text-gold hover:bg-gold/10 active:scale-[0.99] cursor-pointer'
          }`}
        >
          {todayRead && <Check size={20} strokeWidth={2.5} />}
          {todayRead ? 'Đã đọc hôm nay' : marking ? 'Đang lưu...' : 'Đánh dấu đã đọc'}
        </button>
      </div>

      {/* Wallpaper Modal */}
      {showWallpaperModal && (
        <WallpaperModal
          currentVerse={{ reference: verseRef, text: verseText }}
          onClose={() => setShowWallpaperModal(false)}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isAdmin={isAdmin}
      />
    </div>
  )
}
