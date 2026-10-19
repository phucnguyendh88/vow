'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import imageCompression from 'browser-image-compression'
import toast from 'react-hot-toast'
import { LayoutGrid, MessageCircle, Users, Image as ImageIcon, SwitchCamera, ChevronDown, X } from 'lucide-react'
import type { Moment } from '@/types/database'

interface MomentWithProfile extends Moment {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface MyMoment {
  id: string
  media_url: string
  thumbnail_url: string | null
  created_at: string
  media_type: 'image' | 'video'
}

interface Props {
  initialMoments: MomentWithProfile[]
  myMoments: MyMoment[]
  userId: string
  fetchError: string | null
}

type View = 'camera' | 'feed' | 'history'

export default function MomentsClient({ initialMoments, myMoments, userId, fetchError }: Props) {
  const [view, setView] = useState<View>('camera')
  const [moments, setMoments] = useState(initialMoments)
  const [uploading, setUploading] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [availableZooms, setAvailableZooms] = useState<number[]>([1])
  const [currentZoom, setCurrentZoom] = useState(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const supabase = createClient()

  // Khởi động camera
  const startCamera = useCallback(async () => {
    // Dừng stream cũ nếu có
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    setCameraError(null)
    setCameraReady(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      })
      streamRef.current = stream

      // Kiểm tra zoom capabilities thực sự của thiết bị
      const track = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number } }
      if (capabilities?.zoom) {
        const { min, max } = capabilities.zoom
        const zooms: number[] = []
        if (min <= 1 && 1 <= max) zooms.push(1)
        if (min <= 2 && 2 <= max) zooms.push(2)
        setAvailableZooms(zooms.length > 0 ? zooms : [1])
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (err) {
      const error = err as DOMException
      if (error.name === 'NotAllowedError') {
        setCameraError('Bạn chưa cấp quyền camera. Vào cài đặt trình duyệt để cho phép.')
      } else if (error.name === 'NotFoundError') {
        setCameraError('Thiết bị không có camera.')
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera đang được ứng dụng khác sử dụng.')
      } else {
        setCameraError('Không thể khởi động camera.')
      }
    }
  }, [facingMode])

  // Dừng camera khi unmount
  useEffect(() => {
    if (view === 'camera') {
      startCamera()
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [view, facingMode, startCamera])

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !cameraReady) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')!
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(videoRef.current, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `moment_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setCapturedFile(file)
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.8))
        // Dừng camera sau khi chụp
        streamRef.current?.getTracks().forEach((t) => t.stop())
      },
      'image/jpeg',
      0.8
    )
  }, [cameraReady, facingMode])

  const handlePickFromGallery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCapturedFile(file)
    setCapturedImage(URL.createObjectURL(file))
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const handleUpload = useCallback(async () => {
    if (!capturedFile || uploading) return
    setUploading(true)

    try {
      // Compress image trước khi upload
      let fileToUpload = capturedFile
      if (capturedFile.type.startsWith('image/')) {
        fileToUpload = await imageCompression(capturedFile, {
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        })
      }

      // Upload lên Storage
      const ext = fileToUpload.type === 'image/webp' ? 'webp' : 'jpg'
      const storagePath = `${userId}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('moments')
        .upload(storagePath, fileToUpload, {
          contentType: fileToUpload.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Lấy public URL
      const { data: { publicUrl } } = supabase.storage
        .from('moments')
        .getPublicUrl(uploadData.path)

      // Gọi API để lưu metadata vào DB
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
        const err = await res.json()
        throw new Error(err.error ?? 'Upload failed')
      }

      const { moment } = await res.json()
      toast.success('Khoảnh khắc đã được chia sẻ! 📸')
      setCapturedImage(null)
      setCapturedFile(null)
      setCaption('')
      setView('feed')
      setMoments((prev) => [{ ...moment, profiles: null }, ...prev])
    } catch (err) {
      console.error(err)
      toast.error('Chia sẻ thất bại. Vui lòng thử lại.')
    } finally {
      setUploading(false)
    }
  }, [capturedFile, uploading, caption, userId, supabase])

