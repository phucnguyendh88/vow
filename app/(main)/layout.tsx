import BottomNav from '@/components/ui/BottomNav'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--background)' }}>
      {/* Main content - pad bottom for nav */}
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
