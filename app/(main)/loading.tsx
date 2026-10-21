export default function MainLoading() {
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-5 pt-8 pb-32 animate-pulse bg-black">
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between pb-6">
        <div className="h-4 w-32 bg-white/10 rounded-full" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-white/10 rounded-full" />
          <div className="h-10 w-10 bg-white/10 rounded-full" />
        </div>
      </div>

      {/* Main Content card skeleton */}
      <div className="w-full flex-1 min-h-[420px] rounded-[2.5rem] bg-surface2/60 border border-white/5 p-6 flex flex-col justify-end">
        <div className="space-y-3">
          <div className="h-6 w-3/4 bg-white/15 rounded-lg" />
          <div className="h-4 w-1/2 bg-white/10 rounded-lg" />
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-16 bg-white/10 rounded-full" />
            <div className="h-6 w-20 bg-white/10 rounded-full" />
            <div className="h-6 w-14 bg-white/10 rounded-full" />
          </div>
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="flex justify-center gap-6 py-6">
        <div className="h-14 w-14 rounded-full bg-white/10" />
        <div className="h-14 w-14 rounded-full bg-white/10" />
      </div>
    </div>
  )
}
