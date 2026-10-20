import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from '@/components/admin/AdminClient'

const ADMIN_EMAIL = 'phucnguyendh88@gmail.com'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/dang-nhap')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin =
    profile?.role === 'admin' ||
    user.app_metadata?.role === 'admin' ||
    (user.email ?? '').toLowerCase() === ADMIN_EMAIL

  // Non-admins are sent back to the app (server-side gate; RLS still enforces data access)
  if (!isAdmin) redirect('/tim-chua-truoc')

  return <AdminClient />
}
