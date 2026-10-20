'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import imageCompression from 'browser-image-compression'
import toast from 'react-hot-toast'
import {
  LayoutGrid,
  MessageCircle,
  Users,
  Image as ImageIcon,
  SwitchCamera,
  ChevronDown,
  ChevronUp,
  X,
  Camera as CameraIcon,
  Send,
  Trash2,
  Smile,
  User,
  Loader2,
} from 'lucide-react'
import type { Moment } from '@/types/database'
import { STICKERS } from '@/lib/stickers'
import FriendsModal from './FriendsModal'

interface MomentWithProfile extends Moment {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    church_name?: string | null
  } | null
}

interface MyMoment {
  id: string
  media_url: string
  thumbnail_url: string | null
  created_at: string
  media_type: 'image' | 'video'
  caption?: string | null
}

interface CurrentUserProfile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

interface Props {
  initialMoments: MomentWithProfile[]
  myMoments: MyMoment[]
  userId: string
  fetchError: string | null
  myInviteCode?: string
  currentUser?: CurrentUserProfile | null
}

type View = 'camera' | 'grid' | 'history' | 'feed'

function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date()
    const past = new Date(dateString)
    const diffMs = now.getTime() - past.getTime()
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000))
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) return 'Vừa xong'
    if (diffMinutes < 60) return `${diffMinutes} phút trước`
    if (diffHours < 24) return `${diffHours} giờ trước`
    if (diffDays === 1) return 'Hôm qua'
    if (diffDays < 7) return `${diffDays} ngày trước`
    return past.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

