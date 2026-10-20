'use client'

import { fastSignOut } from '@/lib/auth-fast'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'phucnguyendh88@gmail.com'

function UserIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function LogoutIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
      <path d="m16 17 5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  isAdmin?: boolean
}

export default function SettingsModal({ open, onClose, isAdmin: initialAdmin = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(initialAdmin)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!active) return
        setIsAdmin(
          initialAdmin ||
            (user?.email?.trim().toLowerCase() ?? '') === ADMIN_EMAIL ||
            user?.app_metadata?.role === 'admin'
        )
        setIsGuest(Boolean(user?.is_anonymous))
      })
      .catch(() => {
        if (!active) return
        setIsAdmin(initialAdmin)
        setIsGuest(false)
      })
    return () => {
      active = false
    }
  }, [open, initialAdmin, supabase])

  if (!open) return null

  const handleGoProfile = () => {
    onClose()
    router.push('/ho-so')
  }

  const handleGoAdmin = () => {
    onClose()
    router.push('/admin')
  }

  const handleSignOutOrExit = async () => {
    onClose()
    // If Guest, keep guest session on device and return to landing/login as in original VOW
    if (!isGuest) {
      await fastSignOut('/')
      return
    }
    router.replace('/')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Đóng cài đặt"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative w-full max-w-md rounded-t-[2rem] bg-surface p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface2" />
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-semibold text-cream">Cài đặt</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-cream active:scale-95"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleGoProfile}
            className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left text-cream active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-goldsoft text-gold">
              <UserIcon />
            </span>
            <span className="font-medium">Hồ sơ của tôi</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleGoAdmin}
              className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left text-cream active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-goldsoft text-gold">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="h-5 w-5"
                >
                  <path
                    d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4z"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="font-medium">Quản trị</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSignOutOrExit()}
            className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left text-danger active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
              <LogoutIcon />
            </span>
            <span className="font-medium">
              {isGuest ? 'Thoát về màn hình chính' : 'Đăng xuất'}
            </span>
          </button>

          {isGuest && (
            <p className="mt-2 px-1 text-xs leading-relaxed text-muted/70">
              Tài khoản Khách được lưu trên thiết bị này. Người dùng chung thiết bị có thể truy cập tài khoản này.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
