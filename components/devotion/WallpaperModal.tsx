'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Download } from 'lucide-react'

export interface WallpaperVerse {
  reference: string
  text: string
}

export const SAMPLE_VERSES: WallpaperVerse[] = [
  {
    reference: 'I Giăng 4:19',
    text: 'Chúng ta yêu, vì Chúa đã yêu chúng ta trước.',
  },
  {
    reference: 'Ma-thi-ơ 6:33',
    text: 'Nhưng trước hết, hãy tìm kiếm nước Đức Chúa Trời và sự công bình của Ngài, thì Ngài sẽ cho thêm các ngươi mọi điều ấy nữa.',
  },
  {
    reference: 'Hê-bơ-rơ 11:1',
    text: 'Vả, đức tin là sự biết chắc vững vàng của những điều mình đang trông mong là bằng cớ của những điều mình chẳng xem thấy.',
  },
  {
    reference: 'II Ti-mô-thê 1:7',
    text: 'Vì Đức Chúa Trời chẳng ban cho chúng ta tâm thần nhút nhát, bèn là tâm thần mạnh mẽ, có tình thương yêu và dè giữ.',
  },
  {
    reference: 'Thi Thiên 119:105',
    text: 'Lời Chúa là ngọn đèn cho chân tôi, Ánh sáng cho đường lối tôi.',
  },
  {
    reference: 'Châm Ngôn 16:3',
    text: 'Hãy phó các việc mình cho Đức Giê-hô-va, Thì những mưu ý mình sẽ được thành công.',
  },
  {
    reference: 'Ê-phê-sô 2:8',
    text: 'Vả, ấy là nhờ ân điển, bởi đức tin, mà anh em được cứu, điều đó không phải đến từ anh em, bèn là sự ban cho của Đức Chúa Trời.',
  },
  {
    reference: 'Khải Thị 3:20',
    text: 'Nầy, ta đứng ngoài cửa mà gõ; nếu ai nghe tiếng ta mà mở cửa cho, thì ta sẽ vào cùng người ấy, ăn bữa tối với người, và người với ta.',
  },
  {
    reference: 'Thi Thiên 91:1',
    text: 'Người nào ở nơi kín đáo của Đấng Chí cao, Sẽ được hằng ở dưới bóng của Đấng Toàn năng.',
  },
  {
    reference: 'Ê-sai 40:31',
    text: 'Nhưng ai trông đợi Đức Giê-hô-va thì chắc được sức mới, cất cánh bay cao như chim ưng; chạy mà không mệt nhọc, đi mà không mòn mỏi.',
  },
  {
    reference: 'Ma-thi-ơ 7:7',
    text: 'Hãy xin, sẽ được; hãy tìm, sẽ gặp; hãy gõ cửa, sẽ mở cho.',
  },
]

