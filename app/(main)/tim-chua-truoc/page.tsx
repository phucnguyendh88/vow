export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DevotionClient from '@/components/devotion/DevotionClient'
import { getTodayLesson, getVietnamDateString } from '@/lib/bible'
import type { DailyVerse } from '@/types/database'

function getVietnamDateInfo() {
  const today = getVietnamDateString()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  const sevenDaysAgoStr = getVietnamDateString(sevenDaysAgo)

  return { today, sevenDaysAgoStr }
}

export default async function TimChuaTruocPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/dang-nhap')

  const { today, sevenDaysAgoStr } = getVietnamDateInfo()
  const initialLesson = getTodayLesson()

  // Chạy đồng thời toàn bộ 4 truy vấn song song để triệt tiêu thời gian chờ
  const [verseResult, streaksResult, totalStreakResult, profileResult] = await Promise.all([
    supabase.from('daily_verses').select('*').eq('date', today).maybeSingle(),
    supabase
      .from('reading_streaks')
      .select('date')
      .eq('user_id', user.id)
      .gte('date', sevenDaysAgoStr)
      .order('date', { ascending: true }),
    supabase
      .from('reading_streaks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('profiles')
      .select('full_name, username, role, is_complete')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const verse = verseResult.data
  const verseError = verseResult.error
  const streaks = (streaksResult.data as Array<{ date: string }> | null) ?? []
  const totalStreak = totalStreakResult.count ?? 0
  const profile = profileResult.data as {
    full_name: string | null
    username: string | null
    role: string | null
    is_complete: boolean | null
  } | null

  // First-time users must finish onboarding before entering the main app
  if (!profile || profile.is_complete !== true || !profile.full_name?.trim()) redirect('/onboarding')

  const todayRead = streaks.some((s) => s.date === today)
  const AnyDevotionClient = DevotionClient as any

  return (
    <AnyDevotionClient
      verse={verse as DailyVerse | null}
      verseError={verseError ? 'Không thể tải bài tĩnh nguyện hôm nay.' : null}
      streaks={streaks.map((s) => s.date)}
      totalStreak={totalStreak}
      todayRead={todayRead}
      userId={user.id}
      userName={profile?.full_name ?? profile?.username ?? 'bạn'}
      today={today}
      isAdmin={profile?.role === 'admin'}
      initialLesson={initialLesson}
    />
  )
}
