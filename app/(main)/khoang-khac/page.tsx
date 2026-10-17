import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MomentsClient from '@/components/moments/MomentsClient'

export default async function KhoangKhacPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/dang-nhap')

  // Lấy danh sách moments (có phân trang, trang đầu)
  const { data: moments, error } = await supabase
    .from('moments')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)

  // Lấy danh sách moments của chính mình
  const { data: myMoments } = await supabase
    .from('moments')
    .select('id, media_url, thumbnail_url, created_at, media_type')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <MomentsClient
      initialMoments={moments ?? []}
      myMoments={myMoments ?? []}
      userId={user.id}
      fetchError={error?.message ?? null}
    />
  )
}
