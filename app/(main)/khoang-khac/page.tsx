// app/(main)/khoang-khac/page.tsx
// Tab "Khoảnh Khắc" — Camera + Moments feed (Locket-style)
// Server Component: xác thực + prefetch data song song, sau đó mount MomentsClient

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MomentsClient from '@/components/moments/MomentsClient'
import type { Moment } from '@/types/database'

interface MomentWithProfile extends Moment {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface MyMoment {
  id: string
  media_url: string
  thumbnail_url: string | null
  created_at: string
  media_type: 'image' | 'video'
}

export default async function KhoangKhacPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/dang-nhap')

  // Sinh mã kết bạn duy nhất và ổn định cho mỗi tài khoản từ user.id
  const myInviteCode = 'FC-' + user.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  // Chạy song song: moments chung (bao gồm cả của mình), moments cá nhân, và profile user hiện tại
  const [momentsRes, myMomentsRes, profileRes] = await Promise.all([
    supabase
      .from('moments')
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        thumbnail_url,
        caption,
        is_deleted,
        deleted_at,
        created_at,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('moments')
      .select('id, media_url, thumbnail_url, created_at, media_type, caption')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const momentsData = momentsRes.data
  const momentsError = momentsRes.error
  const myMomentsData = myMomentsRes.data

  const profileData = profileRes.data as {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null

  const currentUser = {
    id: user.id,
    username: profileData?.username ?? (user.user_metadata?.username as string | undefined) ?? null,
    full_name: profileData?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    avatar_url: profileData?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null,
  }

  return (
    <MomentsClient
      initialMoments={(momentsData as MomentWithProfile[]) ?? []}
      myMoments={(myMomentsData as MyMoment[]) ?? []}
      userId={user.id}
      currentUser={currentUser}
      myInviteCode={myInviteCode}
      fetchError={momentsError?.message ?? null}
    />
  )
}
