'use client'

import { useEffect, useState } from 'react'
import { detectZaloWebView, type ZaloDetectResult } from '@/lib/zalo-webview'

export default function ZaloWebViewEscape() {
  const [zaloInfo, setZaloInfo] = useState<ZaloDetectResult>({
    isZalo: false,
    isAndroid: false,
    isIOS: false,
  })
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const info = detectZaloWebView()
    setZaloInfo(info)

    // Nếu là Android trong Zalo, thử trigger intent Chrome 1 lần duy nhất (không lặp)
    if (info.isZalo && info.isAndroid) {
      const intentTried = sessionStorage.getItem('vow_zalo_intent_tried')
      if (!intentTried) {
        sessionStorage.setItem('vow_zalo_intent_tried', '1')
        const currentUrl = window.location.href.replace(/^https?:\/\//, '')
        const chromeIntent = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`
        try {
          window.location.href = chromeIntent
        } catch {
          // Fallback UI sẽ hiển thị nếu intent bị Zalo chặn
        }
      }
    }
  }, [])

  if (!zaloInfo.isZalo || dismissed) return null

  const handleCopyLink = () => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch {}
  }

  const handleOpenChrome = () => {
    const currentUrl = window.location.href.replace(/^https?:\/\//, '')
    const chromeIntent = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`
    window.location.href = chromeIntent
  }

  return (
    <div
      role="region"
      aria-label="Cảnh báo trình duyệt Zalo"
      className="sticky top-0 z-50 border-b border-[rgba(232,208,141,0.3)] bg-[#121214]/95 px-4 py-3 text-white shadow-xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-xs leading-relaxed">
          <p className="font-semibold text-[#E8D08D] flex items-center gap-1.5">
            <span>⚠️</span> Bạn đang mở VOW trong Zalo
          </p>
          <p className="mt-1 text-neutral-300">
            {zaloInfo.isIOS ? (
              <>
                Để phiên đăng nhập Google và tài khoản không bị mất, hãy bấm biểu tượng{' '}
                <strong className="text-white font-bold">•••</strong> ở góc trên bên phải Zalo, rồi chọn{' '}
                <strong className="text-[#E8D08D]">“Mở bằng trình duyệt Safari”</strong>.
              </>
            ) : (
              <>
                Để tài khoản và thông báo được lưu trữ ổn định, hãy mở bằng{' '}
                <strong className="text-[#E8D08D]">Chrome</strong> hoặc trình duyệt chính của máy.
              </>
            )}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {zaloInfo.isAndroid && (
              <button
                type="button"
                onClick={handleOpenChrome}
                className="rounded-full bg-[#E8D08D] px-3.5 py-1 text-[11px] font-bold text-black transition active:scale-95"
              >
                Mở bằng Chrome
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-neutral-200 transition active:scale-95"
            >
              {copied ? '✓ Đã sao chép link' : 'Sao chép link'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Đóng thông báo"
          className="rounded-full p-1 text-neutral-400 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
