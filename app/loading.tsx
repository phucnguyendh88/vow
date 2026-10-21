export default function RootLoading() {
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center select-none">
      <div className="flex flex-col items-center gap-5">
        <div className="font-serif text-3xl sm:text-4xl font-bold tracking-[0.35em] text-[#E8D08D] drop-shadow-[0_0_25px_rgba(232,208,141,0.4)] animate-pulse">
          VOW
        </div>
        <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#E8D08D] animate-spin" />
      </div>
    </div>
  )
}
