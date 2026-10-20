'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Camera, Check, LogOut, Plus, Trash2, User } from 'lucide-react'
import type { Profile } from '@/types/database'
import toast from 'react-hot-toast'
import imageCompression from 'browser-image-compression'

const INTEREST_OPTIONS = [
  'Thờ phượng',
  'Hát thánh ca',
  'Đọc Kinh Thánh',
  'Truyền giáo',
  'Thiện nguyện',
  'Du lịch',
  'Âm nhạc',
  'Cà phê',
  'Thể thao',
  'Nấu ăn',
  'Đọc sách',
  'Nhiếp ảnh',
]

interface Props {
  initialProfile: Profile | null
  userId: string
  userEmail?: string | null
}

export default function ProfileClient({ initialProfile, userId, userEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form states
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(profile?.gender ?? 'male')
  const [churchName, setChurchName] = useState(profile?.church_name ?? '')
  const [locationText, setLocationText] = useState(profile?.location_text ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    )
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      })

      const path = `${userId}/avatar_${Date.now()}.jpg`
      let publicUrl = ''
      const primary = await supabase.storage
        .from('profile-images')
        .upload(path, compressed, { upsert: true })

      if (!primary.error && primary.data) {
        publicUrl = supabase.storage.from('profile-images').getPublicUrl(primary.data.path).data.publicUrl
      } else {
        const fallback = await supabase.storage
          .from('avatars')
          .upload(path, compressed, { upsert: true })
        if (fallback.error || !fallback.data) throw fallback.error || new Error('Upload failed')
        publicUrl = supabase.storage.from('avatars').getPublicUrl(fallback.data.path).data.publicUrl
      }

      setAvatarUrl(publicUrl)
      // Save directly
      await (supabase.from('profiles') as any)
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      toast.success('Đã cập nhật ảnh đại diện')
    } catch {
      toast.error('Cập nhật ảnh thất bại')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị')
      return
    }
    setSaving(true)

    try {
      const updates = {
        full_name: fullName.trim(),
        gender,
        church_name: churchName.trim() || null,
        location_text: locationText.trim() || null,
        bio: bio.trim() || null,
        interests,
        is_complete: true,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await (supabase.from('profiles') as any)
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      setEditing(false)
      toast.success('Đã lưu hồ sơ thành công!')
    } catch {
      toast.error('Lưu hồ sơ thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    if (!window.confirm('Bạn có chắc muốn đăng xuất?')) return
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex flex-col min-h-dvh bg-ink text-cream pb-32 max-w-md mx-auto px-5">
      {/* Header */}
      <header className="flex items-center justify-between pt-8 pb-4 border-b border-white/5">
        <button
          type="button"
          onClick={() => router.push('/tim-chua-truoc')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-serif text-xl font-semibold text-cream">Hồ sơ của tôi</h1>
        <div className="w-10" />
      </header>

      {/* Avatar & Basic Info Card */}
      <div className="mt-6 flex flex-col items-center text-center">
        <div className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-gold/40 bg-surface2 shadow-xl shadow-gold/10">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <User size={48} />
            </div>
          )}

          <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
            />
            <Camera size={24} className="text-white" />
          </label>
        </div>

        <h2 className="mt-4 font-serif text-2xl font-bold text-cream">
          {fullName || 'Chưa đặt tên'}
        </h2>
        {userEmail && (
          <p className="text-xs text-muted mt-0.5">{userEmail}</p>
        )}
        {churchName && (
          <p className="text-xs text-gold mt-1">⛪ {churchName}</p>
        )}
      </div>

      {/* Edit toggle button */}
      <div className="mt-6">
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-full bg-surface2 py-3 text-xs font-semibold text-gold border border-gold/30 hover:bg-surface3 transition active:scale-[0.99] cursor-pointer"
          >
            Chỉnh sửa thông tin
          </button>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 rounded-3xl bg-surface p-5 border border-white/5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">
                Tên hiển thị *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={60}
                placeholder="Ví dụ: Phúc Nguyễn"
                className="w-full rounded-xl bg-surface2 px-3 py-2 text-sm text-cream outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">
                Giới tính
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full rounded-xl bg-surface2 px-3 py-2 text-sm text-cream outline-none focus:border-gold"
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">
                Hội thánh
              </label>
              <input
                type="text"
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                maxLength={80}
                placeholder="Hội thánh bạn đang sinh hoạt"
                className="w-full rounded-xl bg-surface2 px-3 py-2 text-sm text-cream outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">
                Khu vực
              </label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                maxLength={80}
                placeholder="Ví dụ: TP. Hồ Chí Minh"
                className="w-full rounded-xl bg-surface2 px-3 py-2 text-sm text-cream outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">
                Giới thiệu bản thân (Bio)
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Một vài dòng về đức tin, sở thích..."
                className="w-full rounded-xl bg-surface2 px-3 py-2 text-sm text-cream outline-none focus:border-gold resize-none"
              />
            </div>

            {/* Interests Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                Sở thích
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INTEREST_OPTIONS.map((item) => {
                  const selected = interests.includes(item)
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInterest(item)}
                      className={`rounded-full px-3 py-1 text-xs transition active:scale-95 cursor-pointer ${
                        selected
                          ? 'bg-gold text-ink font-semibold'
                          : 'bg-surface2 text-muted hover:text-cream'
                      }`}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-full bg-gold py-2.5 text-xs font-semibold text-ink shadow-md shadow-gold/20 hover:brightness-105 active:scale-95 transition cursor-pointer"
              >
                {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full bg-surface2 px-5 py-2.5 text-xs font-semibold text-muted hover:text-cream active:scale-95 transition cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Interests list if not editing */}
      {!editing && interests.length > 0 && (
        <div className="mt-6 rounded-2xl bg-surface p-4 border border-white/5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">
            Sở thích
          </p>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((it) => (
              <span
                key={it}
                className="rounded-full bg-surface2 px-3 py-1 text-xs text-cream/90 border border-white/5"
              >
                {it}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bio if not editing */}
      {!editing && bio && (
        <div className="mt-4 rounded-2xl bg-surface p-4 border border-white/5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">
            Giới thiệu
          </p>
          <p className="text-xs leading-relaxed text-cream/90 whitespace-pre-line">
            {bio}
          </p>
        </div>
      )}

      {/* Sign Out Button */}
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-rose-500/10 py-3 text-xs font-semibold text-rose-400 border border-rose-500/20 hover:bg-rose-500/15 transition active:scale-95 cursor-pointer"
      >
        <LogOut size={16} />
        <span>Đăng xuất</span>
      </button>
    </div>
  )
}
