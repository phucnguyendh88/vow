import BottomNav from '@/components/ui/BottomNav'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
