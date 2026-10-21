'use client'

import { fastSignOut } from '@/lib/auth-fast'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Camera, LogOut, Plus, X, Church, MapPin, Loader2 } from 'lucide-react'
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Form states
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const currentDobYear = profile?.date_of_birth ? profile.date_of_birth.split('-')[0] : ''
  const [birthYear, setBirthYear] = useState(currentDobYear)
  const [gender, setGender] = useState<'male' | 'female'>(
    profile?.gender === 'female' ? 'female' : 'male'
  )
  const [churchName, setChurchName] = useState(profile?.church_name ?? '')
  const [locationText, setLocationText] = useState(profile?.location_text ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [photos, setPhotos] = useState<string[]>(profile?.photos ?? [])

  const birthYearNum = profile?.date_of_birth ? parseInt(profile.date_of_birth.split('-')[0], 10) : null
  const age = birthYearNum && !isNaN(birthYearNum) ? new Date().getFullYear() - birthYearNum : null

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    )
  }

  // Helper upload file to Supabase Storage with bucket fallback and clean name
  const uploadToStorage = async (file: File, prefix: string, effectiveUid: string): Promise<string> => {
    // 1. Bước nén ảnh với fallback an toàn
    let fileToUpload: File | Blob = file
    try {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: prefix === 'avatar' ? 1 : 1.5,
        maxWidthOrHeight: prefix === 'avatar' ? 800 : 1200,
        useWebWorker: true,
      })
    } catch (compressionErr) {
      console.warn('Image compression fallback to original file:', compressionErr)
      fileToUpload = file
    }

    // 2. Chuẩn hóa đường dẫn file theo user ID và clean filename
    const cleanFileName = (file.name || `${prefix}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${effectiveUid}/${Date.now()}-${cleanFileName}`
    const uploadOptions = {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    }

    // 3. Upload vào bucket profile-images (fallback sang avatars nếu cần)
    let publicUrl = ''
    const primary = await supabase.storage
      .from('profile-images')
      .upload(filePath, fileToUpload, uploadOptions)

    if (!primary.error && primary.data) {
      publicUrl = supabase.storage.from('profile-images').getPublicUrl(primary.data.path).data.publicUrl
    } else {
      const fallback = await supabase.storage
        .from('avatars')
        .upload(filePath, fileToUpload, uploadOptions)

      if (fallback.error || !fallback.data) {
        const errorDetail = primary.error || fallback.error || new Error('Upload Storage thất bại')
        throw errorDetail
      }
      publicUrl = supabase.storage.from('avatars').getPublicUrl(fallback.data.path).data.publicUrl
    }

    return publicUrl
  }

  // Upload avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)

    try {
      let effectiveUid = userId
      if (!effectiveUid) {
        const { data: { user } } = await supabase.auth.getUser()
        effectiveUid = user?.id || ''
      }
      if (!effectiveUid) {
        throw new Error('Chưa đăng nhập hoặc không xác định được User ID')
      }

      const publicUrl = await uploadToStorage(file, 'avatar', effectiveUid)

      setAvatarUrl(publicUrl)
      const { error } = await (supabase.from('profiles') as any)
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', effectiveUid)

      if (error) throw error

      toast.success('Đã cập nhật ảnh đại diện')
    } catch (err: any) {
      const errMsg = err?.message || err?.error_description || (typeof err === 'string' ? err : JSON.stringify(err))
      console.error('Avatar upload error:', err)
      toast.error('Tải ảnh thất bại: ' + errMsg)
    } finally {
      setUploadingAvatar(false)
    }
  }

  // Upload photo to album (max 6)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photos.length >= 6) {
      toast.error('Tối đa 6 ảnh trong album hồ sơ')
      return
    }

    setUploadingPhoto(true)
    try {
      let effectiveUid = userId
      if (!effectiveUid) {
        const { data: { user } } = await supabase.auth.getUser()
        effectiveUid = user?.id || ''
      }
      if (!effectiveUid) {
        throw new Error('Chưa đăng nhập hoặc không xác định được User ID')
      }

      const publicUrl = await uploadToStorage(file, 'photo', effectiveUid)

      const updatedPhotos = [...photos, publicUrl].slice(0, 6)
      setPhotos(updatedPhotos)

      const { error } = await (supabase.from('profiles') as any)
        .update({ photos: updatedPhotos, updated_at: new Date().toISOString() })
        .eq('id', effectiveUid)

      if (error) throw error
      toast.success('Đã thêm ảnh vào hồ sơ')
    } catch (err: any) {
      const errMsg = err?.message || err?.error_description || (typeof err === 'string' ? err : JSON.stringify(err))
      console.error('Photo upload error:', err)
      toast.error('Tải ảnh thất bại: ' + errMsg)
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Delete photo from album
  const handleDeletePhoto = async (indexToDelete: number) => {
    if (!window.confirm('Bạn có muốn xóa ảnh này khỏi hồ sơ?')) return
    const updatedPhotos = photos.filter((_, idx) => idx !== indexToDelete)
    setPhotos(updatedPhotos)

    try {
      let effectiveUid = userId
      if (!effectiveUid) {
        const { data: { user } } = await supabase.auth.getUser()
        effectiveUid = user?.id || ''
      }

      const { error } = await (supabase.from('profiles') as any)
        .update({ photos: updatedPhotos, updated_at: new Date().toISOString() })
        .eq('id', effectiveUid)

      if (error) throw error
      toast.success('Đã xóa ảnh')
    } catch (err: any) {
      const errMsg = err?.message || err?.error_description || (typeof err === 'string' ? err : JSON.stringify(err))
      console.error('Delete photo error:', err)
      toast.error('Không thể cập nhật ảnh: ' + errMsg)
      setPhotos(photos)
    }
  }

  // Save profile edits
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị')
      return
    }

    const year = parseInt(birthYear, 10)
    const currentYear = new Date().getFullYear()
    if (!birthYear || isNaN(year) || currentYear - year < 18 || currentYear - year > 100) {
      toast.error('Bạn phải từ 18 đến 100 tuổi để sử dụng VOW')
      return
    }

    setSaving(true)

    try {
      let effectiveUid = userId
      if (!effectiveUid) {
        const { data: { user } } = await supabase.auth.getUser()
        effectiveUid = user?.id || ''
      }
      if (!effectiveUid) {
        throw new Error('Chưa đăng nhập hoặc không xác định được User ID')
      }

      const dob = `${year}-01-01`
      const updates = {
        full_name: fullName.trim(),
        date_of_birth: dob,
        gender,
        church_name: churchName.trim() || null,
        location_text: locationText.trim() || null,
        bio: bio.trim() || null,
        interests,
        photos,
        is_complete: true,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await (supabase.from('profiles') as any)
        .update(updates)
        .eq('id', effectiveUid)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      setEditing(false)
      toast.success('Đã lưu hồ sơ thành công!')
    } catch (err: any) {
      const errMsg = err?.message || err?.error_description || (typeof err === 'string' ? err : JSON.stringify(err))
      console.error('Save profile error:', err)
      toast.error('Lưu hồ sơ thất bại: ' + errMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    if (!window.confirm('Bạn có chắc muốn đăng xuất khỏi VOW?')) return
    await fastSignOut('/')
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[#050505] text-[#F0F0F0] pb-32 max-w-md mx-auto px-5">
      {/* Top Header */}
      <header className="flex items-center justify-between pt-6 pb-4 border-b border-[rgba(232,208,141,0.15)]">
        <button
          type="button"
          onClick={() => router.push('/tim-chua-truoc')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(232,208,141,0.2)] bg-white/[0.03] text-cream hover:bg-white/[0.08] transition active:scale-95 cursor-pointer shadow-md"
        >
          <ArrowLeft size={18} />
        </button>

        <h1 className="font-serif text-xl font-bold tracking-wide text-cream">Hồ sơ</h1>

        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="rounded-full border border-[rgba(232,208,141,0.3)] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-[#E8D08D] hover:bg-white/[0.08] transition active:scale-95 cursor-pointer shadow-md"
        >
          {editing ? 'Hủy' : 'Chỉnh sửa'}
        </button>
      </header>

      {/* Avatar & Core Profile Info */}
      <div className="mt-6 flex flex-col items-center text-center">
        <div className="relative h-28 w-28 rounded-full border-2 border-[#E8D08D] bg-surface2 shadow-[0_0_20px_rgba(232,208,141,0.25)]">
          <div className="h-full w-full rounded-full overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-3xl font-bold text-[#E8D08D]">
                {fullName?.charAt(0) || 'V'}
              </div>
            )}
          </div>

          <label
            aria-label="Thay đổi ảnh đại diện"
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#E8D08D] text-black shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
            />
            {uploadingAvatar ? (
              <Loader2 size={16} className="animate-spin text-black" />
            ) : (
              <Camera size={16} />
            )}
          </label>
        </div>

        <h2 className="mt-3 font-serif text-2xl font-bold text-white tracking-wide">
          {fullName || 'Chưa đặt tên'}
          {age ? `, ${age}` : ''}
        </h2>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-300">
          {churchName && (
            <span className="flex items-center gap-1 text-[#E8D08D]">
              <Church size={14} />
              {churchName}
            </span>
          )}
          {locationText && (
            <span className="flex items-center gap-1 text-neutral-400">
              <MapPin size={14} />
              {locationText}
            </span>
          )}
        </div>
        {userEmail && (
          <p className="mt-1.5 text-xs text-neutral-400 font-mono">{userEmail}</p>
        )}
      </div>

      {/* ẢNH HỒ SƠ Section (Grid 6 Slots) */}
      <div className="mt-7">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#E8D08D] uppercase">
            ẢNH HỒ SƠ
          </span>
          <span className="text-xs text-neutral-400 font-mono">
            {photos.length}/6
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {photos.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[rgba(232,208,141,0.25)] bg-[#121216] shadow-md group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Ảnh ${idx + 1}`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <button
                type="button"
                onClick={() => handleDeletePhoto(idx)}
                aria-label={`Xóa ảnh ${idx + 1}`}
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white/90 hover:bg-red-500 hover:text-white transition shadow active:scale-90 cursor-pointer"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
          ))}

          {photos.length < 6 && (
            <label className="relative aspect-[3/4] flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(232,208,141,0.35)] bg-white/[0.02] hover:bg-white/[0.05] transition active:scale-95 cursor-pointer text-center p-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
              {uploadingPhoto ? (
                <Loader2 size={24} className="animate-spin text-[#E8D08D]" />
              ) : (
                <>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(232,208,141,0.12)] text-[#E8D08D] mb-1.5">
                    <Plus size={20} />
                  </div>
                  <span className="text-[11px] font-medium text-neutral-300">Thêm ảnh</span>
                </>
              )}
            </label>
          )}
        </div>
      </div>

      {/* Profile Form (Edit mode) or Info Details (View mode) */}
      {editing ? (
        <form onSubmit={handleSave} className="mt-7 space-y-4 rounded-3xl border border-[rgba(232,208,141,0.2)] bg-white/[0.03] p-5 backdrop-blur-md shadow-xl">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#E8D08D] mb-1.5">
              Tên hiển thị *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={60}
              placeholder="Ví dụ: Phúc Nguyễn"
              className="w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#E8D08D]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#E8D08D] mb-1.5">
                Năm sinh *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="VD: 1988"
                className="w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#E8D08D]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#E8D08D] mb-1.5">
                Giới tính *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                className="w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#E8D08D] cursor-pointer"
              >
                <option value="male" className="bg-[#121216]">Nam</option>
                <option value="female" className="bg-[#121216]">Nữ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#E8D08D] mb-1.5">
              Hội thánh
            </label>
            <input
              type="text"
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
              maxLength={80}
              placeholder="Hội thánh bạn đang sinh hoạt"
              className="w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#E8D08D]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#E8D08D] mb-1.5">
              Khu vực
            </label>
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              maxLength={80}
              placeholder="Ví dụ: Bình Thạnh, TP.HCM"
              className="w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#E8D08D]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#E8D08D] mb-1.5">
              Giới thiệu bản thân (Bio)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Một vài dòng về đức tin, sở thích..."
              className="w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#E8D08D] resize-none"
            />
          </div>

          {/* Interests Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#E8D08D] mb-2">
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
                        ? 'bg-[#E8D08D] text-black font-semibold shadow-[0_0_8px_rgba(232,208,141,0.4)]'
                        : 'border border-white/10 bg-white/[0.03] text-neutral-300 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2.5 pt-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full bg-[#E8D08D] py-3 text-xs font-bold text-black shadow-lg shadow-[#E8D08D]/20 hover:brightness-105 active:scale-95 transition cursor-pointer"
            >
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-semibold text-neutral-300 hover:text-white active:scale-95 transition cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          {bio && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[11px] font-bold tracking-[0.18em] text-[#E8D08D] uppercase mb-1.5">
                GIỚI THIỆU
              </p>
              <p className="text-sm leading-relaxed text-cream/90 whitespace-pre-line">
                {bio}
              </p>
            </div>
          )}

          {interests.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[11px] font-bold tracking-[0.18em] text-[#E8D08D] uppercase mb-2">
                SỞ THÍCH
              </p>
              <div className="flex flex-wrap gap-1.5">
                {interests.map((it) => (
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

      {/* Sign Out Button in Glass Card */}
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition active:scale-98 cursor-pointer shadow-lg"
      >
        <LogOut size={16} />
        <span>Đăng xuất</span>
      </button>
    </div>
  )
}