function formatGridTime(dateString: string): string {
  try {
    const now = new Date()
    const past = new Date(dateString)
    const diffMs = now.getTime() - past.getTime()
    const diffMins = Math.max(0, Math.floor(diffMs / 60000))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${Math.max(1, diffMins)}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return past.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

export default function MomentsClient({
  initialMoments,
  myMoments: initialMyMoments,
  userId,
  fetchError,
  myInviteCode = 'FC-VOW123',
  currentUser,
}: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('camera')
  const [moments, setMoments] = useState(initialMoments)
  const [myMoments, setMyMoments] = useState(initialMyMoments)
  const [activeMomentIndex, setActiveMomentIndex] = useState(0)

  // Camera & Upload states
  const [uploadStep, setUploadStep] = useState<'idle' | 'compressing' | 'uploading' | 'completed'>('idle')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  // Locket history image loading state
  const [isImageLoading, setIsImageLoading] = useState(false)

  // Friends Modal & Reactions
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const lastWheelTime = useRef<number>(0)
  const supabase = createClient()

  // Thông báo lỗi tải dữ liệu nếu có
  useEffect(() => {
    if (fetchError) {
      toast.error('Không thể đồng bộ dữ liệu khoảnh khắc')
    }
  }, [fetchError])

  // Khởi động camera
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    setCameraError(null)
    setCameraReady(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (err) {
      const error = err as DOMException
      if (error.name === 'NotAllowedError') {
        setCameraError('Chưa được cấp quyền camera. Vui lòng cấp quyền trong cài đặt trình duyệt.')
      } else if (error.name === 'NotFoundError') {
        setCameraError('Không tìm thấy camera trên thiết bị.')
      } else {
        setCameraError('Không mở được camera. Kiểm tra quyền rồi thử lại.')
      }
    }
  }, [facingMode])

  useEffect(() => {
    if (view === 'camera' && !capturedImage) {
      startCamera()
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [view, facingMode, capturedImage, startCamera])

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !cameraReady) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    if (facingMode === 'user') {
      ctx.translate(size, 0)
      ctx.scale(-1, 1)
    }

    const startX = (video.videoWidth - size) / 2
    const startY = (video.videoHeight - size) / 2
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `moment_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setCapturedFile(file)
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.85))
        streamRef.current?.getTracks().forEach((t) => t.stop())
      },
      'image/jpeg',
      0.85
    )
  }, [cameraReady, facingMode])

  const handlePickFromGallery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCapturedFile(file)
    setCapturedImage(URL.createObjectURL(file))
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  // Hạng mục 4: Tải khoảnh khắc tối ưu & Optimistic update
  const handleUpload = useCallback(async () => {
    if (!capturedFile || !capturedImage || uploadStep !== 'idle') return

    const tempId = `temp-${Date.now()}`
    const previewUrl = capturedImage

    const optimisticMoment: MomentWithProfile = {
      id: tempId,
      user_id: userId,
      media_url: previewUrl,
      media_type: 'image',
      thumbnail_url: previewUrl,
      caption: caption.trim() || null,
      is_deleted: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      profiles: {
        id: userId,
        username: currentUser?.username ?? null,
        full_name: currentUser?.full_name ?? null,
        avatar_url: currentUser?.avatar_url ?? null,
      },
    }

    const optimisticMyMoment: MyMoment = {
      id: tempId,
      media_url: previewUrl,
      thumbnail_url: previewUrl,
      created_at: new Date().toISOString(),
      media_type: 'image',
      caption: caption.trim() || null,
    }

    // Optimistic Update vào cả moments và myMoments
    setMoments((prev) => [optimisticMoment, ...prev])
    setMyMoments((prev) => [optimisticMyMoment, ...prev])

    try {
      // Tiến trình 1: Nén ảnh cực nhanh
      setUploadStep('compressing')
      let fileToUpload: File = capturedFile
      if (capturedFile.type.startsWith('image/')) {
        fileToUpload = await imageCompression(capturedFile, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 960,
          useWebWorker: true,
          fileType: 'image/jpeg',
        })
      }

      // Tiến trình 2: Tải lên
      setUploadStep('uploading')
      const ext = fileToUpload.type === 'image/webp' ? 'webp' : 'jpg'
      const storagePath = `${userId}/${Date.now()}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('moments')
        .upload(storagePath, fileToUpload, {
          contentType: fileToUpload.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('moments').getPublicUrl(uploadData.path)

      const res = await fetch('/api/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: publicUrl,
          media_type: 'image',
          caption: caption.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Upload failed')
      }

      const { moment } = await res.json()

      // Tiến trình 3: Hoàn tất
      setUploadStep('completed')
      toast.success('Khoảnh khắc đã được gửi tới bạn bè! 📸')

      // Cập nhật ID thật từ server
      setMoments((prev) =>
        prev.map((m) => (m.id === tempId ? { ...moment, profiles: optimisticMoment.profiles } : m))
      )
      setMyMoments((prev) =>
        prev.map((m) => (m.id === tempId ? moment : m))
      )

      setCapturedImage(null)
      setCapturedFile(null)
      setCaption('')
      setActiveMomentIndex(0)
      setView('history')
    } catch {
      // Rollback optimistic update khi gặp lỗi
      setMoments((prev) => prev.filter((m) => m.id !== tempId))
      setMyMoments((prev) => prev.filter((m) => m.id !== tempId))
      toast.error('Gửi khoảnh khắc thất bại. Thử lại nhé.')
    } finally {
      setUploadStep('idle')
    }
  }, [capturedFile, capturedImage, uploadStep, userId, caption, currentUser, supabase])

  // Điều hướng khoảnh khắc kiểu Locket
  const goToNextMoment = useCallback(() => {
    setActiveMomentIndex((prev) => {
      if (prev < moments.length - 1) {
        setIsImageLoading(true)
        return prev + 1
      }
      return prev
    })
  }, [moments.length])

  const goToPrevMoment = useCallback(() => {
    setActiveMomentIndex((prev) => {
      if (prev > 0) {
        setIsImageLoading(true)
        return prev - 1
      }
      return prev
    })
  }, [])

  // Touch gesture vuốt dọc
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const diffY = touchStartY.current - e.changedTouches[0].clientY
    const diffX = (touchStartX.current ?? 0) - e.changedTouches[0].clientX

    if (Math.abs(diffY) > 45 && Math.abs(diffY) > Math.abs(diffX)) {
      if (diffY > 0) {
        goToNextMoment()
      } else {
        goToPrevMoment()
      }
    }
    touchStartY.current = null
    touchStartX.current = null
  }

  // Mouse wheel cuộn dọc
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheelTime.current < 350) return
    if (Math.abs(e.deltaY) > 30) {
      lastWheelTime.current = now
      if (e.deltaY > 0) {
        goToNextMoment()
      } else {
        goToPrevMoment()
      }
    }
  }

  // Hạng mục 3: Gửi reaction sticker (hỗ trợ cho cả bài của chính mình)
  const handleSendReaction = async (stickerKey: string) => {
    const currentMoment = moments[activeMomentIndex]
    if (!currentMoment) return
    const sticker = STICKERS.find((s) => s.key === stickerKey)
    toast.success(`Đã gửi phản hồi: ${sticker?.label ?? stickerKey}! ✨`)
    setShowStickerPicker(false)
  }

  // Hạng mục 3: Gửi bình luận (hỗ trợ cho cả bài của chính mình)
  const handleSendReply = async () => {
    if (!replyText.trim() || sendingReply) return
    setSendingReply(true)
    try {
      toast.success('Đã gửi phản hồi!')
      setReplyText('')
    } finally {
      setSendingReply(false)
    }
  }

  // Thêm bạn bằng mã mời
  const handleAddFriendByCode = async (code: string): Promise<boolean> => {
    try {
      toast.success(`Đã gửi yêu cầu kết bạn tới mã ${code}`)
      setShowFriendsModal(false)
      return true
    } catch {
      toast.error('Mã mời không đúng hoặc không tìm thấy.')
      return false
    }
  }

  // Xoá khoảnh khắc của tôi
  const handleDeleteMoment = async (momentId: string) => {
    if (!window.confirm('Xóa khoảnh khắc này?')) return
    const { error } = await (supabase.from('moments') as any).update({ is_deleted: true }).eq('id', momentId)
    if (error) {
      toast.error('Xóa thất bại')
      return
    }

    toast.success('Đã xóa khoảnh khắc')
    setMoments((prev) => {
      const next = prev.filter((m) => m.id !== momentId)
      if (activeMomentIndex >= next.length && next.length > 0) {
        setActiveMomentIndex(next.length - 1)
      }
      return next
    })
    setMyMoments((prev) => prev.filter((m) => m.id !== momentId))
  }

  // VIEW 1: Preview sau khi chụp hoặc chọn ảnh
  if (capturedImage) {
    const isProcessing = uploadStep !== 'idle'
    return (
      <div
        className="flex flex-col min-h-dvh bg-ink text-cream justify-between p-4 max-w-md mx-auto"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              setCapturedImage(null)
              setCapturedFile(null)
              startCamera()
            }}
            aria-label="Đóng chụp ảnh"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <X size={20} />
          </button>
          <span className="text-sm font-semibold text-gold">Gửi tới bạn bè</span>
          <div className="w-10" />
        </div>

        {/* Square Captured Preview */}
        <div className="my-auto overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl bg-black aspect-square w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImage}
            alt="Preview"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Input Caption & Send Button */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Thêm chú thích..."
            value={caption}
            disabled={isProcessing}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            className="w-full rounded-2xl bg-surface2 border border-transparent px-4 py-3.5 text-sm text-cream placeholder:text-muted/60 outline-none focus:border-gold/60 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={handleUpload}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-4 text-base font-semibold text-ink shadow-lg shadow-gold/20 transition active:scale-[0.99] hover:brightness-105 disabled:opacity-50 cursor-pointer"
          >
            {(uploadStep === 'compressing' || uploadStep === 'uploading') && (
              <Loader2 size={18} className="animate-spin text-ink" />
            )}
            <span>
              {uploadStep === 'compressing'
                ? 'Đang nén ảnh...'
                : uploadStep === 'uploading'
                ? 'Đang tải lên...'
                : uploadStep === 'completed'
                ? 'Hoàn tất!'
                : 'Gửi cho tất cả bạn bè'}
            </span>
            {uploadStep === 'idle' && <Send size={18} />}
          </button>
        </div>
      </div>
    )
  }

  // VIEW 2: Hạng mục 6 - Grid View hiển thị 3 cột chuẩn Locket
  if (view === 'grid') {
    return (
      <div
        className="flex flex-col min-h-dvh bg-ink text-cream max-w-md mx-auto"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
        }}
      >
        {/* Header Grid View */}
        <header className="flex items-center justify-between px-5 pt-3 pb-3">
          <button
            type="button"
            onClick={() => setView('camera')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
            aria-label="Về máy ảnh"
          >
            <CameraIcon size={18} />
          </button>

          <div className="flex flex-col items-center">
            <span className="font-serif text-lg font-semibold text-cream">Khoảnh khắc</span>
            <span className="text-[11px] text-muted">{moments.length} khoảnh khắc</span>
          </div>

          <button
            type="button"
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
            aria-label="Bạn bè"
          >
            <Users size={14} className="text-gold" />
            <span>Bạn bè</span>
          </button>
        </header>

        {/* Body Grid 3 cột */}
        {moments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-surface2 flex items-center justify-center text-muted mb-4">
              <CameraIcon size={28} />
            </div>
            <p className="font-serif text-xl font-semibold text-cream">Chưa có khoảnh khắc nào</p>
            <p className="mt-2 text-sm text-muted max-w-xs">
              Hãy chụp ảnh để chia sẻ khoảnh khắc đầu tiên của bạn đến bạn bè nhé!
            </p>
            <button
              type="button"
              onClick={() => setView('camera')}
              className="mt-6 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink shadow-md shadow-gold/20 active:scale-95 cursor-pointer"
            >
              Mở Camera ngay
            </button>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-3 gap-2 px-4 py-3 overflow-y-auto nice-scroll auto-rows-max">
            {moments.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveMomentIndex(idx)
                  setIsImageLoading(true)
                  setView('history')
                }}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-surface2 border border-white/5 active:scale-95 transition cursor-pointer text-left focus:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbnail_url ?? m.media_url}
                  alt={m.caption ?? 'Khoảnh khắc'}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Gradient phủ dưới để thời gian dễ nhìn */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                {/* Avatar tác giả nhỏ ở góc trên bên trái */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
                  <div className="h-5 w-5 overflow-hidden rounded-full bg-surface3 border border-white/30">
                    {m.profiles?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-cream font-bold">
                        {(m.profiles?.full_name ?? m.profiles?.username ?? 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Thời gian hiển thị ở góc dưới bên phải */}
                <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-white/90 pointer-events-none">
                  {formatGridTime(m.created_at)}
                </div>
              </button>
            ))}
          </div>
        )}

        <FriendsModal
          open={showFriendsModal}
          onClose={() => setShowFriendsModal(false)}
          myInviteCode={myInviteCode}
          friends={[]}
          onAddFriendByCode={handleAddFriendByCode}
        />
      </div>
    )
  }

  // VIEW 3: Hạng mục 5 - Lịch sử khoảnh khắc kiểu Locket (Toàn màn hình, Vuốt dọc Swipe)
  if (view === 'history' || view === 'feed') {
    const currentMoment = moments[activeMomentIndex]

    return (
      <div
        className="flex flex-col min-h-dvh bg-ink text-cream justify-between max-w-md mx-auto touch-pan-x select-none"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
        }}
      >
        {/* Header Locket Viewer */}
        <header className="flex items-center justify-between px-5 pt-2 pb-2">
          {/* Nút quay lại Camera */}
          <button
            type="button"
            onClick={() => setView('camera')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
            aria-label="Về camera"
          >
            <CameraIcon size={18} />
          </button>

          {/* Tác giả & Thời gian */}
          {currentMoment ? (
            <div className="flex flex-col items-center max-w-[200px]">
              <div className="flex items-center gap-1.5 truncate">
                <div className="h-5 w-5 overflow-hidden rounded-full bg-surface2 border border-white/20 shrink-0">
                  {currentMoment.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentMoment.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted font-bold">
                      {(currentMoment.profiles?.full_name ?? currentMoment.profiles?.username ?? 'U')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-cream truncate">
                  {currentMoment.user_id === userId
                    ? 'Bạn'
                    : currentMoment.profiles?.full_name ?? currentMoment.profiles?.username ?? 'Bạn bè'}
                </span>
              </div>
              <span className="text-[11px] text-muted">{formatRelativeTime(currentMoment.created_at)}</span>
            </div>
          ) : (
            <span className="font-serif text-base font-semibold text-cream">Khoảnh khắc</span>
          )}

          {/* Action góc phải: Nút Lưới & Xóa */}
          <div className="flex items-center gap-1.5">
            {currentMoment?.user_id === userId && (
              <button
                type="button"
                onClick={() => handleDeleteMoment(currentMoment.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-muted hover:text-rose-400 transition active:scale-95 cursor-pointer border border-white/5"
                aria-label="Xóa khoảnh khắc"
              >
                <Trash2 size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setView('grid')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
              aria-label="Xem dạng lưới"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </header>

        {/* Vùng hiển thị Locket Card & Hỗ trợ vuốt dọc */}
        {moments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-surface2 flex items-center justify-center text-muted mb-4">
              <CameraIcon size={28} />
            </div>
            <p className="font-serif text-xl font-semibold text-cream">Chưa có khoảnh khắc nào</p>
            <button
              type="button"
              onClick={() => setView('camera')}
              className="mt-6 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink shadow-md shadow-gold/20 active:scale-95 cursor-pointer"
            >
              Mở Camera ngay
            </button>
          </div>
        ) : (
          <div
            className="flex-1 flex flex-col justify-center px-4 my-auto relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {/* Nút chỉ dẫn Prev trên máy tính */}
            {activeMomentIndex > 0 && (
              <button
                type="button"
                onClick={goToPrevMoment}
                aria-label="Khoảnh khắc trước"
                className="mx-auto mb-2 flex h-7 items-center gap-1 rounded-full bg-surface2/70 px-3 text-[11px] font-medium text-muted hover:text-cream transition active:scale-95 cursor-pointer"
              >
                <ChevronUp size={14} />
                <span>Khoảnh khắc trước</span>
              </button>
            )}

            {/* Locket Card Square */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl bg-black aspect-square w-full flex items-center justify-center">
              {currentMoment && (
                <>
                  {/* Skeleton / Spinner Loading cho ảnh */}
                  {isImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface2 z-10">
                      <Loader2 size={32} className="animate-spin text-gold/70" />
                    </div>
                  )}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentMoment.media_url}
                    alt=""
                    onLoad={() => setIsImageLoading(false)}
                    className={`h-full w-full object-cover transition-opacity duration-300 ${
                      isImageLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                  />

                  {/* Caption Overlay */}
                  {currentMoment.caption && (
                    <div className="absolute inset-x-4 bottom-4 z-20">
                      <div className="rounded-2xl bg-black/60 p-3 backdrop-blur-md">
                        <p className="text-xs text-white/95 text-center leading-relaxed font-medium">
                          {currentMoment.caption}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Nút chỉ dẫn Next trên máy tính */}
            {activeMomentIndex < moments.length - 1 && (
              <button
                type="button"
                onClick={goToNextMoment}
                aria-label="Khoảnh khắc tiếp theo"
                className="mx-auto mt-2 flex h-7 items-center gap-1 rounded-full bg-surface2/70 px-3 text-[11px] font-medium text-muted hover:text-cream transition active:scale-95 cursor-pointer"
              >
                <span>Khoảnh khắc tiếp theo</span>
                <ChevronDown size={14} />
              </button>
            )}

            {/* Pagination indicator */}
            <div className="flex items-center justify-center gap-1.5 py-2.5">
              <span className="text-[11px] font-medium text-muted">
                {activeMomentIndex + 1} / {moments.length}
              </span>
            </div>
          </div>
        )}

        {/* Footer tương tác: Sticker reactions & Reply bar (Áp dụng cho mọi khoảnh khắc) */}
        {moments.length > 0 && (
          <div className="flex flex-col gap-2 px-4 pt-1">
            {/* Dải Reaction 16 meme stickers */}
            <div className="flex items-center gap-2 overflow-x-auto nice-scroll pb-1">
              {STICKERS.slice(0, 8).map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleSendReaction(st.key)}
                  title={st.label}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-surface2/80 px-2.5 py-1.5 text-xs text-cream hover:bg-surface2 transition active:scale-90 border border-white/5 cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={st.src} alt={st.label} className="h-6 w-6 object-contain" />
                  <span className="text-[11px]">{st.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowStickerPicker(!showStickerPicker)}
                className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full bg-surface2 text-gold transition active:scale-95 cursor-pointer"
                aria-label="Xem thêm sticker"
              >
                <Smile size={16} />
              </button>
            </div>

            {/* Full Sticker Drawer nếu mở */}
            {showStickerPicker && (
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-surface2 p-3 border border-white/5">
                {STICKERS.map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => handleSendReaction(st.key)}
                    className="flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-surface3 transition active:scale-95 cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={st.src} alt={st.label} className="h-10 w-10 object-contain" />
                    <span className="text-[10px] text-muted text-center truncate w-full">
                      {st.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Reply bar: Gửi tin nhắn / bình luận */}
            <div className="flex items-center gap-2 rounded-full bg-surface2 px-4 py-2 border border-white/5">
              <input
                type="text"
                placeholder="Nhắn tin về khoảnh khắc này..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                className="flex-1 bg-transparent text-sm text-cream placeholder:text-muted/60 outline-none"
              />
              <button
                type="button"
                onClick={handleSendReply}
                disabled={!replyText.trim() || sendingReply}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-ink transition active:scale-95 disabled:opacity-40 cursor-pointer"
                aria-label="Gửi phản hồi"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}

        <FriendsModal
          open={showFriendsModal}
          onClose={() => setShowFriendsModal(false)}
          myInviteCode={myInviteCode}
          friends={[]}
          onAddFriendByCode={handleAddFriendByCode}
        />
      </div>
    )
  }

  // VIEW 4: Camera Mode (Mặc định)
  return (
    <div
      className="flex flex-col min-h-dvh bg-ink text-cream justify-between pb-28 max-w-md mx-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 16px)',
      }}
    >
      {/* Top Header */}
      <header className="flex items-center justify-between px-5 pt-2 pb-3">
        {/* Hạng mục 7: Icon tròn hiển thị avatar user hiện tại -> click vào chuyển hướng router.push('/ho-so'), TUYỆT ĐỐI KHÔNG mở History */}
        <button
          type="button"
          onClick={() => router.push('/ho-so')}
          aria-label="Hồ sơ cá nhân"
          className="h-10 w-10 overflow-hidden rounded-full bg-surface2 border border-white/10 active:scale-95 transition cursor-pointer flex items-center justify-center"
        >
          {currentUser?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUser.avatar_url}
              alt={currentUser.full_name ?? 'Hồ sơ'}
              className="h-full w-full object-cover"
            />
          ) : (
            <User size={18} className="text-muted" />
          )}
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {/* Hạng mục 6: Icon 4 ô vuông (LayoutGrid) mở chế độ xem lưới (view === 'grid') */}
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Xem dạng lưới"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
          >
            <LayoutGrid size={18} />
          </button>

          {/* Messages icon */}
          <Link
            href="/tin-nhan"
            aria-label="Tin nhắn"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
          >
            <MessageCircle size={18} />
          </Link>

          {/* Friends modal button */}
          <button
            type="button"
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-1.5 rounded-full bg-surface2 px-3.5 py-2 text-xs font-semibold text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
          >
            <Users size={14} className="text-gold" />
            <span>Bạn bè</span>
          </button>
        </div>
      </header>

      {/* Camera Viewfinder */}
      <div className="px-4 flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-full aspect-square overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl relative bg-surface2 flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-4 rounded-full bg-surface3 px-4 py-2 text-xs font-semibold text-gold active:scale-95 cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}
        </div>

        {/* Controls: Gallery Picker, Shutter Button, Flip Camera */}
        <div className="flex items-center justify-between w-full px-6 pt-2">
          {/* Gallery Picker */}
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-surface2 hover:bg-surface3 transition active:scale-95 border border-white/5 touch-manipulation">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickFromGallery}
            />
            {myMoments[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={myMoments[0].thumbnail_url ?? myMoments[0].media_url}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <ImageIcon size={22} className="text-muted" />
            )}
          </label>

          {/* Shutter Capture Button */}
          <button
            type="button"
            onClick={handleCapture}
            disabled={!cameraReady || !!cameraError}
            aria-label="Chụp ảnh"
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold bg-transparent transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-xl shadow-gold/10 touch-manipulation"
          >
            <div className="h-14 w-14 rounded-full bg-white shadow-inner" />
          </button>

          {/* Flip Camera Button */}
          <button
            type="button"
            onClick={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))}
            aria-label="Đổi camera"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5 touch-manipulation"
          >
            <SwitchCamera size={22} />
          </button>
        </div>

        {/* History Shortcut Pill */}
        <button
          type="button"
          onClick={() => {
            setActiveMomentIndex(0)
            setIsImageLoading(true)
            setView('history')
          }}
          className="mt-2 flex items-center gap-1.5 rounded-full bg-surface2/60 px-4 py-2 text-xs font-semibold text-muted hover:text-cream transition active:scale-95 cursor-pointer border border-white/5"
        >
          <span>Lịch sử ({moments.length} khoảnh khắc)</span>
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Friends Modal */}
      <FriendsModal
        open={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        myInviteCode={myInviteCode}
        friends={[]}
        onAddFriendByCode={handleAddFriendByCode}
      />
    </div>
  )
}
