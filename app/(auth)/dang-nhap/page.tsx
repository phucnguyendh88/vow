'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  /**
   * Đăng nhập bằng Google OAuth.
   * Sau khi OAuth hoàn thành, Supabase redirect về /auth/callback
   * và trigger on_auth_user_created để tạo profile nếu chưa có.
   */
  async function handleGoogleLogin() {
    setLoading(true)
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
      if (error) throw error
    } catch (err) {
      toast.error('Đăng nhập Google thất bại. Vui lòng thử lại.')
      console.error(err)
      setLoading(false)
    }
    // Không setLoading(false) ở đây vì sẽ redirect sang Google
  }

  /**
   * Đăng nhập ẩn danh (Guest).
   * Tạo phiên anonymous — có thể nâng cấp lên Google sau.
   * Handle: nếu đã có phiên guest, không tạo thêm.
   */
  async function handleGuestLogin() {
    setGuestLoading(true)
    try {
      const { data: existingSession } = await supabase.auth.getSession()
      if (existingSession.session) {
        router.push('/tim-chua-truoc')
        return
      }

      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      router.push('/tim-chua-truoc')
    } catch (err) {
      toast.error('Không thể tạo phiên khách. Vui lòng thử lại.')
      console.error(err)
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <main className="flex flex-col items-center justify-between min-h-dvh px-6 py-12 text-center">
      <div />

      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="vow-title text-gold-gradient text-3xl font-bold tracking-widest">
            VOW
          </h1>
          <h2 className="text-white text-2xl font-light">Chào mừng đến với</h2>
          <h2 className="text-gold-gradient text-2xl font-semibold italic">VOW</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Vào ngay, không cần đăng ký rườm rà.
          </p>
        </div>

        {/* Auth buttons */}
        <div
          className="w-full rounded-3xl p-6 flex flex-col gap-4"
          style={{ background: 'var(--surface)' }}
        >
          {/* Guest button */}
          <button
            onClick={handleGuestLogin}
            disabled={guestLoading || loading}
            className="w-full py-4 rounded-2xl font-semibold text-base text-black transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-50"
            style={{ background: 'var(--gold)' }}
          >
            {guestLoading ? 'Đang tạo phiên...' : 'Tiếp tục với tư cách Khách'}
          </button>

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading || guestLoading}
            className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 border transition-colors hover:bg-white/10 disabled:opacity-50"
            style={{
              background: 'transparent',
              borderColor: 'rgba(255,255,255,0.2)',
              color: 'var(--foreground)',
            }}
          >
            {loading ? (
              <span>Đang chuyển hướng...</span>
            ) : (
              <>
                {/* Google Icon SVG */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Tiếp tục với Google</span>
              </>
            )}
          </button>

          <p className="text-xs" style={{ color: 'var(--gold)' }}>
            Khuyên dùng
          </p>
        </div>

        <Link
          href="/"
          className="text-sm hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Về trang chủ
        </Link>
      </div>

      {/* Footer */}
      <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link href="/dieu-khoan" className="hover:underline">
          Điều khoản sử dụng
        </Link>
        <span>·</span>
        <Link href="/bao-mat" className="hover:underline">
          Chính sách bảo mật
        </Link>
      </div>
    </main>
  )
}
