'use client'

import { useState } from 'react'
import { X, Copy, Check, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

interface FriendProfile {
  id: string
  name: string
  username?: string | null
  avatarUrl?: string | null
  church?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  myInviteCode: string
  friends: FriendProfile[]
  onAddFriendByCode: (code: string) => Promise<boolean>
}

export default function FriendsModal({
  open,
  onClose,
  myInviteCode,
  friends,
  onAddFriendByCode,
}: Props) {
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/khoang-khac?code=${encodeURIComponent(myInviteCode)}`
    navigator.clipboard.writeText(`Kết bạn trên VOW với mình nhé: ${inviteUrl}`).then(() => {
      setCopied(true)
      toast.success('Đã sao chép link mời kết bạn')
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {
      toast.error('Không sao chép được')
    })
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = inviteCodeInput.trim().toUpperCase()
    if (!clean) return
    setIsSubmitting(true)
    const ok = await onAddFriendByCode(clean)
    setIsSubmitting(false)
    if (ok) {
      setInviteCodeInput('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="nice-scroll max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-surface p-6 sm:rounded-3xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h2 className="font-serif text-xl font-semibold text-cream">
            Bạn bè ({friends.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full bg-surface2 p-2 text-muted hover:text-cream transition active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* My Invite Code Card */}
        <div className="mt-5 rounded-2xl bg-surface2/60 p-4 border border-white/5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Mã kết bạn của bạn
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-2xl font-bold tracking-wider text-cream">
              {myInviteCode || 'FC-VOW123'}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition active:scale-95 hover:brightness-105 cursor-pointer"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Chia sẻ mã hoặc link này để bạn bè thêm bạn vào Locket của họ.
          </p>
        </div>

        {/* Add Friend Form */}
        <form onSubmit={handleAdd} className="mt-5">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted">
            Nhập mã kết bạn
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="VD: FC-7K2PQA"
              maxLength={15}
              className="flex-1 uppercase rounded-xl bg-surface2 border border-transparent px-3 py-2 text-sm text-cream placeholder:normal-case placeholder:text-muted/60 outline-none focus:border-gold/60"
            />
            <button
              type="submit"
              disabled={!inviteCodeInput.trim() || isSubmitting}
              className="flex items-center gap-1 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40 transition active:scale-95 cursor-pointer"
            >
              <UserPlus size={14} />
              <span>{isSubmitting ? '...' : 'Thêm'}</span>
            </button>
          </div>
        </form>

        {/* Friends List */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Danh sách ({friends.length})
          </p>
          {friends.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">
              Chưa có bạn bè nào. Hãy chia sẻ mã kết bạn ở trên nhé!
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl bg-surface2/40 p-2.5 border border-white/5"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-surface2">
                    {f.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-bold text-muted">
                        {f.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-cream truncate">{f.name}</p>
                    {f.church && (
                      <p className="text-xs text-muted truncate">{f.church}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
