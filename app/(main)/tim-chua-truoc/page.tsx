export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DevotionClient from '@/components/devotion/DevotionClient'
import type { DailyVerse } from '@/types/database'

export default async function TimChuaTruocPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/dang-nhap')

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  // Chạy đồng thời toàn bộ 4 truy vấn song song để triệt tiêu thời gian chờ
  const [verseResult, streaksResult, totalStreakResult, profileResult] = await Promise.all([
    supabase.from('daily_verses').select('*').eq('date', today).single(),
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
      .single(),
  ])

  const verse = verseResult.data
  const verseError = verseResult.error
  const streaks = (streaksResult.data as Array<{ date: string }> | null) ?? []
  const totalStreak = totalStreakResult.count ?? 0
  const profile = profileResult.data as { full_name: string | null; username: string | null; role: string | null; is_complete: boolean | null } | null
  // First-time users must finish onboarding before entering the main app
  if (profile && profile.is_complete === false) redirect('/onboarding')

  const todayRead = streaks.some((s) => s.date === today)

  return (
    <DevotionClient
      verse={verse as DailyVerse | null}
      verseError={verseError?.message ?? null}
      streaks={streaks.map((s) => s.date)}
      totalStreak={totalStreak}
      todayRead={todayRead}
      userId={user.id}
      userName={profile?.full_name ?? profile?.username ?? 'bạn'}
      today={today}
      isAdmin={profile?.role === 'admin'}
    />
  )
}