export const WALLPAPERS = [
  { name: 'Bình minh', src: '/wallpapers/w1.jpg' },
  { name: 'Rừng đêm', src: '/wallpapers/w2.jpg' },
  { name: 'Hoàng hôn', src: '/wallpapers/w3.jpg' },
  { name: 'Sa mạc', src: '/wallpapers/w4.jpg' },
  { name: 'Thác nước', src: '/wallpapers/w5.jpg' },
  { name: 'Mặt hồ', src: '/wallpapers/w6.jpg' },
  { name: 'Cánh đồng', src: '/wallpapers/w7.jpg' },
  { name: 'Tuyết sơn', src: '/wallpapers/w8.jpg' },
  { name: 'Biển xanh', src: '/wallpapers/w9.jpg' },
  { name: 'Núi mây', src: '/wallpapers/w10.jpg' },
  { name: 'Trời sao', src: '/wallpapers/w11.jpg' },
  { name: 'Rừng sương', src: '/wallpapers/w12.jpg' },
  { name: 'Đồng hoa', src: '/wallpapers/w13.jpg' },
  { name: 'Thung lũng', src: '/wallpapers/w14.jpg' },
  { name: 'Mây chiều', src: '/wallpapers/w15.jpg' },
  { name: 'Bờ biển', src: '/wallpapers/w16.jpg' },
]

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
) {
  const scale = Math.max(targetWidth / img.width, targetHeight / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (targetWidth - w) / 2, (targetHeight - h) / 2, w, h)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

interface Props {
  currentVerse?: WallpaperVerse
  onClose: () => void
}

export default function WallpaperModal({ currentVerse, onClose }: Props) {
  const verseList = currentVerse ? [currentVerse, ...SAMPLE_VERSES] : SAMPLE_VERSES
  const [selectedVerseIndex, setSelectedVerseIndex] = useState(0)
  const [selectedWallpaperIndex, setSelectedWallpaperIndex] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const drawWallpaper = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const verse = verseList[selectedVerseIndex] || verseList[0]
    const wallpaper = WALLPAPERS[selectedWallpaperIndex] || WALLPAPERS[0]

    // 1. Draw Background Image
    try {
      const img = await loadImage(wallpaper.src)
      drawCoverImage(ctx, img, CANVAS_WIDTH, CANVAS_HEIGHT)
    } catch {
      ctx.fillStyle = '#0b0b0f'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    // 2. Draw Subtle Overlay Gradients
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, 'rgba(0,0,0,0.25)')
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.45)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // 3. Compute Font Size & Wrapped Lines
    let fontSize = 60
    let lines: string[] = []
    const maxWidth = 840
    const maxHeight = 520

    while (fontSize > 32) {
      ctx.font = `500 italic ${fontSize}px "Playfair Display", "Cormorant Garamond", Georgia, serif`
      lines = wrapText(ctx, verse.text, maxWidth)
      const lineHeight = fontSize * 1.42
      if (lines.length * lineHeight <= maxHeight) break
      fontSize -= 4
    }

    const lineHeight = fontSize * 1.42
    const totalTextHeight = lines.length * lineHeight
    const centerY = CANVAS_HEIGHT * 0.58
    const startY = centerY - totalTextHeight / 2 + lineHeight / 2

    // 4. Subtle Radial Gradient Backing for Text
    const radial = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      centerY,
      60,
      CANVAS_WIDTH / 2,
      centerY,
      520
    )
    radial.addColorStop(0, 'rgba(0,0,0,0.42)')
    radial.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = radial
    ctx.fillRect(0, centerY - 350, CANVAS_WIDTH, 700)

    // 5. Draw Scripture Text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#ffffff'
    lines.forEach((line, idx) => {
      ctx.fillText(line, CANVAS_WIDTH / 2, startY + idx * lineHeight)
    })

    // 6. Draw Reference
    ctx.shadowBlur = 10
    ctx.font = '600 40px "Be Vietnam Pro", sans-serif'
    ctx.fillStyle = '#f5b301'
    const refY = startY + (lines.length - 1) * lineHeight + lineHeight / 2 + 52
    ctx.fillText(verse.reference, CANVAS_WIDTH / 2, refY)

    // 7. Draw Gold Accent Bar
    const barY = refY + 48
    ctx.fillStyle = 'rgba(245,179,1,0.7)'
    ctx.fillRect(CANVAS_WIDTH / 2 - 60, barY, 120, 3)

    // 8. Draw Brand Name "V O W"
    ctx.font = '600 28px "Be Vietnam Pro", sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText('V O W', CANVAS_WIDTH / 2, 1810)
    ctx.shadowBlur = 0
  }, [verseList, selectedVerseIndex, selectedWallpaperIndex])

  useEffect(() => {
    drawWallpaper()
  }, [drawWallpaper])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hinh-nen-vow.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="nice-scroll max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-surface p-5 sm:rounded-3xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold text-cream">
            Tạo hình nền
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Tải hình nền xuống"
              className="rounded-full bg-gold p-2.5 text-ink transition active:scale-95 shadow-md shadow-gold/20 hover:brightness-105 cursor-pointer"
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-full bg-surface2 p-2 text-muted hover:text-cream transition active:scale-95 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Canvas Preview */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 shadow-lg">
          <canvas ref={canvasRef} className="w-full aspect-[9/16] object-cover" />
        </div>

        {/* Choose Verse */}
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted">
            Câu gốc
          </label>
          <select
            value={selectedVerseIndex}
            onChange={(e) => setSelectedVerseIndex(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-surface2 bg-surface2 px-3 py-2.5 text-sm text-cream outline-none focus:border-gold"
          >
            {verseList.map((v, idx) => (
              <option key={idx} value={idx}>
                {v.reference} — {v.text.slice(0, 38)}...
              </option>
            ))}
          </select>
        </div>

        {/* Choose Wallpaper Grid */}
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted">
            Hình nền ({WALLPAPERS.length})
          </label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {WALLPAPERS.map((wp, idx) => (
              <button
                key={wp.name}
                type="button"
                onClick={() => setSelectedWallpaperIndex(idx)}
                className={`group relative aspect-[9/16] overflow-hidden rounded-lg border-2 transition active:scale-95 cursor-pointer ${
                  selectedWallpaperIndex === idx
                    ? 'border-gold ring-2 ring-gold/40'
                    : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={wp.src} alt={wp.name} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 py-0.5 text-center text-[10px] text-white">
                  {wp.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
