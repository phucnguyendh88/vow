import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DatingClient from '@/components/dating/DatingClient'

export default async function KetNoiSauPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/dang-nhap')

  // Lấy danh sách profiles đã swipe (để loại trừ)
  const { data: swipedData } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', user.id)
    .eq('context', 'dating')

  const swipedIds = (swipedData as Array<{ swiped_id: string }> | null)?.map((s) => s.swiped_id) ?? []
  const excludedIds = [user.id, ...swipedIds]

  // Lấy danh sách profiles bị chặn (cả 2 chiều)
  const { data: blockedData } = await supabase
    .from('blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

  const blockedRelations = blockedData as Array<{ blocked_id: string; blocker_id: string }> | null
  const blockedIds = blockedRelations?.flatMap((b) =>
    b.blocker_id === user.id ? [b.blocked_id] : [b.blocker_id]
  ) ?? []

  const allExcludedIds = [...new Set([...excludedIds, ...blockedIds])]

  // Lấy profiles để khám phá (loại trừ đã swipe, bị chặn, bị ban, không đủ điều kiện)
  let query = supabase
    .from('profiles')
    .select('id, username, full_name, bio, avatar_url, date_of_birth, gender, location_text, church_name, interests')
    .eq('is_active', true)
    .eq('is_banned', false)
    .eq('is_complete', true)
    .neq('id', user.id)
    .limit(10)

  if (allExcludedIds.length > 0) {
    query = query.not('id', 'in', `(${allExcludedIds.join(',')})`)
  }

  const { data: profiles, error } = await query

  // Lấy danh sách Matches
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      user1_id,
      user2_id,
      created_at,
      conversations (id)
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  return (
    <DatingClient
      discoverProfiles={profiles ?? []}
      matches={matches ?? []}
      userId={user.id}
      fetchError={error?.message ?? null}
    />
  )
}
