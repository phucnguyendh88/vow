'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DailyVerse } from '@/types/database'
import toast from 'react-hot-toast'

interface Props {
  verse: DailyVerse | null
  verseError: string | null
  streaks: string[] // mảng các ngày đã đọc (7 ngày)
  totalStreak: number
  todayRead: boolean
  userId: string
  userName: string
  today: string
}

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function getWeekDates(today: string): string[] {
  const date = new Date(today)
  const dayOfWeek = date.getDay() // 0 = CN, 1 = T2, ...
  // Tính thứ 2 của tuần hiện tại
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Chào buổi sáng'
  if (hour < 17) return 'Chào buổi chiều'
  return 'Chào buổi tối'
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

  const supabase = createClient()
  const weekDates = getWeekDates(today)

  const handleMarkRead = useCallback(async () => {
    if (todayRead || marking) return
    setMarking(true)

    const { error } = await (supabase.from('reading_streaks') as any).insert({
      user_id: userId,
      date: today,
    })

    if (error && error.code !== '23505') {
      // 23505 = unique violation (đã đọc rồi)
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

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-14 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
            {new Date(today).toLocaleDateString('vi-VN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">✂️</span>
          <span className="text-lg">☀️</span>
          <span className="text-lg">🖼️</span>
          <span className="text-lg">⚙️</span>
        </div>
      </header>

      {/* Greeting & Streak */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-medium text-base">
            {getGreeting()}, {userName}.
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Hãy dành 5 phút tìm kiếm Chúa trước nhé
          </p>
        </div>
        {currentStreak > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--gold)', color: '#000' }}
          >
            <span className="text-xs">🔥</span>
            <span className="text-xs font-bold">{currentStreak} ngày</span>
          </div>
        )}
      </div>

      {/* Week streak tracker */}
      <div className="px-4 pb-6">
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((day, i) => {
            const dateStr = weekDates[i]
            const isRead = readStreaks.includes(dateStr)
            const isPast = dateStr <= today
            const isToday = dateStr === today

            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {day}
                </span>
                <button
                  onClick={isToday && !todayRead ? handleMarkRead : undefined}
                  disabled={marking || !isToday || todayRead}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all"
                  style={{
                    background: isRead
                      ? 'var(--gold)'
                      : isPast
                      ? 'var(--surface-3)'
                      : 'var(--surface-2)',
                    color: isRead ? '#000' : 'var(--text-muted)',
                    border: isToday && !isRead ? '2px solid var(--gold)' : 'none',
                  }}
                >
                  {isRead ? '✓' : ''}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Verse Content */}
      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">
        {verseError && (
          <div
            className="rounded-2xl p-4 text-sm text-red-400"
            style={{ background: 'var(--surface)' }}
          >
            Không thể tải bài học hôm nay. Vui lòng kiểm tra kết nối.
          </div>
        )}

        {!verse && !verseError && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: 'var(--surface)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Chưa có bài học cho hôm nay.
              <br />
              Hãy quay lại sau nhé! 🙏
            </p>
          </div>
        )}

        {verse && (
          <>
            {/* Section 01: Câu gốc */}
            <div
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{ background: 'var(--surface)' }}
            >
              <p
                className="text-[10px] font-semibold tracking-widest uppercase mb-3"
                style={{ color: 'var(--gold)' }}
              >
                01 · Câu gốc
              </p>

              {/* Decorative quote */}
              <span
                className="absolute top-4 right-4 text-6xl leading-none opacity-10 font-serif"
                style={{ color: 'var(--gold)' }}
              >
                &ldquo;
              </span>

              <p className="text-white text-lg font-light leading-relaxed pr-8">
                {verse.verse_text}
              </p>
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--gold)' }}>
                {verse.verse_reference}
              </p>
            </div>

            {/* Section 02: Suy ngẫm */}
            {verse.meditation_text && (
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--surface)' }}
              >
                <p
                  className="text-[10px] font-semibold tracking-widest uppercase mb-3"
                  style={{ color: 'var(--gold)' }}
                >
                  02 · Suy ngẫm
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                  {verse.meditation_text}
                </p>
              </div>
            )}

            {/* Mark as read button (if not yet read today) */}
            {!todayRead && (
              <button
                onClick={handleMarkRead}
                disabled={marking}
                className="w-full py-4 rounded-2xl font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--gold)' }}
              >
                {marking ? 'Đang lưu...' : '🙏 Đã đọc xong hôm nay'}
              </button>
            )}

            {todayRead && (
              <div
                className="w-full py-4 rounded-2xl text-center text-sm font-medium"
                style={{
                  background: 'rgba(201, 168, 76, 0.1)',
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                }}
              >
                ✓ Đã hoàn thành hôm nay!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
