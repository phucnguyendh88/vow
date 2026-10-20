'use client'

import { useEffect, useState } from 'react'

export interface ZaloDetectResult {
  isZalo: boolean
  isAndroid: boolean
  isIOS: boolean
}

export function detectZaloWebView(): ZaloDetectResult {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isZalo: false, isAndroid: false, isIOS: false }
  }

  const ua = navigator.userAgent || navigator.vendor || ''
  // Zalo App trên Android và iOS luôn chứa token "Zalo" hoặc "ZaloTheme"
  const isZalo = /Zalo/i.test(ua) || /ZaloTheme/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  return { isZalo, isAndroid, isIOS }
}

/**
 * Hook phát hiện Zalo WebView an toàn
 */
export function useZaloWebView(): ZaloDetectResult {
  const [result, setResult] = useState<ZaloDetectResult>({
    isZalo: false,
    isAndroid: false,
    isIOS: false,
  })

  useEffect(() => {
    setResult(detectZaloWebView())
  }, [])

  return result
}
