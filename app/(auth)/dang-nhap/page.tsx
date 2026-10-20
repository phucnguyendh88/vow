'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const LINK_PENDING_KEY = 'fc_link_pending_v1'

export default function LoginPage() {
  const [checking, setChecking] = useState(true)
  const [sessionUser, setSessionUser] = useState<{ id: string; isGuest: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showLinkConfirm, setShowLinkConfirm] = useState(false)
  const [conflictType, setConflictType] = useState<string | null>(null)
  const [confirmSwitchGoogle, setConfirmSwitchGoogle] = useState(false)
  const [linkingBusy, setLinkingBusy] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function redirectAfterLogin() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Không lấy được phiên đăng nhập.')
    router.replace('/tim-chua-truoc')
  }

  useEffect(() => {
    let cancelled = false

    try {
      const searchStr =
        window.location.search.replace(/^\?/, '') +
        '&' +
        window.location.hash.replace(/^#/, '')
      const params = new URLSearchParams(searchStr)
      const errCode = params.get('error_code') || ''
      const errDesc = params.get('error_description') || ''
      const err = params.get('error') || ''
      if (errCode === 'identity_already_exists' || /already linked to/i.test(errDesc)) {
        localStorage.removeItem(LINK_PENDING_KEY)
        if (!cancelled) {
          setConflictType('identity_already_exists')
          setLinkingBusy(false)
        }
        window.history.replaceState(null, '', window.location.pathname)
      } else if (err && err !== 'access_denied') {
        localStorage.removeItem(LINK_PENDING_KEY)
        if (!cancelled) {
          setErrorMessage('Liên kết thất bại. Bạn có thể thử lại.')
          setLinkingBusy(false)
        }
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch {}

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (cancelled) return
        if (user) {
          const isGuest = Boolean(user.is_anonymous)
          setSessionUser({ id: user.id, isGuest })
          if (!isGuest) {
            router.replace('/tim-chua-truoc')
          }
        } else {
          setSessionUser(null)
        }
      })
      .catch(() => {
        if (!cancelled) setSessionUser(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  async function handleGoogleLogin() {
    setBusy(true)
    setErrorMessage('')
    try {
      localStorage.removeItem(LINK_PENDING_KEY)
    } catch {}
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
          setErrorMessage(
            'Google Login chưa được bật trên hệ thống. Bạn có thể bấm "Tiếp tục với tư cách Khách" ở trên để vào ngay.'
          )
        } else {
          setErrorMessage(error.message)
        }
        setBusy(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Đăng nhập Google thất bại, thử lại nhé.')
      setBusy(false)
    }
  }

  async function handleGuestLogin() {
    setBusy(true)
    setErrorMessage('')
    try {
      const {
        data: { session: existing },
      } = await supabase.auth.getSession()
      if (existing) {
        await redirectAfterLogin()
        return
      }
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      await redirectAfterLogin()
    } catch (err: any) {
      const msg = err?.message || ''
      setErrorMessage(
        msg.includes('Anonymous sign-ins are disabled')
          ? 'Đăng nhập khách đang tạm tắt trên hệ thống, vui lòng thử lại sau hoặc dùng Google nhé.'
          : msg || 'Đăng nhập thất bại, thử lại nhé.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleContinueExistingGuest() {
    setBusy(true)
    setErrorMessage('')
    try {
      await redirectAfterLogin()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Đăng nhập thất bại, thử lại nhé.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLinkGoogleToGuest() {
    setShowLinkConfirm(false)
    const uid = sessionUser?.id
    if (!uid) {
      setErrorMessage('Không xác định được tài khoản Khách.')
      return
    }
    try {
      localStorage.setItem(LINK_PENDING_KEY, JSON.stringify({ uid, ts: Date.now() }))
    } catch {}
    setLinkingBusy(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      try {
        localStorage.removeItem(LINK_PENDING_KEY)
      } catch {}
      setLinkingBusy(false)
      const code = err?.code || ''
      const msg = err?.message || ''
      setErrorMessage(
        code === 'manual_linking_disabled' || /manual linking/i.test(msg)
          ? 'Tính năng liên kết chưa được bật trên hệ thống, vui lòng thử lại sau nhé.'
          : msg || 'Liên kết thất bại, thử lại nhé.'
      )
    }
  }

  if (checking) {
    return (
      <div className="min-h-svh bg-ink text-cream flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-surface2 border-t-gold animate-spin" />
      </div>
    )
  }

  if (sessionUser?.isGuest) {
    return (
      <div className="min-h-svh bg-ink text-cream flex flex-col">
        <div className="mx-auto max-w-md w-full flex-1 flex flex-col justify-center px-6 py-12">
          <h1 className="font-serif text-4xl text-center">
            <span className="text-cream">Chào mừng</span>
            <br />
            <span className="text-gold italic">trở lại!</span>
          </h1>
          <p className="mt-3 text-center text-sm text-muted">
            Bạn đang dùng tài khoản Khách trên thiết bị này.
          </p>

          <div className="mt-8 rounded-3xl bg-surface border border-surface2 p-6">
            <button
              type="button"
              onClick={handleContinueExistingGuest}
              disabled={busy}
              className="w-full rounded-full bg-gold px-6 py-4 text-base font-semibold text-ink transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? 'Đang xử lý...' : 'Tiếp tục với tài khoản Khách'}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-surface2" />
              hoặc
              <span className="h-px flex-1 bg-surface2" />
            </div>

            <button
              type="button"
              onClick={() => setShowLinkConfirm(true)}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-surface2 bg-cream px-6 py-3.5 text-base font-semibold text-ink transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60"
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
              Tiếp tục với Google
            </button>

            {errorMessage && (
              <p className="mt-4 text-center text-sm text-danger">{errorMessage}</p>
            )}

            <p className="mt-4 text-center text-xs leading-relaxed text-muted/70">
              Tài khoản Khách được lưu trên thiết bị này. Người dùng chung thiết bị có thể truy cập tài khoản này.
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  window.confirm(
                    'Đăng xuất hoàn toàn khỏi tài khoản Khách trên thiết bị này? Bạn sẽ cần đăng nhập lại từ đầu.'
                  )
                ) {
                  try {
                    await supabase.auth.signOut()
                    window.location.reload()
                  } catch {
                    window.location.reload()
                  }
                }
              }}
              className="mt-3 w-full text-center text-xs text-muted/70 underline underline-offset-4 hover:text-cream disabled:opacity-60"
            >
              Đăng xuất Khách hoàn toàn
            </button>
          </div>

          <Link
            href="/"
            className="mt-6 text-center text-sm text-muted hover:text-cream"
          >
            ← Về trang chủ
          </Link>
        </div>

        {showLinkConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
            <div className="w-full max-w-sm rounded-3xl bg-surface border border-surface2 p-6 text-center">
              <h3 className="font-serif text-2xl text-cream">Liên kết với Google?</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Liên kết tài khoản Khách với Google? Hồ sơ, khoảnh khắc, bạn bè và dữ liệu hiện tại sẽ được{' '}
                <span className="text-cream font-semibold">giữ nguyên</span> nếu liên kết thành công.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkConfirm(false)}
                  className="flex-1 rounded-full border border-surface2 bg-ink px-4 py-3 text-sm font-semibold text-cream active:scale-95"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleLinkGoogleToGuest}
                  disabled={linkingBusy}
                  className="flex-[2] rounded-full bg-gold px-4 py-3 text-sm font-bold text-ink active:scale-95 disabled:opacity-60"
                >
                  {linkingBusy ? 'Đang xử lý...' : 'Liên kết với Google'}
                </button>
              </div>
            </div>
          </div>
        )}

        {conflictType === 'identity_already_exists' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
            <div className="w-full max-w-sm rounded-3xl bg-surface border border-surface2 p-6 text-center">
              <h3 className="font-serif text-2xl text-cream">Không liên kết được</h3>
              {confirmSwitchGoogle ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    Dữ liệu của tài khoản Khách hiện tại (hồ sơ, khoảnh khắc, bạn bè) sẽ{' '}
                    <span className="text-cream font-semibold">không</span> được chuyển sang và bạn sẽ không truy cập lại được. Bạn chắc chắn muốn tiếp tục?
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmSwitchGoogle(false)}
                      className="flex-1 rounded-full border border-surface2 bg-ink px-4 py-3 text-sm font-semibold text-cream active:scale-95"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setConflictType(null)
                        setConfirmSwitchGoogle(false)
                        await supabase.auth.signOut()
                        handleGoogleLogin()
                      }}
                      className="flex-[2] rounded-full bg-gold px-4 py-3 text-sm font-bold text-ink active:scale-95"
                    >
                      Tiếp tục
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    Tài khoản Google này đã được liên kết với một tài khoản VOW khác. Bạn có thể đăng nhập vào tài khoản Google đó, hoặc quay lại tiếp tục dùng tài khoản Khách hiện tại.
                  </p>
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmSwitchGoogle(true)}
                      className="w-full rounded-full bg-gold px-4 py-3 text-sm font-bold text-ink active:scale-95"
                    >
                      Đăng nhập vào tài khoản Google đó
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConflictType(null)
                        setConfirmSwitchGoogle(false)
                      }}
                      className="w-full rounded-full border border-surface2 bg-ink px-4 py-3 text-sm font-semibold text-cream active:scale-95"
                    >
                      Quay lại tài khoản Khách
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-ink text-cream flex flex-col">
      <div className="mx-auto max-w-md w-full flex-1 flex flex-col justify-center px-6 py-12">
        <h1 className="font-serif text-4xl text-center">
          <span className="text-cream">Chào mừng đến với</span>
          <br />
          <span className="text-gold italic">VOW</span>
        </h1>

        <p className="mt-3 text-center text-sm text-muted">
          Vào ngay, không cần đăng ký rườm rà.
        </p>

        <div className="mt-8 rounded-3xl bg-surface border border-surface2 p-6">
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={busy}
            className="w-full rounded-full bg-gold px-6 py-4 text-base font-semibold text-ink transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Đang xử lý...' : 'Tiếp tục với tư cách Khách'}
          </button>

          <div className="mt-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-surface2 bg-cream px-6 py-3.5 text-base font-semibold text-ink transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60"
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
              Tiếp tục với Google
            </button>
            <p className="mt-1.5 text-center text-xs text-gold/80">Khuyên dùng</p>
          </div>

          {errorMessage && (
            <p className="mt-4 text-center text-sm text-danger">{errorMessage}</p>
          )}
        </div>

        <Link
          href="/"
          className="mt-6 text-center text-sm text-muted hover:text-cream"
        >
          ← Về trang chủ
        </Link>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-muted/80">
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
