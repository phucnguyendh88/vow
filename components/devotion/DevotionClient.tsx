'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DailyVerse } from '@/types/database'
import toast from 'react-hot-toast'
import { Flame, Check } from 'lucide-react'

interface Props {
  verse: DailyVerse | null
  verseError: string | null
  streaks: string[]
  totalStreak: number
  todayRead: boolean
  userId: string
  userName: string
  today: string
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
  if (hour < 12) return 'buổi sáng'
  if (hour < 18) return 'buổi chiều'
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
}: Props) {
  const [todayRead, setTodayRead] = useState(initialTodayRead)
  const [marking, setMarking] = useState(false)
  const [readStreaks, setReadStreaks] = useState<string[]>(streaks)
  const [currentStreak, setCurrentStreak] = useState(totalStreak)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const supabase = createClient()
  const weekDates = getWeekDates(today)
  const todayDate = new Date(today)
  const dayIndex = (todayDate.getDay() + 6) % 7
  const dayNames = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY']
  const headerDateStr = `${dayNames[todayDate.getDay()]}, ${todayDate.getDate()} THÁNG ${todayDate.getMonth() + 1}`

  const toggleAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio('/audio-bg.m4a')
      audio.loop = true
      audioRef.current = audio
    }
    if (isPlayingAudio) {
      audioRef.current.pause()
      setIsPlayingAudio(false)
    } else {
      audioRef.current.play().catch(() => {})
      setIsPlayingAudio(true)
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

  const iconBtnClass = 'flex h-10 w-10 items-center justify-center rounded-full bg-surface text-cream active:scale-95 transition hover:brightness-110 border border-white/5'

  return (
    <div className="pb-32">
      {/* Top Header */}
      <header className="px-5 pt-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {headerDateStr}
          </p>

          <div className="flex shrink-0 gap-2">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={toggleAudio}
              aria-label={isPlayingAudio ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              className={`${iconBtnClass} ${isPlayingAudio ? 'text-gold' : 'text-muted'}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>

            {/* Settings button */}
            <button
              type="button"
              aria-label="Cài đặt"
              className={iconBtnClass}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Greeting & Streak Badge */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <h1 className="min-w-0 font-serif-vow text-[clamp(1.2rem,5.2vw,1.6rem)] font-semibold leading-snug text-cream">
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

      {/* Main Verse Content */}
      {verseError && (
        <div className="mx-5 mt-7 rounded-3xl bg-surface border border-surface2 p-6 text-center">
          <p className="text-sm text-rose-400">Không thể tải bài học hôm nay. Vui lòng kiểm tra kết nối.</p>
        </div>
      )}

      {!verse && !verseError && (
        <div className="mx-5 mt-7 rounded-3xl bg-surface border border-surface2 p-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-surface2 border-t-gold mb-3" />
          <p className="text-sm text-muted">Đang tải Lời Chúa hôm nay...</p>
        </div>
      )}

      {verse && (
        <>
          {/* Section 01: Câu gốc */}
          <section className="relative mx-5 mt-7 overflow-hidden rounded-3xl bg-surface border border-surface2 p-6 shadow-xl">
            <span
              className="absolute right-4 top-4 font-serif-vow text-6xl text-gold opacity-10 select-none leading-none pointer-events-none"
              aria-hidden="true"
            >
              “
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
              01 · Câu gốc
            </p>
            <p className="mt-4 font-serif-vow text-[1.7rem] font-medium leading-snug text-cream">
              {verse.verse_text}
            </p>
            <p className="mt-4 text-base font-semibold text-gold font-serif-vow tracking-wide">
              {verse.verse_reference}
            </p>
          </section>

          {/* Section 02: Suy ngẫm */}
          {verse.meditation_text && (
            <section className="mx-5 mt-5 rounded-3xl bg-surface border border-surface2 p-6 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
                02 · Suy ngẫm
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-cream/90">
                {verse.meditation_text}
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
        </>
      )}
    </div>
  )
}

