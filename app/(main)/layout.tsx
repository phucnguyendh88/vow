import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dang-nhap')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_complete, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile as any).is_complete !== true || !(profile as any).full_name?.trim()) {
    redirect('/onboarding')
  }

  return (
    <div className="flex-1 flex flex-col min-h-svh bg-ink text-cream relative">
      {/* Main content - pad bottom for nav */}
      <main className="flex-1 pb-24 overflow-y-auto nice-scroll">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
