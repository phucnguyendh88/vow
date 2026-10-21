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

interface FriendItem {
  conversationId: string
  name: string
  avatarUrl: string | null
}

const DAY_NAMES = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY']
const WEEK_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
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

function getSundayToSaturdayDates(todayStr: string): string[] {
  const d = new Date(todayStr)
  const sunday = new Date(d)
  sunday.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(sunday)
    cur.setDate(sunday.getDate() + i)
    return cur.toISOString().split('T')[0]
  })
}

/* ================== ICONS ================== */

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

function RefreshCwIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BookOpenIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShareSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
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

/* ================== 14 TOPICS ================== */

interface TopicConfig {
  id: string
  title: string
  jsonKey: string
}

const TOPICS: TopicConfig[] = [
  { id: 'lo-lang', title: 'Lo lắng', jsonKey: 'Lo lắng' },
  { id: 'co-don', title: 'Cô đơn', jsonKey: 'Cô đơn' },
  { id: 'that-vong', title: 'Thất vọng', jsonKey: 'Thất vọng' },
  { id: 'mat-phuong-huong', title: 'Mất phương hướng', jsonKey: 'Mất phương hướng' },
  { id: 'tinh-yeu', title: 'Tình yêu & các mối quan hệ', jsonKey: 'Tình yêu / hôn nhân' },
  { id: 'cong-viec', title: 'Công việc', jsonKey: 'Công việc' },
  { id: 'tai-chinh', title: 'Tài chính', jsonKey: 'Tài chính' },
  { id: 'tha-thu', title: 'Tha thứ', jsonKey: 'Tha thứ' },
  { id: 'so-hai', title: 'Sợ hãi', jsonKey: 'Sợ hãi' },
  { id: 'dau-buon', title: 'Đau buồn', jsonKey: 'Đau buồn' },
  { id: 'met-moi', title: 'Mệt mỏi, kiệt sức', jsonKey: 'Mệt mỏi, kiệt sức' },
  { id: 'biet-on', title: 'Biết ơn', jsonKey: 'Biết ơn' },
  { id: 'muon-gan-chua', title: 'Muốn gần Chúa hơn', jsonKey: 'Muốn gần Chúa hơn' },
  { id: 'vui-mung', title: 'Vui mừng vì 1 chuyện gì đó', jsonKey: 'Vui mừng vì chuyện gì đó' },
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
  const [showShareModal, setShowShareModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Friends for in-app sharing
  const [friendList, setFriendList] = useState<FriendItem[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null)

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

  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)

  const [fallbackLesson, setFallbackLesson] = useState<BibleLesson | null>(null)
  const supabase = createClient()
  const now = new Date()
  const headerDateStr = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} THÁNG ${now.getMonth() + 1}`
  const weekDates = getSundayToSaturdayDates(today)
  const currentDayIdx = now.getDay() // 0 = CN, 1 = T2, ..., 6 = T7

  const showToast = (msg: string) => {
    setToastMessage(msg)
    window.setTimeout(() => setToastMessage(null), 2600)
  }

  // Pre-load lessons & data
  useEffect(() => {
    setFallbackLesson(getTodayLesson(new Date()))

    fetch('/VOW%20daily.json')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DailyLessonItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setDailyLessons(data)
        }
      })
      .catch(() => {})

    fetch('/kinh-thanh-hoan-canh.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === 'object') {
          setTopicData(data)
        }
      })
      .catch(() => {})
  }, [])

  // ================== AUDIO BACKGROUND ENGINE ==================
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
        if (musicOnRef.current && audio && !document.hidden) {
          audio.play().catch(() => {})
        }
      } catch {}
    }

    // Auto-play immediately on mount
    tryPlay()

    // Unlock audio on iOS/Android first user touch gesture
    const handleFirstGesture = () => {
      tryPlay()
    }
    window.addEventListener('pointerdown', handleFirstGesture, { once: true })
    window.addEventListener('touchstart', handleFirstGesture, { once: true })

    // Strict audio shutdown: pause immediately on hidden, pagehide, or blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        audio?.pause()
      } else if (musicOnRef.current) {
        audio?.play().catch(() => {})
      }
    }

    const handlePageHide = () => {
      audio?.pause()
    }

    const handleBlur = () => {
      if (document.hidden) {
        audio?.pause()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture)
      window.removeEventListener('touchstart', handleFirstGesture)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('blur', handleBlur)
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
        if (!document.hidden) {
          audio.play().catch(() => undefined)
        }
      } else {
        audio.pause()
      }
    }
  }, [musicOn])

  // ================== BROWSER HISTORY & NATURAL GESTURE BACK ==================
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Whenever user presses back on browser/Android or swipes edge on iOS
      if (!e.state?.vowSubPage) {
        setActiveView('home')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (activeView === 'home') return
    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const deltaX = touchEndX - touchStartXRef.current
    const deltaY = Math.abs(touchEndY - touchStartYRef.current)

    // Edge swipe from left: start near left edge (< 40px) and drag right (> 70px)
    if (touchStartXRef.current < 40 && deltaX > 70 && deltaY < deltaX * 0.8) {
      if (window.history.state?.vowSubPage) {
        window.history.back()
      } else {
        setActiveView('home')
      }
    }
  }

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
    const fl = fallbackLesson
    return {
      cau_goc: fl
        ? `“${fl.loi_kinh_thanh}”\n${fl.sach} ${fl.chuong}:${fl.cau}`
        : (verse?.verse_text || 'Chúa là Đấng chăn giữ tôi, tôi sẽ chẳng thiếu thốn gì.'),
      suy_ngam: fl?.bai_hoc || verse?.meditation_text || 'Hãy dành vài phút để hướng lòng về Chúa hôm nay.',
      thuc_hanh: fl?.loi_cau_nguyen ? `Cầu nguyện: ${fl.loi_cau_nguyen}` : 'Hãy chọn một điều nhỏ để thực hiện với lòng biết ơn.',
    }
  })()

  // Helper for topic articles
  const getTopicArticles = useCallback((topic: TopicConfig): TopicArticle[] => {
    if (!topicData) return []

    if (topicData[topic.jsonKey] && topicData[topic.jsonKey].length > 0) {
      return topicData[topic.jsonKey]
    }

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

    if (topic.id === 'biet-on') {
      const vuiMungList = topicData['Vui mừng vì chuyện gì đó'] || []
      const targetVerses = ['1 Tê-sa-lô-ni-ca 5:16-18', 'Thi thiên 103:2', 'Gia-cơ 1:17', 'Thi thiên 100:1-2', 'Thi thiên 9:1-2', '1 Cô-rinh-tô 4:7', 'Thi thiên 118:24']
      const collected = vuiMungList.filter((art) => targetVerses.some((v) => art.dia_chi.includes(v)))
      if (collected.length > 0) return collected
      return vuiMungList
    }

    return []
  }, [topicData])

  // Select a topic: pick a RANDOM article initially
  const handleSelectTopic = (topic: TopicConfig) => {
    setSelectedTopic(topic)
    const articles = getTopicArticles(topic)
    const initialRandomIdx = articles.length > 0 ? Math.floor(Math.random() * articles.length) : 0
    setTopicArticleIndex(initialRandomIdx)
    window.history.pushState({ vowSubPage: 'mood' }, '')
    setActiveView('topic')
  }

  const currentTopicArticles = selectedTopic ? getTopicArticles(selectedTopic) : []
  const currentTopicArticle = currentTopicArticles.length > 0
    ? currentTopicArticles[topicArticleIndex % currentTopicArticles.length]
    : null

  // Next article button: pick another RANDOM article (different from current)
  const handleNextRandomArticle = () => {
    if (currentTopicArticles.length <= 1) return
    let nextIdx = topicArticleIndex
    while (nextIdx === topicArticleIndex) {
      nextIdx = Math.floor(Math.random() * currentTopicArticles.length)
    }
    setTopicArticleIndex(nextIdx)
  }

  // ================== SHARING HELPERS ==================
  const loadFriendsForSharing = async () => {
    if (friendList.length > 0) return
    setLoadingFriends(true)
    try {
      // 1. Check cached conversations in sessionStorage
      const cached = sessionStorage.getItem('vow_conversations_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const list: FriendItem[] = parsed.map((c: any) => ({
              conversationId: c.conversationId || c.id,
              name: c.partnerName || 'Bạn bè',
              avatarUrl: c.partnerAvatar || null,
            }))
            setFriendList(list)
            setLoadingFriends(false)
            return
          }
        } catch {}
      }

      // 2. Query Supabase conversation members
      const { data: myConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId)

      const cids = (myConvs || []).map((c: any) => c.conversation_id)
      if (cids.length > 0) {
        const { data: others } = await supabase
          .from('conversation_members')
          .select(`
            conversation_id,
            user_id,
            profiles:user_id (
              id,
              full_name,
              username,
              avatar_url
            )
          `)
          .in('conversation_id', cids)
          .neq('user_id', userId)

        if (others && others.length > 0) {
          const uniquePartners = new Map<string, FriendItem>()
          others.forEach((o: any) => {
            const p = o.profiles
            const name = p?.full_name || p?.username || 'Bạn bè'
            const uid = p?.id || o.user_id
            if (!uniquePartners.has(uid)) {
              uniquePartners.set(uid, {
                conversationId: o.conversation_id,
                name,
                avatarUrl: p?.avatar_url || null,
              })
            }
          })
          setFriendList(Array.from(uniquePartners.values()))
        }
      }
    } catch (err) {
      console.error('Error loading friends for sharing:', err)
    } finally {
      setLoadingFriends(false)
    }
  }

  const handleSendToFriend = async (friend: FriendItem) => {
    setSendingFriendId(friend.conversationId)
    const shareText = `"${currentDailyItem.cau_goc.trim()}"\n\nChia sẻ từ VOW`
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: friend.conversationId,
          content: shareText,
          idempotency_key: `share_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }),
      })
      if (res.ok) {
        setShowShareModal(false)
        showToast(`Đã gửi cho ${friend.name}!`)
      } else {
        showToast('Không thể gửi. Vui lòng thử lại.')
      }
    } catch {
      showToast('Lỗi kết nối khi gửi.')
    } finally {
      setSendingFriendId(null)
    }
  }

  const handleShareExternal = async () => {
    const shareText = `"${currentDailyItem.cau_goc.trim()}"\n\nChia sẻ từ VOW`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Lời Chúa hôm nay - VOW',
          text: shareText,
        })
        setShowShareModal(false)
        return
      } catch {}
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(shareText)
      setShowShareModal(false)
      showToast('Đã sao chép câu gốc')
    } catch {
      showToast('Không thể sao chép')
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`fixed inset-0 z-20 flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none pb-[calc(4.75rem+env(safe-area-inset-bottom))] ${
        lightMode ? 'devotion-light bg-[#F8F7F4] text-[#1C1917]' : 'bg-[#050505] text-[#F0F0F0]'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-full border border-[rgba(232,208,141,0.5)] bg-[#E8D08D] px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_25px_rgba(0,0,0,0.5)] transition-all animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* ================== FIXED TOP HEADER (4 ROWS) ================== */}
      <header className="relative shrink-0 border-b border-[rgba(232,208,141,0.12)] px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        {/* Row 1: Logo & 4 Quick Actions */}
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

        {/* Row 2: Date in Gold uppercase & Streak flame pill */}
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

      {/* ================== MAIN CONTENT: TAB HOME ================== */}
      {activeView === 'home' && (
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain nice-scroll touch-pan-y px-4 sm:px-5 py-3.5">
          {/* SECTION A: Title & Description */}
          <section className="mb-3.5">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#FFF4D4] via-[#E8D08D] to-[#C49A45]">
              Hôm nay, lòng bạn thế nào?
            </h2>
            <p className={`mt-0.5 text-xs sm:text-sm font-light italic leading-relaxed ${lightMode ? 'text-neutral-600' : 'text-[#A0A0A5]'}`}>
              “Bạn đang cần điều gì hôm nay?”
            </p>
          </section>

          {/* SECTION B: Lựa chọn 1 (Bắt đầu ngày mới - Chỉ đúng 2 dòng chữ) */}
          <section className="mb-5">
            <button
              type="button"
              onClick={() => {
                window.history.pushState({ vowSubPage: 'daily' }, '')
                setActiveView('daily')
              }}
              className="group relative w-full overflow-hidden rounded-[1.6rem] border border-[rgba(232,208,141,0.45)] bg-gradient-to-br from-[rgba(232,208,141,0.12)] via-[rgba(255,255,255,0.03)] to-[rgba(20,20,24,0.7)] p-4 sm:p-5 text-left backdrop-blur-xl shadow-[0_10px_28px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(232,208,141,0.3)] transition-all duration-200 hover:border-[#E8D08D] active:scale-[0.98]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#E8D08D]/15 blur-xl transition-opacity group-hover:opacity-100" />
              <h3 className={`font-serif text-lg sm:text-xl font-bold tracking-wide ${lightMode ? 'text-neutral-900' : 'text-[#F0F0F0]'}`}>
                Tôi muốn bắt đầu ngày mới
              </h3>
              <p className={`mt-1 text-xs sm:text-sm font-light leading-relaxed ${lightMode ? 'text-neutral-600' : 'text-[#D0D0D5]'}`}>
                Một câu gốc - Một suy gẫm - Một ngày mới
              </p>
            </button>
          </section>

          {/* SECTION C: Lựa chọn 2 (Tâm trạng và hoàn cảnh - 14 Ô nhỏ gọn, không icon) */}
          <section className="mb-4">
            <div className="mb-2.5">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.25)] to-transparent" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#E8D08D]">
                  Tâm trạng và hoàn cảnh
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.25)] to-transparent" />
              </div>
              <h3 className="mt-1.5 font-serif text-base sm:text-lg font-semibold tracking-wide">
                Hay bạn đang trải qua điều gì?
              </h3>
              <p className={`mt-0.5 text-[11px] sm:text-xs font-light ${lightMode ? 'text-neutral-600' : 'text-[#A0A0A5]'}`}>
                Chọn điều gần nhất với tâm trạng hoặc hoàn cảnh của bạn.
              </p>
            </div>

            {/* 14 COMPACT TOPIC BUTTONS: 2 COLUMNS, NO ICONS */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleSelectTopic(topic)}
                  className={`group flex items-center justify-center rounded-xl border px-3 py-2.5 text-center backdrop-blur-md transition-all duration-200 hover:border-[rgba(232,208,141,0.5)] active:scale-[0.98] min-h-[44px] ${
                    lightMode
                      ? 'border-neutral-200 bg-white/80 hover:bg-white shadow-sm'
                      : 'border-[rgba(232,208,141,0.2)] bg-[rgba(255,255,255,0.025)] hover:bg-[rgba(232,208,141,0.08)] shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                  }`}
                >
                  <span className={`font-serif text-xs sm:text-[13px] font-medium leading-snug tracking-wide transition-colors ${
                    lightMode ? 'text-neutral-800 group-hover:text-black' : 'text-[#F0F0F0] group-hover:text-[#E8D08D]'
                  }`}>
                    {topic.title}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* SECTION D: Subtle Closing Quote */}
          <section className="my-5 text-center px-4">
            <div className="mx-auto mb-2.5 h-px w-20 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.4)] to-transparent" />
            <p className={`font-serif text-xs sm:text-[13px] italic leading-relaxed tracking-wide ${
              lightMode ? 'text-neutral-600' : 'text-[#A0A0A5]'
            }`}>
              “Bạn không cần phải ổn mới có thể đến với Chúa. Hãy bắt đầu từ chính nơi bạn đang đứng.”
            </p>
            <div className="mx-auto mt-2.5 h-px w-20 bg-gradient-to-r from-transparent via-[rgba(232,208,141,0.4)] to-transparent" />
          </section>
        </main>
      )}

      {/* ================== READING VIEW 1: BẮT ĐẦU NGÀY MỚI ================== */}
      {activeView === 'daily' && (
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain nice-scroll touch-pan-y px-4 sm:px-5 py-4">
          {/* Card 1: 01 · CÂU GỐC (Font nhỏ hơn, mềm mại hơn + Nút Chia sẻ) */}
          <section className={`relative overflow-hidden rounded-[1.8rem] border p-5 sm:p-6 backdrop-blur-2xl mb-4 ${
            lightMode
              ? 'border-neutral-200 bg-white/95 shadow-md'
              : 'border-[rgba(232,208,141,0.28)] bg-[rgba(255,255,255,0.03)] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(232,208,141,0.2)]'
          }`}>
            <QuoteWatermark className="absolute right-4 top-4 h-16 w-16 text-[#E8D08D] opacity-15 pointer-events-none" />

            <div className="flex items-center justify-between gap-3">
              <p className="font-sans text-[11px] font-bold uppercase tracking-[0.25em] text-[#E8D08D]">
                01 · CÂU GỐC HẰNG NGÀY
              </p>
              <button
                type="button"
                onClick={() => {
                  loadFriendsForSharing()
                  setShowShareModal(true)
                }}
                className="flex items-center gap-1.5 rounded-full border border-[rgba(232,208,141,0.35)] bg-[rgba(232,208,141,0.1)] px-3 py-1 text-xs font-semibold text-[#E8D08D] backdrop-blur transition hover:bg-[rgba(232,208,141,0.2)] active:scale-95 shadow-sm"
              >
                <ShareSvg className="h-3.5 w-3.5 text-[#E8D08D]" />
                <span>Chia sẻ</span>
              </button>
            </div>

            <p className={`mt-3.5 font-serif text-base sm:text-[17px] font-normal italic leading-relaxed tracking-wide whitespace-pre-line ${
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
            <section className={`rounded-[1.8rem] border p-5 sm:p-6 backdrop-blur-2xl mb-4 ${
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

          {/* Mark Read Button (Streak increment) */}
          <div className="mb-5">
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

          {/* Ô TÍCH CHUỖI 7 NGÀY (CHÚA NHẬT ĐẾN THỨ 7: CN, T2, T3, T4, T5, T6, T7) */}
          <div className={`rounded-[1.6rem] border p-4 backdrop-blur-xl mb-4 ${
            lightMode ? 'border-neutral-200 bg-white/90 shadow-sm' : 'border-[rgba(232,208,141,0.22)] bg-[rgba(255,255,255,0.03)] shadow-[0_8px_24px_rgba(0,0,0,0.5)]'
          }`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8D08D]">
                CHUỖI ĐỌC TRONG TUẦN
              </span>
              <span className="text-xs text-[#E8D08D] font-semibold">
                🔥 {currentStreak} ngày
              </span>
            </div>

            <div className="flex items-start justify-between px-1">
              {WEEK_DAYS.map((day, idx) => {
                const dateStr = weekDates[idx]
                const isToday = idx === currentDayIdx
                const isRead = streaks.includes(dateStr) || (isToday && todayRead)

                return (
                  <div key={day} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[11px] font-medium tracking-wide ${
                      isToday ? 'font-bold text-[#E8D08D]' : lightMode ? 'text-neutral-500' : 'text-neutral-400'
                    }`}>
                      {day}
                    </span>

                    {isToday ? (
                      <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF5D6] via-[#E8D08D] to-[#B38C3B] shadow-[0_0_20px_rgba(232,208,141,0.5),inset_0_1px_2px_rgba(255,255,255,0.7)]">
                        <CheckIcon className="h-5 w-5 text-black stroke-[3]" />
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                      </div>
                    ) : isRead ? (
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[#E8D08D] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                        <CheckIcon className="h-5 w-5 text-black stroke-[2.5]" />
                      </div>
                    ) : (
                      <div className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border backdrop-blur-sm ${
                        lightMode ? 'border-neutral-200 bg-neutral-100' : 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)]'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      )}

      {/* ================== READING VIEW 2: CHỌN TÂM TRẠNG ================== */}
      {activeView === 'topic' && selectedTopic && (
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain nice-scroll touch-pan-y px-4 sm:px-5 py-4">
          {currentTopicArticle ? (
            <div className={`relative overflow-hidden rounded-[1.8rem] border p-5 sm:p-6 backdrop-blur-2xl mb-4 ${
              lightMode
                ? 'border-neutral-200 bg-white/95 shadow-md'
                : 'border-[rgba(232,208,141,0.28)] bg-[rgba(255,255,255,0.03)] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(232,208,141,0.2)]'
            }`}>
              <QuoteWatermark className="absolute right-4 top-4 h-16 w-16 text-[#E8D08D] opacity-15 pointer-events-none" />

              {/* Bible Address Header with Cuốn Kinh Thánh (BookOpenIcon) */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(232,208,141,0.35)] bg-[rgba(232,208,141,0.1)] text-[#E8D08D] shadow-sm">
                  <BookOpenIcon className="h-4 w-4 text-[#E8D08D]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8D08D]">
                    {selectedTopic.title}
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-wide text-[#E8D08D]">
                    {currentTopicArticle.dia_chi}
                  </h3>
                </div>
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

              {/* Nút Đổi bài suy ngẫm khác (Random bài khác, không số thứ tự) */}
              <div className="mt-6 pt-4 border-t border-[rgba(232,208,141,0.15)]">
                <button
                  type="button"
                  onClick={handleNextRandomArticle}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#E8D08D] bg-[#E8D08D] py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(232,208,141,0.25)] transition active:scale-95"
                >
                  <RefreshCwIcon className="h-4 w-4" />
                  <span>Đổi bài suy ngẫm khác</span>
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

      {/* ================== SHARE MODAL / MENU ================== */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] border p-5 backdrop-blur-2xl shadow-2xl transition-all ${
              lightMode ? 'border-neutral-200 bg-white text-black' : 'border-[rgba(232,208,141,0.35)] bg-[#121214] text-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(232,208,141,0.15)]">
              <div className="flex items-center gap-2">
                <ShareSvg className="h-4 w-4 text-[#E8D08D]" />
                <h3 className="font-serif text-lg font-bold tracking-wide">Chia sẻ câu gốc</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Preview text */}
            <div className="my-3 rounded-xl border border-[rgba(232,208,141,0.2)] bg-black/20 p-3 text-xs italic text-[#D8D8DC] line-clamp-3">
              &quot;{currentDailyItem.cau_goc}&quot;
            </div>

            {/* Option 1: Send to friends in chat */}
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#E8D08D] mb-2">
                Gửi trong tin nhắn Bạn bè
              </p>
              {loadingFriends ? (
                <div className="py-4 text-center text-xs text-neutral-400">Đang tìm bạn bè...</div>
              ) : friendList.length > 0 ? (
                <div className="max-h-44 overflow-y-auto space-y-1.5 nice-scroll">
                  {friendList.map((f) => (
                    <button
                      key={f.conversationId}
                      type="button"
                      disabled={sendingFriendId === f.conversationId}
                      onClick={() => handleSendToFriend(f)}
                      className="flex w-full items-center justify-between rounded-xl p-2 hover:bg-white/5 active:scale-95 transition"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {f.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-[#E8D08D]/20 text-[#E8D08D] flex items-center justify-center text-xs font-bold shrink-0">
                            {f.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-medium truncate">{f.name}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#E8D08D] px-2.5 py-1 rounded-full bg-[#E8D08D]/10 border border-[#E8D08D]/30 shrink-0">
                        {sendingFriendId === f.conversationId ? 'Đang gửi...' : 'Gửi'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic py-2">
                  Chưa có cuộc trò chuyện nào để gửi trực tiếp.
                </p>
              )}
            </div>

            {/* Option 2: Share externally */}
            <div className="pt-2 border-t border-[rgba(232,208,141,0.15)]">
              <button
                type="button"
                onClick={handleShareExternal}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-[#E8D08D] bg-[#E8D08D] py-2.5 text-xs font-semibold text-black shadow-md transition active:scale-95"
              >
                <ShareSvg className="h-3.5 w-3.5 text-black" />
                <span>Chia sẻ ra ngoài (Zalo, Messenger hoặc Sao chép)</span>
              </button>
            </div>
          </div>
        </div>
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
