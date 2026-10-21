'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

import imageCompression from 'browser-image-compression'

const GENDER_OPTIONS = ['Nam', 'Nữ']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'welcome' | 'form'>('welcome')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [gender, setGender] = useState('Nam')
  const [church, setChurch] = useState('')
  const [area, setArea] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/dang-nhap')
      } else {
        setUserId(user.id)
      }
    })
  }, [supabase, router])

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên hiển thị')
      return
    }

    const year = parseInt(birthYear, 10)
    const currentYear = new Date().getFullYear()
    if (!birthYear || isNaN(year) || currentYear - year < 18 || currentYear - year > 100) {
      toast.error('Bạn phải từ 18 đến 100 tuổi để sử dụng VOW')
      return
    }

    if (gender !== 'Nam' && gender !== 'Nữ') {
      toast.error('Vui lòng chọn giới tính Nam hoặc Nữ')
      return
    }

    setLoading(true)
    try {
      // Bảo đảm có UID kể cả khi state chưa kịp set (chống race condition)
      let currentUid = userId
      if (!currentUid) {
        const { data: { user } } = await supabase.auth.getUser()
        currentUid = user?.id ?? null
      }
      if (!currentUid) {
        router.push('/dang-nhap')
        throw new Error('Chưa đăng nhập')
      }

      // Upload avatar nếu có file
      let uploadedAvatarUrl: string | null = null
      if (avatarFile) {
        try {
          const compressed = await imageCompression(avatarFile, {
            maxSizeMB: 1,
            maxWidthOrHeight: 800,
            useWebWorker: true,
          })
          const path = `${currentUid}/avatar_${Date.now()}.jpg`
          const primary = await supabase.storage
            .from('profile-images')
            .upload(path, compressed, { upsert: true })

          if (!primary.error && primary.data) {
            uploadedAvatarUrl = supabase.storage
              .from('profile-images')
              .getPublicUrl(primary.data.path).data.publicUrl
          } else {
            const fallback = await supabase.storage
              .from('avatars')
              .upload(path, compressed, { upsert: true })
            if (fallback.data) {
              uploadedAvatarUrl = supabase.storage
                .from('avatars')
                .getPublicUrl(fallback.data.path).data.publicUrl
            }
          }
        } catch {
          // Nếu upload avatar lỗi, vẫn tiếp tục lưu hồ sơ để không block user
        }
      }

      const dob = `${year}-01-01`
      const genderDb = gender === 'Nam' ? 'male' : 'female'

      // Gom toàn bộ payload và update duy nhất 1 lần
      const profilePayload: Record<string, any> = {
        id: currentUid,
        full_name: name.trim(),
        username: name.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000),
        date_of_birth: dob,
        gender: genderDb,
        church_name: church.trim() || null,
        location_text: area.trim() || null,
        is_complete: true,
        updated_at: new Date().toISOString(),
      }

      if (uploadedAvatarUrl) {
        profilePayload.avatar_url = uploadedAvatarUrl
      }

      const { error } = await (supabase.from('profiles') as any).upsert(profilePayload)

      if (error) throw error

      toast.success('Hồ sơ của bạn đã sẵn sàng! Chào mừng bạn đến với VOW 🙏')
      router.push('/tim-chua-truoc')
      router.refresh()
    } catch {
      toast.error('Không thể lưu hồ sơ. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-2xl bg-surface2 border border-transparent px-4 py-3.5 text-[15px] text-cream placeholder:text-muted/60 outline-none focus:border-gold/60 transition'

  if (step === 'welcome') {
    return (
      <div className="min-h-svh bg-ink text-cream flex flex-col justify-between">
        <div className="mx-auto max-w-md w-full flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-5xl leading-tight">
            <span className="text-cream">Chào mừng</span>
            <br />
            <span className="text-gold italic">bạn mới.</span>
          </h1>

          <p className="mt-5 text-[15px] text-cream/80 font-medium">Giới thiệu về bạn</p>
          <p className="mt-2 text-sm text-muted max-w-xs leading-relaxed">
            Một vài thông tin nhỏ để cộng đồng biết bạn là ai — mất chưa đến một phút thôi.
          </p>

          <button
            type="button"
            onClick={() => setStep('form')}
            className="mt-9 w-full max-w-xs rounded-full bg-gold px-6 py-4 text-base font-semibold text-ink shadow-lg shadow-gold/20 transition hover:brightness-105 active:scale-[0.99] cursor-pointer"
          >
            Bắt đầu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-ink text-cream">
      <div className="mx-auto max-w-md px-6 py-10 pb-16">
        <h1 className="font-serif text-4xl">
          <span className="text-cream">Hồ sơ </span>
          <span className="text-gold italic">của bạn</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Điền những gì bạn muốn mọi người biết.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {/* Avatar upload (tùy chọn) */}
          <div className="flex flex-col items-center pb-2">
            <label className="relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#E8D08D]/50 bg-surface2/60 transition hover:border-[#E8D08D]">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-center p-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7 text-[#E8D08D]">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="mt-1 text-[10px] font-medium text-cream/70">Tải ảnh</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </label>
            <span className="mt-1.5 text-xs text-muted">Ảnh đại diện (tùy chọn)</span>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm text-cream/80">
              Tên hiển thị <span className="text-gold">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Phúc Nguyễn"
              maxLength={60}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-cream/80">
              Năm sinh <span className="text-gold">*</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="VD: 1995"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-cream/80">
              Giới tính <span className="text-gold">*</span>
            </span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={`${inputClass} appearance-none cursor-pointer`}
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g} className="bg-surface2">
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-cream/80">Hội thánh</span>
            <input
              type="text"
              value={church}
              onChange={(e) => setChurch(e.target.value)}
              placeholder="Hội thánh bạn đang sinh hoạt"
              maxLength={80}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-cream/80">Khu vực</span>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ví dụ: Bình Thạnh, TP.HCM"
              maxLength={80}
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full rounded-full bg-gold px-6 py-4 text-base font-semibold text-ink shadow-lg shadow-gold/20 transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Đang lưu...' : 'Hoàn tất & Khám phá VOW'}
          </button>
        </form>
      </div>
    </div>
  )
}
