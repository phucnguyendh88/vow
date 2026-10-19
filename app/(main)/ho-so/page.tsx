import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from '@/components/profile/ProfileClient'
import type { Profile } from '@/types/database'

export default async function HoSoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/dang-nhap')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <ProfileClient
      initialProfile={profile as Profile | null}
      userId={user.id}
      userEmail={user.email}
    />
  )
}
