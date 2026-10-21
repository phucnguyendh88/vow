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

interface DailyLessonItem {
  cau_goc: string
  suy_ngam: string
  thuc_hanh: string
}

interface TopicArticle {
  dia_chi: string
  noi_dung: string
}

const DAY_NAMES = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY']
const MUSIC_STORAGE_KEY = 'fc_music_on'

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 11) return 'buổi sáng'
  if (hour >= 11 && hour < 14) return 'buổi trưa'
  if (hour >= 14 && hour < 18) return 'buổi chiều'
  return 'buổi tối'
}

function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/* ================== SVGS (HEADER & UTILITIES) ================== */

function FlameIcon({ className = 'h-4 w-4' }: { className?: string }) {
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

function MusicOnIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function MusicOffIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="m2 2 20 20" strokeLinecap="round" />
    </svg>
  )
}

function SunIcon({ className = 'h-4 w-4' }: { className?: string }) {
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

function MoonIcon({ className = 'h-4 w-4' }: { className?: string }) {
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

function PictureIcon({ className = 'h-4 w-4' }: { className?: string }) {
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

function GearIcon({ className = 'h-4 w-4' }: { className?: string }) {
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

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BackArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RefreshCwIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SunRiseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 2v4M4.93 10.93l2.83-2.83M19.07 10.93l-2.83-2.83M2 18h20M20 18a8 8 0 1 0-16 0" strokeLinecap="round" strokeLinejoin="round" />
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

/* ================== 14 LINE-ART ICONS (LUCIDE STYLE) ================== */

function WindSwirlIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 1. Lo lắng
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.5 4.2A2 2 0 1 1 11 7.7H2M16 16.2a2 2 0 1 0-1.5 3.3H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SolitaryBirdIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 2. Cô đơn
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M3 13c3.5-3 6.5-3 9 0 2.5-3 5.5-3 9 0M7 8c2.5-2 4.5-2 6 0 1.5-2 3.5-2 6 0" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="18" r="1.5" />
    </svg>
  )
}

function FallingDropIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 3. Thất vọng
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 11v4M12 19h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CompassGuideIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 4. Mất phương hướng
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function IntertwinedHeartsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 5. Tình yêu & các mối quan hệ
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M19.5 12.572l-7.5 7.428-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.572" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SproutWorkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 6. Công việc
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M7 20h10M12 20v-8M12 12c0-3.5 2.5-6 6-6-1 3-3.5 6-6 6zM12 14c0-3-2-5-5-5 1 2.5 3 5 5 5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ScalesCoinIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 7. Tài chính
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM7 21h10M12 3v18M3 7h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ReleasingDoveIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 8. Tha thứ
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m14 13 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShieldAnchorIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 9. Sợ hãi
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CandleTearIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 10. Đau buồn
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M9 21h6M12 17v4M8 17h8a2 2 0 0 0 2-2V9H6v6a2 2 0 0 0 2 2zM12 2c-1.5 1.5-2 3-2 4a2 2 0 0 0 4 0c0-1-.5-2.5-2-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrescentMoonRestIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 11. Mệt mỏi, kiệt sức
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.5 5.5 0 0 1-7.54-7.54C12.92 3.04 12.46 3 12 3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 3v4M21 5h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PrayingHandsFlowerIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 12. Biết ơn
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.34 6.34l2.83 2.83M14.83 14.83l2.83 2.83M6.34 17.66l2.83-2.83M14.83 9.17l2.83-2.83" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function CrossLightIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 13. Muốn gần Chúa hơn
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 2v20M7 8h10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 4 2 2M20 4l-2 2M4 20l2-2M20 20l-2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SunburstJoyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  // 14. Vui mừng vì 1 chuyện gì đó
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ================== 14 TOPICS CONFIG ================== */

interface TopicConfig {
  id: string
  title: string
  jsonKey: string
  icon: React.ComponentType<{ className?: string }>
}

const TOPICS: TopicConfig[] = [
  { id: 'lo-lang', title: 'Lo lắng', jsonKey: 'Lo lắng', icon: WindSwirlIcon },
  { id: 'co-don', title: 'Cô đơn', jsonKey: 'Cô đơn', icon: SolitaryBirdIcon },
  { id: 'that-vong', title: 'Thất vọng', jsonKey: 'Thất vọng', icon: FallingDropIcon },
  { id: 'mat-phuong-huong', title: 'Mất phương hướng', jsonKey: 'Mất phương hướng', icon: CompassGuideIcon },
  { id: 'tinh-yeu', title: 'Tình yêu & các mối quan hệ', jsonKey: 'Tình yêu / hôn nhân', icon: IntertwinedHeartsIcon },
  { id: 'cong-viec', title: 'Công việc', jsonKey: 'Công việc', icon: SproutWorkIcon },
  { id: 'tai-chinh', title: 'Tài chính', jsonKey: 'Tài chính', icon: ScalesCoinIcon },
  { id: 'tha-thu', title: 'Tha thứ', jsonKey: 'Tha thứ', icon: ReleasingDoveIcon },
  { id: 'so-hai', title: 'Sợ hãi', jsonKey: 'Sợ hãi', icon: ShieldAnchorIcon },
  { id: 'dau-buon', title: 'Đau buồn', jsonKey: 'Đau buồn', icon: CandleTearIcon },
  { id: 'met-moi', title: 'Mệt mỏi, kiệt sức', jsonKey: 'Mệt mỏi, kiệt sức', icon: CrescentMoonRestIcon },
  { id: 'biet-on', title: 'Biết ơn', jsonKey: 'Biết ơn', icon: PrayingHandsFlowerIcon },
  { id: 'muon-gan-chua', title: 'Muốn gần Chúa hơn', jsonKey: 'Muốn gần Chúa hơn', icon: CrossLightIcon },
  { id: 'vui-mung', title: 'Vui mừng vì 1 chuyện gì đó', jsonKey: 'Vui mừng vì chuyện gì đó', icon: SunburstJoyIcon },
]

/* ================== COMPONENT ================== */

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
  // Navigation View State: 'home' = selection page, 'daily' = daily lesson, 'topic' = context reflection
  const [activeView, setActiveView] = useState<'home' | 'daily' | 'topic'>('home')
  const [selectedTopic, setSelectedTopic] = useState<TopicConfig | null>(null)
  const [topicArticleIndex, setTopicArticleIndex] = useState(0)

  // Data states
  const [dailyLessons, setDailyLessons] = useState<DailyLessonItem[]>([])
  const [topicData, setTopicData] = useState<Record<string, TopicArticle[]> | null>(null)

  // Streak & read state
  const [todayRead, setTodayRead] = useState(initialTodayRead)
  const [currentStreak, setCurrentStreak] = useState(totalStreak)

  // Modals & settings
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Music state
  const [musicOn, setMusicOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = localStorage.getItem(MUSIC_STORAGE_KEY)
      return saved === null || saved === '1'
    } catch {
      return true
    }
  })

  // Theme mode
  const [lightMode, setLightMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return (
        localStorage.getItem('vow_theme') === 'light' ||
        localStorage.getItem('vow_devotion_light') === '1'
      )
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
  const headerDateStr = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} THÁNG ${now.getMonth() + 1}`

  // Pre-load lessons & data
  useEffect(() => {
    setFallbackLesson(getTodayLesson(new Date()))

    // Fetch VOW daily.json
    fetch('/VOW%20daily.json')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DailyLessonItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setDailyLessons(data)
        }
      })
      .catch(() => {})

    // Fetch kinh-thanh-hoan-canh.json
    fetch('/kinh-thanh-hoan-canh.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === 'object') {
          setTopicData(data)
        }
      })
      .catch(() => {})
  }, [])

  // Audio background player
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return
    let audio: HTMLAudioElement | null = null
    try {
      audio = new Audio('/audio-bg.m4a')
      audio.loop = true
      audio.preload = 'auto'
      audioRef.current = audio
    } catch {
      return
    }

    const tryPlay = () => {
      try {
        if (musicOnRef.current && audio) {
          audio.play().catch(() => {})
        }
      } catch {}
    }
    tryPlay()

    const handleFirstInteraction = () => tryPlay()
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction)
      try {
        audio?.pause()
      } catch {}
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

  // Sync theme changes
  useEffect(() => {
    try {
      const isLight =
        localStorage.getItem('vow_theme') === 'light' ||
        localStorage.getItem('vow_devotion_light') === '1'
      setLightMode(isLight)
      if (typeof document !== 'undefined') {
        if (isLight) {
          document.documentElement.classList.remove('dark')
          document.documentElement.classList.add('devotion-light')
        } else {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('devotion-light')
        }
      }
    } catch {}
  }, [])

  const toggleLightMode = () => {
    setLightMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('vow_devotion_light', next ? '1' : '0')
        localStorage.setItem('vow_theme', next ? 'light' : 'dark')
        if (typeof document !== 'undefined') {
          if (next) {
            document.documentElement.classList.remove('dark')
            document.documentElement.classList.add('devotion-light')
          } else {
            document.documentElement.classList.add('dark')
            document.documentElement.classList.remove('devotion-light')
          }
        }
      } catch {}
      return next
    })
  }

  // Handle Mark Read / Streak increment
  const handleMarkRead = useCallback(async () => {
    if (todayRead) return
    setTodayRead(true)
    setCurrentStreak((prev) => prev + 1)

    try {
      await (supabase.from('reading_streaks') as any).insert({
        user_id: userId,
        date: today,
      })
    } catch {}
  }, [todayRead, supabase, userId, today])

  // Get current daily lesson
  const currentDailyItem: DailyLessonItem = (() => {
    if (dailyLessons.length > 0) {
      const dayIndex = getDayOfYear(now)
      const idx = Math.abs(dayIndex) % dailyLessons.length
      return dailyLessons[idx]
    }
    // Fallback if JSON not yet loaded
    const fl = fallbackLesson
    return {
      cau_goc: fl ? `“${fl.loi_kinh_thanh}”\n${fl.sach} ${fl.chuong}:${fl.cau}` : (verse?.verse_text || 'Chúa là Đấng chăn giữ tôi, tôi sẽ chẳng thiếu thốn gì.'),
      suy_ngam: fl?.bai_hoc || verse?.meditation_text || 'Hãy dành vài phút để hướng lòng về Chúa hôm nay.',
      thuc_hanh: fl?.loi_cau_nguyen ? `Cầu nguyện: ${fl.loi_cau_nguyen}` : 'Hãy chọn một điều nhỏ để thực hiện với lòng biết ơn.',
    }
  })()

  // Get articles for chosen topic
  const getTopicArticles = useCallback((topic: TopicConfig): TopicArticle[] => {
    if (!topicData) return []

    // Direct key lookup
    if (topicData[topic.jsonKey] && topicData[topic.jsonKey].length > 0) {
      return topicData[topic.jsonKey]
    }

    // Special Topic 11: Mệt mỏi, kiệt sức (aggregate rest/renewal verses from JSON)
    if (topic.id === 'met-moi') {
      const targetVerses = ['Ma-thi-ơ 11:28', 'Ê-sai 40:31', 'Thi thiên 23:2-3', 'Thi thiên 127:2', 'Thi thiên 62:1', 'Thi thiên 55:22']
      const collected: TopicArticle[] = []
      Object.values(topicData).forEach((list) => {
        list.forEach((art) => {
          if (targetVerses.some((v) => art.dia_chi.includes(v)) && !collected.some((c) => c.dia_chi === art.dia_chi)) {
            collected.push(art)
          }
        })
      })
      if (collected.length > 0) return collected
      return topicData['Lo lắng'] || []
    }

    // Special Topic 12: Biết ơn (aggregate thanksgiving verses from "Vui mừng vì chuyện gì đó")
    if (topic.id === 'biet-on') {
      const vuiMungList = topicData['Vui mừng vì chuyện gì đó'] || []
      const targetVerses = ['1 Tê-sa-lô-ni-ca 5:16-18', 'Thi thiên 103:2', 'Gia-cơ 1:17', 'Thi thiên 100:1-2', 'Thi thiên 9:1-2', '1 Cô-rinh-tô 4:7', 'Thi thiên 118:24']
      const collected = vuiMungList.filter((art) => targetVerses.some((v) => art.dia_chi.includes(v)))
      if (collected.length > 0) return collected
      return vuiMungList
    }

    return []
  }, [topicData])

  const handleSelectTopic = (topic: TopicConfig) => {
    setSelectedTopic(topic)
    setTopicArticleIndex(0)
    setActiveView('topic')
  }

  const currentTopicArticles = selectedTopic ? getTopicArticles(selectedTopic) : []
  const currentTopicArticle = currentTopicArticles.length > 0
    ? currentTopicArticles[topicArticleIndex % currentTopicArticles.length]
    : null

  const handleNextArticle = () => {
    if (currentTopicArticles.length > 0) {
      setTopicArticleIndex((prev) => (prev + 1) % currentTopicArticles.length)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-20 flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none pb-[calc(4.75rem+env(safe-area-inset-bottom))] ${
        lightMode ? 'devotion-light bg-[#F8F7F4] text-[#1C1917]' : 'bg-[#050505] text-[#F0F0F0]'
      }`}
    >
      {/* ================== FIXED TOP HEADER (4 ROWS) ================== */}
      <header className="relative shrink-0 border-b border-[rgba(232,208,141,0.12)] px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        {/* Row 1: 4 Quick Actions (Right aligned) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#FFF2CC] via-[#E8D08D] to-[#B38C3B]">
              VOW
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Music Toggle */}
            <button
              type="button"
              onClick={() => setMusicOn((prev) => !prev)}
              aria-label={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              title={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
                lightMode
                  ? 'border-neutral-200 bg-white text-neutral-800 shadow-sm'
                  : 'border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.03)] text-[#F0F0F0] shadow-[0_4px_12px_rgba(0,0,0,0.5)]'
              }`}
            >
              {musicOn ? (
                <MusicOnIcon className="h-4 w-4 text-[#E8D08D]" />
              ) : (
                <MusicOffIcon className={`h-4 w-4 ${lightMode ? 'text-neutral-500' : 'text-neutral-400'}`} />
              )}
            </button>

            {/* Dark / Light Toggle */}
            <button
              type="button"
              onClick={toggleLightMode}
              aria-label={lightMode ? 'Chế độ tối' : 'Chế độ sáng'}
              title={lightMode ? 'Chế độ tối' : 'Chế độ sáng'}
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
                lightMode
                  ? 'border-neutral-200 bg-white text-neutral-800 shadow-sm'
                  : 'border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.03)] text-[#F0F0F0] shadow-[0_4px_12px_rgba(0,0,0,0.5)]'
              }`}
            >
              {lightMode ? (
                <MoonIcon className="h-4 w-4 text-[#E8D08D]" />
              ) : (
                <SunIcon className={`h-4 w-4 ${lightMode ? 'text-neutral-500' : 'text-neutral-400'}`} />
              )}
            </button>

            {/* Wallpaper Modal Button */}
            <button
              type="button"
              onClick={() => setShowWallpaperModal(true)}
              aria-label="Tạo hình nền"
              title="Tạo hình nền"
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
                lightMode
                  ? 'border-neutral-200 bg-white text-neutral-800 shadow-sm'
                  : 'border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.03)] text-[#F0F0F0] shadow-[0_4px_12px_rgba(0,0,0,0.5)]'
              }`}
            >
              <PictureIcon className={`h-4 w-4 ${lightMode ? 'text-neutral-600' : 'text-neutral-300'}`} />
            </button>

            {/* Settings Modal Button */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Cài đặt"
              title="Cài đặt"
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
                lightMode
                  ? 'border-neutral-200 bg-white text-neutral-800 shadow-sm'
                  : 'border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.03)] text-[#F0F0F0] shadow-[0_4px_12px_rgba(0,0,0,0.5)]'
              }`}
            >
              <GearIcon className="h-4 w-4 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Row 2: Date in Gold uppercase (Left) & Streak flame pill (Right) */}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-[#E8D08D]">
            {headerDateStr}
          </p>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(232,208,141,0.35)] bg-[rgba(232,208,141,0.12)] px-3 py-1 shadow-[0_0_12px_rgba(232,208,141,0.25)] backdrop-blur-md">
            <FlameIcon className="h-3.5 w-3.5 text-[#E8D08D]" />
            <span className="whitespace-nowrap text-xs font-semibold text-[#E8D08D] tracking-wide">
              {currentStreak} ngày
            </span>
          </div>
        </div>

        {/* Row 3: Personalized Greeting by time of day */}
        <div className="mt-1">
          <h1 className="font-serif text-lg sm:text-xl font-medium leading-snug tracking-normal truncate">
            Chào {getGreeting(now.getHours())}
            {userName ? `, ${userName}.` : '.'}
          </h1>
        </div>

        {/* Row 4: Fixed Motto */}
        <div className="mt-0.5">
          <p className={`text-xs font-light leading-relaxed tracking-wide ${lightMode ? 'text-neutral-600' : 'text-[#A0A0A5]'}`}>
            Tìm kiếm Chúa trước hết, mọi điều khác Ngài sẽ ban thêm.
          </p>
        </div>
      </header>

      {/* ================== MAIN CONTENT AREA ================== */}
      {activeView === 'home' && (
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain nice-scroll touch-pan-y px-4 sm:px-5 py-4">
          {/* SECTION A: Title & Description */}
          <section className="mb-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#FFF4D4] via-[#E8D08D] to-[#C49A45]">
              Hôm nay, lòng bạn thế nào?
            </h2>
            <p className={`mt-1 text-xs sm:text-sm font-light italic leading-relaxed ${lightMode ? 'text-neutral-600' : 'text-[#A0A0A5]'}`}>
              “Dành một chút thời gian cho tâm hồn. Bạn đang cần điều gì hôm nay?”
            </p>
          </section>

          {/* SECTION B: Lựa chọn 1 (Hero Card - Bắt đầu ngày mới) */}
          <section className="mb-6">
            <button
              type="button"
              onClick={() => setActiveView('daily')}
              className="group relative w-full overflow-hidden rounded-[1.8rem] border border-[rgba(232,208,141,0.45)] bg-gradient-to-br from-[rgba(232,208,141,0.14)] via-[rgba(255,255,255,0.03)] to-[rgba(20,20,24,0.7)] p-4 sm:p-5 text-left backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(232,208,141,0.3)] transition-all duration-200 hover:border-[#E8D08D] hover:shadow-[0_12px_40px_rgba(232,208,141,0.25)] active:scale-[0.98]"
            >
              {/* Subtle ambient golden light blur */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[#E8D08D]/20 blur-2xl transition-opacity group-hover:opacity-100" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(232,208,141,0.5)] bg-gradient-to-br from-[#FFF2CC] via-[#E8D08D] to-[#B38C3B] shadow-[0_0_16px_rgba(232,208,141,0.35)]">
                    <SunRiseIcon className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8D08D]">
                      LỰA CHỌN ĐẶC BIỆT
                    </span>
                    <h3 className={`font-serif text-lg sm:text-xl font-bold tracking-wide ${lightMode ? 'text-neutral-900' : 'text-[#F0F0F0]'}`}>
                      Tôi muốn bắt đầu ngày mới
                    </h3>
                  </div>
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(232,208,141,0.3)] bg-white/5 text-[#E8D08D] transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRightIcon className="h-4 w-4" />
                </div>
              </div>

              <p className={`mt-2.5 text-xs sm:text-sm font-light leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-[#D0D0D5]'}`}>
                “Một câu Kinh Thánh để lòng được tươi mới và vững vàng bước vào ngày hôm nay.”
              </p>
            </button>
          </section>

          {/* SECTION C: Lựa chọn 2 (14 Chủ đề tâm trạng & hoàn cảnh - Lưới 2 cột) */}
          <section className="mb-4">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.25)] to-transparent" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#E8D08D]">
                  TÂM TRẠNG & HOÀN CẢNH
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.25)] to-transparent" />
              </div>
              <h3 className="mt-2 font-serif text-lg sm:text-xl font-semibold tracking-wide">
                Hay hôm nay, bạn đang trải qua điều gì?
              </h3>
              <p className={`mt-0.5 text-xs font-light ${lightMode ? 'text-neutral-600' : 'text-[#A0A0A5]'}`}>
                Chọn điều gần nhất với tâm trạng hoặc hoàn cảnh của bạn.
              </p>
            </div>

            {/* 14 TOPIC CARDS: 2 COLUMNS */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {TOPICS.map((topic) => {
                const TopicIcon = topic.icon
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleSelectTopic(topic)}
                    className={`group flex flex-col justify-between rounded-2xl border p-3.5 text-left backdrop-blur-md transition-all duration-200 hover:border-[rgba(232,208,141,0.5)] active:scale-[0.98] min-h-[96px] ${
                      lightMode
                        ? 'border-neutral-200 bg-white/80 hover:bg-white shadow-sm'
                        : 'border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.025)] hover:bg-[rgba(232,208,141,0.06)] shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(232,208,141,0.3)] bg-[rgba(232,208,141,0.08)] text-[#E8D08D] transition-transform duration-200 group-hover:scale-110">
                        <TopicIcon className="h-4 w-4" />
                      </div>
                      <ArrowRightIcon className="h-3 w-3 text-[#E8D08D]/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#E8D08D]" />
                    </div>

                    <div className="mt-2.5">
                      <h4 className={`font-serif text-[13.5px] sm:text-[14.5px] font-semibold leading-snug tracking-wide transition-colors ${
                        lightMode ? 'text-neutral-800 group-hover:text-black' : 'text-[#F0F0F0] group-hover:text-[#E8D08D]'
                      }`}>
                        {topic.title}
                      </h4>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* SECTION D: Subtle Closing Quote */}
          <section className="my-6 text-center px-4">
            <div className="mx-auto mb-3 h-px w-20 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.4)] to-transparent" />
            <p className={`font-serif text-xs sm:text-[13px] italic leading-relaxed tracking-wide ${
              lightMode ? 'text-neutral-600' : 'text-[#A0A0A5]'
            }`}>
              “Bạn không cần phải ổn mới có thể đến với Chúa. Hãy bắt đầu từ chính nơi bạn đang đứng.”
            </p>
            <div className="mx-auto mt-3 h-px w-20 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.4)] to-transparent" />
          </section>
        </main>
      )}

      {/* ================== READING VIEW 1: DAILY BIBLE LESSON ================== */}
      {activeView === 'daily' && (
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain nice-scroll touch-pan-y px-4 sm:px-5 py-4">
          {/* Subheader Navigation */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition active:scale-95 ${
                lightMode
                  ? 'border-neutral-200 bg-white text-neutral-800'
                  : 'border-[rgba(232,208,141,0.3)] bg-white/5 text-[#E8D08D]'
              }`}
            >
              <BackArrowIcon className="h-3.5 w-3.5" />
              <span>Quay lại</span>
            </button>

            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8D08D]">
              BẮT ĐẦU NGÀY MỚI
            </span>
          </div>

          {/* Card 1: 01 · CÂU GỐC */}
          <section className={`relative overflow-hidden rounded-[1.8rem] border p-5 sm:p-6 backdrop-blur-2xl mb-4 ${
            lightMode
              ? 'border-neutral-200 bg-white/95 shadow-md'
              : 'border-[rgba(232,208,141,0.28)] bg-[rgba(255,255,255,0.03)] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(232,208,141,0.2)]'
          }`}>
            <QuoteWatermark className="absolute right-4 top-4 h-16 w-16 text-[#E8D08D] opacity-15 pointer-events-none" />
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.25em] text-[#E8D08D]">
              01 · CÂU GỐC HẰNG NGÀY
            </p>
            <p className={`mt-3.5 font-serif text-[1.25rem] sm:text-[1.35rem] font-medium leading-relaxed tracking-wide whitespace-pre-line ${
              lightMode ? 'text-neutral-900' : 'text-[#F0F0F0]'
            }`}>
              {currentDailyItem.cau_goc}
            </p>
          </section>

          {/* Card 2: 02 · SUY NGẪM */}
          <section className={`rounded-[1.8rem] border p-5 sm:p-6 backdrop-blur-2xl mb-4 ${
            lightMode
              ? 'border-neutral-200 bg-white/95 shadow-md'
              : 'border-[rgba(232,208,141,0.28)] bg-[rgba(255,255,255,0.03)] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(232,208,141,0.2)]'
          }`}>
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.25em] text-[#E8D08D]">
              02 · SUY NGẪM
            </p>
            <p className={`mt-3 text-[14px] sm:text-[15px] font-light leading-relaxed whitespace-pre-line ${
              lightMode ? 'text-neutral-800' : 'text-[#D8D8DC]'
            }`}>
              {currentDailyItem.suy_ngam}
            </p>
          </section>

          {/* Card 3: 03 · THỰC HÀNH */}
          {currentDailyItem.thuc_hanh && (
            <section className={`rounded-[1.8rem] border p-5 sm:p-6 backdrop-blur-2xl mb-5 ${
              lightMode
                ? 'border-neutral-200 bg-white/95 shadow-md'
                : 'border-[rgba(232,208,141,0.28)] bg-[rgba(255,255,255,0.03)] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(232,208,141,0.2)]'
            }`}>
              <p className="font-sans text-[11px] font-bold uppercase tracking-[0.25em] text-[#E8D08D]">
                03 · THỰC HÀNH HÔM NAY
              </p>
              <p className={`mt-3 font-serif text-[15px] italic leading-relaxed whitespace-pre-line ${
                lightMode ? 'text-neutral-800' : 'text-[#D8D8DC]'
              }`}>
                {currentDailyItem.thuc_hanh}
              </p>
            </section>
          )}

          {/* Mark Read Button (Streak Increment) */}
          <div className="mb-4">
            <button
              type="button"
              onClick={handleMarkRead}
              disabled={todayRead}
              className={`flex w-full items-center justify-center gap-2 rounded-full border py-3 text-sm font-semibold tracking-wide transition-all ${
                todayRead
                  ? 'border-[rgba(232,208,141,0.35)] bg-[rgba(232,208,141,0.12)] text-[#E8D08D] shadow-[0_0_15px_rgba(232,208,141,0.2)]'
                  : 'border-[#E8D08D] bg-[#E8D08D] text-black shadow-[0_0_20px_rgba(232,208,141,0.3)] active:scale-95'
              }`}
            >
              {todayRead && <CheckIcon className="h-4 w-4 text-[#E8D08D]" />}
              <span>{todayRead ? 'Đã hoàn thành hôm nay' : 'Đánh dấu đã đọc'}</span>
            </button>
          </div>

          <div className="pb-4 text-center">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="text-xs text-[#E8D08D] underline underline-offset-4 hover:opacity-80 transition"
            >
              ← Quay lại Khoảng lặng hôm nay
            </button>
          </div>
        </main>
      )}

      {/* ================== READING VIEW 2: TOPIC REFLECTION ================== */}
      {activeView === 'topic' && selectedTopic && (
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain nice-scroll touch-pan-y px-4 sm:px-5 py-4">
          {/* Subheader Navigation */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition active:scale-95 ${
                lightMode
                  ? 'border-neutral-200 bg-white text-neutral-800'
                  : 'border-[rgba(232,208,141,0.3)] bg-white/5 text-[#E8D08D]'
              }`}
            >
              <BackArrowIcon className="h-3.5 w-3.5" />
              <span>Chọn lại tâm trạng</span>
            </button>

            <div className="flex items-center gap-1.5 rounded-full border border-[rgba(232,208,141,0.3)] bg-[rgba(232,208,141,0.08)] px-3 py-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8D08D]">
                {selectedTopic.title}
              </span>
            </div>
          </div>

          {currentTopicArticle ? (
            <div className={`relative overflow-hidden rounded-[1.8rem] border p-5 sm:p-6 backdrop-blur-2xl mb-5 ${
              lightMode
                ? 'border-neutral-200 bg-white/95 shadow-md'
                : 'border-[rgba(232,208,141,0.28)] bg-[rgba(255,255,255,0.03)] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(232,208,141,0.2)]'
            }`}>
              <QuoteWatermark className="absolute right-4 top-4 h-16 w-16 text-[#E8D08D] opacity-15 pointer-events-none" />

              {/* Bible Address */}
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(232,208,141,0.3)] bg-[rgba(232,208,141,0.1)] text-[#E8D08D]">
                  <selectedTopic.icon className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-wide text-[#E8D08D]">
                  {currentTopicArticle.dia_chi}
                </h3>
              </div>

              {/* Article Content */}
              <div className="mt-4 space-y-3">
                {currentTopicArticle.noi_dung.split('\n\n').map((paragraph, pIdx) => {
                  const isQuote = paragraph.trim().startsWith('"') || paragraph.trim().startsWith('“')
                  const isPrayer = paragraph.toLowerCase().includes('chúa ơi') || paragraph.toLowerCase().includes('cha ơi')
                  return (
                    <p
                      key={pIdx}
                      className={`text-[14px] sm:text-[15px] leading-relaxed ${
                        isQuote
                          ? 'font-serif text-[15px] sm:text-[16px] italic text-[#E8D08D] pl-3 border-l-2 border-[#E8D08D]/40'
                          : isPrayer
                          ? 'font-serif italic ' + (lightMode ? 'text-neutral-900 font-medium' : 'text-[#F0F0F0] font-medium')
                          : lightMode
                          ? 'text-neutral-800 font-light'
                          : 'text-[#D8D8DC] font-light'
                      }`}
                    >
                      {paragraph}
                    </p>
                  )
                })}
              </div>

              {/* Action Buttons: Next article / Change topic */}
              <div className="mt-6 pt-4 border-t border-[rgba(232,208,141,0.15)] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleNextArticle}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#E8D08D] bg-[#E8D08D] py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(232,208,141,0.25)] transition active:scale-95"
                >
                  <RefreshCwIcon className="h-4 w-4" />
                  <span>
                    Đổi bài suy ngẫm khác
                    {currentTopicArticles.length > 1
                      ? ` (${(topicArticleIndex % currentTopicArticles.length) + 1}/${currentTopicArticles.length})`
                      : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  className={`flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-xs font-medium transition active:scale-95 ${
                    lightMode
                      ? 'border-neutral-200 bg-neutral-100 text-neutral-700'
                      : 'border-[rgba(232,208,141,0.25)] bg-white/5 text-[#D8D8DC]'
                  }`}
                >
                  <BackArrowIcon className="h-3.5 w-3.5" />
                  <span>Chọn lại tâm trạng khác</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[1.8rem] border border-[rgba(232,208,141,0.2)] bg-white/5 p-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(232,208,141,0.2)] border-t-[#E8D08D]" />
              <p className="mt-3 text-xs text-[#A0A0A5]">Đang mở bài suy ngẫm...</p>
            </div>
          )}
        </main>
      )}

      {/* ================== MODALS ================== */}
      {showWallpaperModal && <WallpaperModal onClose={() => setShowWallpaperModal(false)} />}
      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isAdmin={isAdmin}
      />
    </div>
  )
}
