'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="vi" className="dark">
      <body className="min-h-dvh bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-2xl bg-[#121215] border border-white/10 p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-[#E8D08D]">Đã xảy ra lỗi</h2>
          <p className="text-xs text-white/70 break-words font-mono bg-black/40 p-3 rounded-lg">
            {error?.message || 'Lỗi không xác định trên thiết bị'}
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                try {
                  reset()
                } catch {
                  if (typeof window !== 'undefined') window.location.reload()
                }
              }}
              className="w-full py-2.5 rounded-xl bg-[#E8D08D] text-black font-medium text-sm cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.assign('/tim-chua-truoc')
              }}
              className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/80 font-medium text-xs cursor-pointer"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
