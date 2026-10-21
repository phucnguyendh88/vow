export default function ConversationLoading() {
  return (
    <div className="flex h-dvh flex-col bg-[#050505] text-cream">
      {/* Header Skeleton */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/90 px-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-muted">
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/5" />
        </div>
      </header>

      {/* Messages Area Skeleton */}
      <div className="flex-1 space-y-3 overflow-hidden p-4">
        {/* Left message skeleton */}
        <div className="flex items-end gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
          <div className="h-10 w-44 animate-pulse rounded-2xl rounded-bl-sm bg-white/10" />
        </div>

        {/* Right message skeleton */}
        <div className="flex justify-end">
          <div className="h-12 w-52 animate-pulse rounded-2xl rounded-br-sm bg-[#E8D08D]/15" />
        </div>

        {/* Left message skeleton */}
        <div className="flex items-end gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
          <div className="h-16 w-60 animate-pulse rounded-2xl rounded-bl-sm bg-white/10" />
        </div>

        {/* Right message skeleton */}
        <div className="flex justify-end">
          <div className="h-9 w-36 animate-pulse rounded-2xl rounded-br-sm bg-[#E8D08D]/15" />
        </div>

        {/* Left message skeleton */}
        <div className="flex items-end gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
          <div className="h-10 w-48 animate-pulse rounded-2xl rounded-bl-sm bg-white/10" />
        </div>
      </div>

      {/* Input Bar Skeleton */}
      <footer className="border-t border-white/5 bg-[#0a0a0a] p-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/5" />
          <div className="h-10 flex-1 animate-pulse rounded-full bg-white/5" />
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/10" />
        </div>
      </footer>
    </div>
  )
}
