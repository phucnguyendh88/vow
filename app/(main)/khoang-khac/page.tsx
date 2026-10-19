// app/(main)/khoang-khac/page.tsx
// Tab "Khoảnh Khắc" — Camera + Moments feed (Locket-style)
// Server Component: xác thực + prefetch data, sau đó mount MomentsClient

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

  // Lấy Moments từ bạn bè / người đã match (hiện tại: authenticated users)
  const { data: momentsData, error: momentsError } = await supabase
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
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  // Lịch sử Moments của chính mình
  const { data: myMomentsData } = await supabase
    .from('moments')
    .select('id, media_url, thumbnail_url, created_at, media_type')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <MomentsClient
      initialMoments={(momentsData as MomentWithProfile[]) ?? []}
      myMoments={(myMomentsData as MyMoment[]) ?? []}
      userId={user.id}
      fetchError={momentsError?.message ?? null}
    />
  )
}
