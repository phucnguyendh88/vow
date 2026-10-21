'use client'

import { useState, useEffect } from 'react'
import { X, Church, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface Props {
  userId: string | null
  open: boolean
  onClose: () => void
}

export default function UserProfileModal({ userId, open, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!open || !userId) {
      setProfile(null)
      return
    }

    let active = true
    setLoading(true)

    async function loadProfile() {
      try {
        const { data, error } = await (supabase.from('profiles') as any)
          .select('id, full_name, username, avatar_url, date_of_birth, gender, church_name, location_text, bio, interests, photos')
          .eq('id', userId)
          .maybeSingle()

        if (!error && data && active) {
          setProfile(data)
        }
      } catch (e) {
        console.error('Failed to load profile:', e)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [open, userId, supabase])

  if (!open || !userId) return null

  const birthYear = profile?.date_of_birth ? parseInt(profile.date_of_birth.split('-')[0], 10) : null
  const age = birthYear && !isNaN(birthYear) ? new Date().getFullYear() - birthYear : null
  const photos = profile?.photos ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center p-0 sm:p-4">
      <div className="nice-scroll max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#0d0d10] p-6 sm:rounded-3xl border border-[rgba(232,208,141,0.25)] shadow-2xl text-cream">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h2 className="font-serif text-lg font-semibold text-[#E8D08D]">Thông tin hồ sơ</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full bg-white/[0.05] p-2 text-neutral-400 hover:text-white transition active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted">Đang tải hồ sơ...</div>
        ) : !profile ? (
          <div className="py-16 text-center text-sm text-muted">Không tìm thấy thông tin hồ sơ</div>
        ) : (
          <div className="mt-5 space-y-6">
            {/* Avatar & Name & Age */}
            <div className="flex flex-col items-center text-center">
              <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-[rgba(232,208,141,0.5)] bg-surface2 shadow-xl shadow-[#E8D08D]/10">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-serif text-2xl font-bold text-[#E8D08D]">
                    {profile.full_name?.charAt(0) || 'V'}
                  </div>
                )}
              </div>

              <h3 className="mt-3 font-serif text-2xl font-bold text-cream">
                {profile.full_name || 'Thành viên'}
                {age ? `, ${age}` : ''}
              </h3>

              <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-300">
                {profile.church_name && (
                  <span className="flex items-center gap-1 text-[#E8D08D]">
                    <Church size={14} />
                    {profile.church_name}
                  </span>
                )}
                {profile.location_text && (
                  <span className="flex items-center gap-1 text-neutral-400">
                    <MapPin size={14} />
                    {profile.location_text}
                  </span>
                )}
              </div>
            </div>

            {/* Photos Album Grid (Max 6) */}
            {photos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold tracking-[0.2em] text-[#E8D08D] uppercase">
                    ẢNH HỒ SƠ
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {photos.length}/6
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[rgba(232,208,141,0.2)] bg-[#141418] shadow-md"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Ảnh ${idx + 1}`}
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-[11px] font-bold tracking-[0.18em] text-[#E8D08D] uppercase mb-1.5">
                  GIỚI THIỆU
                </p>
                <p className="text-sm leading-relaxed text-cream/90 whitespace-pre-line">
                  {profile.bio}
                </p>
              </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-[11px] font-bold tracking-[0.18em] text-[#E8D08D] uppercase mb-2">
                  SỞ THÍCH
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((it) => (
                    <span
                      key={it}
                      className="rounded-full border border-[rgba(232,208,141,0.25)] bg-[rgba(232,208,141,0.08)] px-3 py-1 text-xs text-[#E8D08D]"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
