import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DevotionClient from '@/components/devotion/DevotionClient'
import type { DailyVerse } from '@/types/database'

export default async function TimChuaTruocPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/dang-nhap')

  // Lấy câu Kinh Thánh hôm nay
  const today = new Date().toISOString().split('T')[0]
  const { data: verse, error: verseError } = await supabase
    .from('daily_verses')
    .select('*')
    .eq('date', today)
    .single()

  // Lấy streak 7 ngày gần nhất
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const { data: streaksData } = await supabase
    .from('reading_streaks')
    .select('date')
    .eq('user_id', user.id)
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })

  const streaks = (streaksData as Array<{ date: string }> | null) ?? []

  // Tính tổng chuỗi ngày liên tiếp (streak count)
  const { count: totalStreak } = await supabase
    .from('reading_streaks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Kiểm tra hôm nay đã đọc chưa
  const todayRead = streaks.some((s) => s.date === today)

  // Lấy profile để hiển thị tên và kiểm tra admin
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, username, role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { full_name: string | null; username: string | null; role: string | null } | null

  return (
    <DevotionClient
      verse={verse as DailyVerse | null}
      verseError={verseError?.message ?? null}
      streaks={streaks.map((s) => s.date)}
      totalStreak={totalStreak ?? 0}
      todayRead={todayRead}
      userId={user.id}
      userName={profile?.full_name ?? profile?.username ?? 'bạn'}
      today={today}
      isAdmin={profile?.role === 'admin'}
    />
  )
}

