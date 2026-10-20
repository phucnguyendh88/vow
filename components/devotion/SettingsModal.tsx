'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, User, Shield, Home, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  isAdmin?: boolean
}

export default function SettingsModal({ open, onClose, isAdmin = false }: Props) {
  const router = useRouter()
  const supabase = createClient()

  if (!open) return null

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Đã đăng xuất')
      router.push('/')
      router.refresh()
    } catch {
      toast.error('Đăng xuất thất bại')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="nice-scroll w-full max-w-sm max-h-[85vh] sm:max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-surface p-6 pb-10 sm:p-6 sm:rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h2 className="font-serif text-xl font-semibold text-cream">Cài đặt</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="rounded-full bg-surface2 p-2 text-muted hover:text-cream transition active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {/* My Profile */}
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push('/ho-so')
            }}
            className="flex w-full items-center gap-3.5 rounded-2xl bg-surface2/60 p-3.5 text-left text-sm font-medium text-cream hover:bg-surface2 transition active:scale-[0.99] cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-gold">
              <User size={18} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-cream">Hồ sơ của tôi</p>
              <p className="text-xs text-muted">Chỉnh sửa thông tin, hội thánh, ảnh</p>
            </div>
          </button>

          {/* Admin panel (if admin) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose()
                router.push('/admin')
              }}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-surface2/60 p-3.5 text-left text-sm font-medium text-cream hover:bg-surface2 transition active:scale-[0.99] cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-amber-400">
                <Shield size={18} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-cream">Quản trị</p>
                <p className="text-xs text-muted">Báo cáo, kiểm duyệt và quản lý</p>
              </div>
            </button>
          )}

          {/* Home */}
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push('/')
            }}
            className="flex w-full items-center gap-3.5 rounded-2xl bg-surface2/60 p-3.5 text-left text-sm font-medium text-cream hover:bg-surface2 transition active:scale-[0.99] cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-cream/70">
              <Home size={18} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-cream">Thoát về màn hình chính</p>
            </div>
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-2 flex w-full items-center gap-3.5 rounded-2xl bg-rose-500/10 p-3.5 text-left text-sm font-medium text-rose-400 hover:bg-rose-500/15 transition active:scale-[0.99] cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <LogOut size={18} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Đăng xuất</p>
              <p className="text-xs text-rose-400/70">Rời khỏi phiên làm việc hiện tại</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
