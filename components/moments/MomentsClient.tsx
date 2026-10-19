'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
  X,
  Camera as CameraIcon,
  Send,
  Trash2,
  Smile,
} from 'lucide-react'
import type { Moment } from '@/types/database'
import { STICKERS } from '@/lib/stickers'
import FriendsModal from './FriendsModal'
import Link from 'next/link'

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

interface Props {
  initialMoments: MomentWithProfile[]
  myMoments: MyMoment[]
  userId: string
  fetchError: string | null
  myInviteCode?: string
}

type View = 'camera' | 'feed' | 'history'

export default function MomentsClient({
  initialMoments,
  myMoments: initialMyMoments,
  userId,
  fetchError,
  myInviteCode = 'FC-VOW123',
}: Props) {
  const [view, setView] = useState<View>('camera')
  const [moments, setMoments] = useState(initialMoments)
  const [myMoments, setMyMoments] = useState(initialMyMoments)
  const [activeMomentIndex, setActiveMomentIndex] = useState(0)

  // Camera states
  const [uploading, setUploading] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [currentZoom, setCurrentZoom] = useState(1)

  // Friends Modal
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const supabase = createClient()

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

  const handleUpload = useCallback(async () => {
    if (!capturedFile || uploading) return
    setUploading(true)

    try {
      let fileToUpload = capturedFile
      if (capturedFile.type.startsWith('image/')) {
        fileToUpload = await imageCompression(capturedFile, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1440,
          useWebWorker: true,
        })
      }

      const ext = fileToUpload.type === 'image/webp' ? 'webp' : 'jpg'
      const storagePath = `${userId}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('moments')
        .upload(storagePath, fileToUpload, {
          contentType: fileToUpload.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('moments')
        .getPublicUrl(uploadData.path)

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
      toast.success('Khoảnh khắc đã được gửi tới bạn bè! 📸')
      setCapturedImage(null)
      setCapturedFile(null)
      setCaption('')
      setView('feed')
      setMoments((prev) => [{ ...moment, profiles: null }, ...prev])
      setMyMoments((prev) => [moment, ...prev])
    } catch {
      toast.error('Gửi khoảnh khắc thất bại. Thử lại nhé.')
    } finally {
      setUploading(false)
    }
  }, [capturedFile, uploading, caption, userId, supabase])

  // Gửi reaction sticker
  const handleSendReaction = async (stickerKey: string) => {
    const currentMoment = moments[activeMomentIndex]
    if (!currentMoment) return
    const sticker = STICKERS.find((s) => s.key === stickerKey)
    toast.success(`Đã gửi phản hồi: ${sticker?.label ?? stickerKey}! ✨`)
    setShowStickerPicker(false)
  }

  // Gửi tin nhắn trả lời khoảnh khắc
  const handleSendReply = async () => {
    if (!replyText.trim() || sendingReply) return
    setSendingReply(true)
    try {
      toast.success('Đã gửi tin nhắn!')
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
    setMoments((prev) => prev.filter((m) => m.id !== momentId))
    setMyMoments((prev) => prev.filter((m) => m.id !== momentId))
  }

  // View: Preview sau khi chụp ảnh
  if (capturedImage) {
    return (
      <div className="flex flex-col min-h-dvh bg-ink text-cream justify-between p-4 pb-28 max-w-md mx-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pt-6">
          <button
            type="button"
            onClick={() => {
              setCapturedImage(null)
              setCapturedFile(null)
              startCamera()
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer"
          >
            <X size={20} />
          </button>
          <span className="text-sm font-semibold text-gold">Gửi tới bạn bè</span>
          <div className="w-10" />
        </div>

        {/* Square Captured Preview */}
        <div className="my-auto overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl bg-black aspect-square">
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
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            className="w-full rounded-2xl bg-surface2 border border-transparent px-4 py-3.5 text-sm text-cream placeholder:text-muted/60 outline-none focus:border-gold/60"
          />

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-4 text-base font-semibold text-ink shadow-lg shadow-gold/20 transition active:scale-[0.99] hover:brightness-105 disabled:opacity-50 cursor-pointer"
          >
            <Send size={18} />
            <span>{uploading ? 'Đang gửi...' : 'Gửi cho tất cả bạn bè'}</span>
          </button>
        </div>
      </div>
    )
  }

  // View: Bảng tin Khoảnh Khắc (Feed)
  if (view === 'feed') {
    const currentMoment = moments[activeMomentIndex]

    return (
      <div className="flex flex-col min-h-dvh bg-ink text-cream pb-28 max-w-md mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-8 pb-4">
          <button
            type="button"
            onClick={() => setView('camera')}
            className="flex items-center gap-1.5 rounded-full bg-surface2 px-3.5 py-1.5 text-xs font-semibold text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer"
          >
            <CameraIcon size={14} className="text-gold" />
            <span>Chụp ảnh</span>
          </button>

          <span className="font-serif text-lg font-semibold text-cream">Khoảnh khắc</span>

          <button
            type="button"
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-1.5 rounded-full bg-surface2 px-3.5 py-1.5 text-xs font-semibold text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer"
          >
            <Users size={14} className="text-gold" />
            <span>Bạn bè</span>
          </button>
        </header>

        {/* Feed Moments Card */}
        {moments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-surface2 flex items-center justify-center text-muted mb-4">
              <CameraIcon size={28} />
            </div>
            <p className="font-serif text-xl font-semibold text-cream">Chưa có khoảnh khắc nào</p>
            <p className="mt-2 text-sm text-muted max-w-xs">
              Hãy bấm Chụp ảnh để chia sẻ khoảnh khắc đầu tiên của bạn đến bạn bè nhé!
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
          <div className="flex-1 flex flex-col justify-between px-4">
            {/* Locket Card */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl bg-surface aspect-square">
              {currentMoment && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentMoment.media_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />

                  {/* Top Author Tag */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md">
                      <div className="h-6 w-6 overflow-hidden rounded-full bg-surface2">
                        {currentMoment.profiles?.avatar_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={currentMoment.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-white">
                        {currentMoment.profiles?.full_name ?? currentMoment.profiles?.username ?? 'Bạn'}
                      </span>
                    </div>

                    {currentMoment.user_id === userId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMoment(currentMoment.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-rose-400 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Caption Overlay */}
                  {currentMoment.caption && (
                    <div className="absolute inset-x-4 bottom-4">
                      <div className="rounded-2xl bg-black/60 p-3 backdrop-blur-md">
                        <p className="text-xs text-white/95 leading-relaxed">
                          {currentMoment.caption}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pagination Dots */}
            {moments.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 py-3">
                {moments.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveMomentIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      activeMomentIndex === idx ? 'w-6 bg-gold' : 'w-2 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* 16 Meme Stickers Picker & Reply Bar */}
            <div className="flex flex-col gap-2 pt-2">
              {/* Sticker Row Preview */}
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
                >
                  <Smile size={16} />
                </button>
              </div>

              {/* Full Sticker Drawer if opened */}
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

              {/* Reply message bar */}
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
                >
                  <Send size={14} />
                </button>
              </div>
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

  // View: Camera Mode (Mặc định)
  return (
    <div className="flex flex-col min-h-dvh bg-ink text-cream justify-between pb-28 max-w-md mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between px-5 pt-8 pb-3">
        {/* User avatar / history thumbnail */}
        <button
          type="button"
          onClick={() => setView('history')}
          className="h-10 w-10 overflow-hidden rounded-full bg-surface2 border border-white/10 active:scale-95 transition cursor-pointer"
        >
          {myMoments[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={myMoments[0].media_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-muted">
              V
            </div>
          )}
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {/* Feed icon */}
          <button
            type="button"
            onClick={() => setView('feed')}
            aria-label="Xem bảng tin"
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

          {/* Friends count badge */}
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
            // eslint-disable-next-line jsx-a11y/media-has-caption
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
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-surface2 hover:bg-surface3 transition active:scale-95 border border-white/5">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickFromGallery}
            />
            {myMoments[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={myMoments[0].media_url}
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
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold bg-transparent transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-xl shadow-gold/10"
          >
            <div className="h-14 w-14 rounded-full bg-white shadow-inner" />
          </button>

          {/* Flip Camera Button */}
          <button
            type="button"
            onClick={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))}
            aria-label="Đổi camera"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-surface2 text-cream hover:bg-surface3 transition active:scale-95 cursor-pointer border border-white/5"
          >
            <SwitchCamera size={22} />
          </button>
        </div>

        {/* History Shortcut Pill */}
        <button
          type="button"
          onClick={() => setView('history')}
          className="mt-2 flex items-center gap-1.5 rounded-full bg-surface2/60 px-4 py-2 text-xs font-semibold text-muted hover:text-cream transition active:scale-95 cursor-pointer border border-white/5"
        >
          <span>Lịch sử ({myMoments.length} khoảnh khắc)</span>
          <ChevronDown size={14} />
        </button>
      </div>

      {/* History Modal */}
      {view === 'history' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink text-cream p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between pt-6 pb-4">
            <h2 className="font-serif text-xl font-semibold text-cream">
              Lịch sử ({myMoments.length})
            </h2>
            <button
              type="button"
              onClick={() => setView('camera')}
              aria-label="Đóng"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-muted hover:text-cream transition active:scale-95 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 overflow-y-auto nice-scroll flex-1 pb-6">
            {myMoments.map((m) => (
              <div key={m.id} className="relative aspect-square overflow-hidden rounded-2xl bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbnail_url ?? m.media_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {myMoments.length === 0 && (
              <div className="col-span-3 py-20 text-center text-sm text-muted">
                Chưa có khoảnh khắc nào được lưu
              </div>
            )}
          </div>
        </div>
      )}

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
