'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  /**
   * Đăng nhập bằng Google OAuth.
   * Sau khi OAuth hoàn thành, Supabase redirect về /auth/callback
   */
  async function handleGoogleLogin() {
    setLoading(true)
    setErrorMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) {
        if (error.message.includes('not enabled') || error.message.includes('Unsupported provider')) {
          setErrorMessage('Google Login chưa được bật trên Supabase dashboard (cần nhập Google Client ID / Secret). Bạn có thể bấm "Tiếp tục với tư cách Khách" ở trên để vào ngay.')
        } else {
          setErrorMessage(error.message)
        }
        setLoading(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Đăng nhập Google thất bại.')
      setLoading(false)
    }
  }

  /**
   * Đăng nhập ẩn danh (Guest).
   */
  async function handleGuestLogin() {
    setGuestLoading(true)
    setErrorMessage(null)
    try {
      const { data: existingSession } = await supabase.auth.getSession()
      if (existingSession?.session) {
        router.push('/tim-chua-truoc')
        return
      }

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        throw error
      }

      if (data?.session) {
        router.push('/tim-chua-truoc')
      }
    } catch (err: any) {
      console.error('Guest login error:', err)
      setErrorMessage(err?.message || 'Không thể tạo phiên khách. Vui lòng thử lại.')
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <div
      className="relative flex min-h-dvh flex-col justify-between"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(245,179,1,0.06), transparent 60%)',
      }}
    >
      <div className="mx-auto max-w-md w-full flex-1 flex flex-col justify-center px-6 py-12">
        {/* Title */}
        <h1 className="font-serif-vow text-4xl text-center">
          <span className="text-cream">Chào mừng đến với</span>
          <br />
          <span className="text-gold italic font-semibold">VOW</span>
        </h1>

        <p className="mt-3 text-center text-sm text-muted">
          Vào ngay, không cần đăng ký rườm rà.
        </p>

        {/* Auth Box */}
        <div className="mt-8 rounded-3xl bg-surface border border-surface2 p-6 shadow-xl">
          {/* Guest Button */}
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={guestLoading || loading}
            className="w-full rounded-full bg-gold px-6 py-4 text-base font-semibold text-ink transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-md shadow-gold/10"
          >
            {guestLoading ? 'Đang tạo phiên...' : 'Tiếp tục với tư cách Khách'}
          </button>

          {/* Google Button */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || guestLoading}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-surface2 bg-cream px-6 py-3.5 text-base font-semibold text-ink transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
                />
              </svg>
              <span>{loading ? 'Đang chuyển hướng...' : 'Tiếp tục với Google'}</span>
            </button>
            <p className="mt-1.5 text-center text-xs text-gold/80">Khuyên dùng</p>
          </div>

          {errorMessage && (
            <p className="mt-4 text-center text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 rounded-xl p-3">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-muted/80 hover:text-gold transition-colors inline-flex items-center gap-1"
          >
            ← Về trang chủ
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center gap-4 text-xs text-muted/80">
          <Link href="/dieu-khoan" className="hover:text-gold underline underline-offset-4">
            Điều khoản sử dụng
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/chinh-sach-bao-mat" className="hover:text-gold underline underline-offset-4">
            Chính sách bảo mật
          </Link>
        </div>
      </div>
    </div>
  )
}