  // === RENDER ===

  if (capturedImage) {
    return (
      <div className="flex flex-col min-h-dvh bg-black">
        <div className="relative flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImage}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => { setCapturedImage(null); setCapturedFile(null); startCamera() }}
            aria-label="Đóng"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3" style={{ background: 'var(--background)' }}>
          <input
            type="text"
            placeholder="Thêm chú thích..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
            className="w-full bg-transparent border-b py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-4 rounded-2xl font-semibold text-black disabled:opacity-50"
            style={{ background: 'var(--gold)' }}
          >
            {uploading ? 'Đang chia sẻ...' : 'Chia sẻ khoảnh khắc'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Camera Header */}
      <header className="flex items-center justify-between px-4 pt-14 pb-4">
        <div className="w-10 h-10 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          {myMoments[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={myMoments[0].media_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('feed')}
            aria-label="Xem bảng tin"
            className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
          >
            <LayoutGrid size={18} />
          </button>
          <a
            href="/tin-nhan"
            aria-label="Tin nhắn"
            className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
          >
            <MessageCircle size={18} />
          </a>
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
          >
            <Users size={14} className="text-gold" />
            <span>{moments.length} Bạn</span>
          </button>
        </div>
      </header>

      {/* Camera Viewfinder */}
      <div className="px-4 flex-1 flex flex-col items-center gap-4">
        <div className="w-full aspect-square camera-viewfinder relative" style={{ background: 'var(--surface-2)' }}>
          {cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{cameraError}</p>
            </div>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}
        </div>

        {/* Zoom selector */}
        {availableZooms.length > 1 && (
          <div className="flex items-center gap-2">
            {availableZooms.map((z) => (
              <button
                key={z}
                onClick={() => setCurrentZoom(z)}
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  background: currentZoom === z ? 'var(--gold)' : 'var(--surface-2)',
                  color: currentZoom === z ? '#000' : 'var(--foreground)',
                }}
              >
                {z}x
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between w-full pb-4">
          {/* Gallery picker */}
          <label className="w-14 h-14 rounded-full overflow-hidden cursor-pointer flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handlePickFromGallery}
            />
            {myMoments[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={myMoments[0].media_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={22} className="text-muted" />
            )}
          </label>

          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={!cameraReady || !!cameraError}
            className="w-20 h-20 rounded-full border-4 flex items-center justify-center disabled:opacity-40 cursor-pointer transition active:scale-95"
            style={{ borderColor: 'var(--gold)', background: 'transparent' }}
          >
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>

          {/* Flip camera */}
          <button
            onClick={() => setFacingMode((f) => f === 'user' ? 'environment' : 'user')}
            aria-label="Đổi camera"
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl cursor-pointer transition active:scale-95"
            style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
          >
            <SwitchCamera size={22} />
          </button>
        </div>

        {/* History label */}
        <button
          onClick={() => setView('history')}
          className="text-xs font-medium flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer transition-colors"
          style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
        >
          <span>Lịch sử ({myMoments.length} khoảnh khắc)</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
      </div>

      {/* History Modal */}
      {view === 'history' && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'var(--background)' }}
        >
          <div className="flex items-center justify-between px-4 pt-14 pb-4">
            <h2 className="text-lg font-semibold text-white">Khoảnh khắc</h2>
            <button
              onClick={() => setView('camera')}
              aria-label="Đóng"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white"
              style={{ background: 'var(--surface-2)' }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-0.5 overflow-y-auto">
            {myMoments.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.thumbnail_url ?? m.media_url}
                alt=""
                className="aspect-square object-cover w-full"
                loading="lazy"
              />
            ))}
            {myMoments.length === 0 && (
              <div className="col-span-3 py-20 text-center" style={{ color: 'var(--text-muted)' }}>
                Chưa có khoảnh khắc nào
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
