'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export interface WallpaperVerse {
  reference: string
  text: string
}

export const SAMPLE_VERSES: WallpaperVerse[] = [
  {
    reference: 'Giăng 3:16',
    text: 'Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con một của Ngài, hầu cho hễ ai tin Con ấy không bị hư mất mà được sự sống đời đời.',
  },
  {
    reference: 'Phi-líp 4:13',
    text: 'Tôi làm được mọi sự nhờ Đấng ban thêm sức cho tôi.',
  },
  {
    reference: 'Giê-rê-mi 29:11',
    text: 'Đức Giê-hô-va phán: Vì ta biết ý tưởng ta nghĩ đối cùng các ngươi, là ý tưởng bình an, không phải tai họa, để cho các ngươi được sự trông cậy trong lúc cuối cùng của mình.',
  },
  {
    reference: 'Thi Thiên 23:1',
    text: 'Đức Giê-hô-va là Đấng chăn giữ tôi: tôi sẽ chẳng thiếu thốn gì.',
  },
  {
    reference: 'Châm Ngôn 3:5',
    text: 'Hãy hết lòng tin cậy Đức Giê-hô-va, Chớ nương cậy nơi sự thông sáng của con;',
  },
  {
    reference: 'Ê-sai 41:10',
    text: 'Đừng sợ, vì ta ở với ngươi; chớ kinh khiếp, vì ta là Đức Chúa Trời ngươi! Ta sẽ bổ sức cho ngươi; phải, ta sẽ giúp đỡ ngươi, lấy tay hữu công bình ta mà nâng đỡ ngươi.',
  },
  {
    reference: 'Ma-thi-ơ 11:28',
    text: 'Hỡi những kẻ mệt mỏi và gánh nặng, hãy đến cùng ta, ta sẽ cho các ngươi được yên nghỉ.',
  },
  {
    reference: 'Giô-suê 1:9',
    text: 'Ta há không có phán dặn ngươi sao? Hãy vững lòng bền chí, chớ run sợ, chớ kinh khủng; vì Giê-hô-va Đức Chúa Trời ngươi vẫn ở cùng ngươi trong mọi nơi ngươi đi.',
  },
  {
    reference: 'Thi Thiên 46:1',
    text: 'Đức Chúa Trời là nơi nương náu và sức lực của chúng tôi, Ngài sẵn giúp đỡ trong cơn gian truân.',
  },
  {
    reference: 'I Cô-rinh 13:4',
    text: 'Tình yêu thương hay nhịn nhục; tình yêu thương hay nhân từ; tình yêu thương chẳng ghen tị, chẳng khoe mình, chẳng lên mình kiêu ngạo,',
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
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15V3" strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  currentVerse?: WallpaperVerse
  onClose: () => void
}

export default function WallpaperModal({ onClose }: Props) {
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

    const verse = SAMPLE_VERSES[selectedVerseIndex] || SAMPLE_VERSES[0]
    const wallpaper = WALLPAPERS[selectedWallpaperIndex] || WALLPAPERS[0]

    try {
      await document.fonts.load('600 64px "Playfair Display"')
      await document.fonts.load('italic 500 64px "Playfair Display"')
      await document.fonts.load('600 44px "Be Vietnam Pro"')
    } catch {}

    try {
      const img = await loadImage(wallpaper.src)
      drawCoverImage(ctx, img, CANVAS_WIDTH, CANVAS_HEIGHT)
    } catch {
      ctx.fillStyle = '#0b0b0f'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, 'rgba(0,0,0,0.25)')
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.45)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    let fontSize = 60
    let lines: string[] = []
    while (
      fontSize > 32 &&
      ((ctx.font = `500 italic ${fontSize}px "Playfair Display", Georgia, serif`),
      (lines = wrapText(ctx, verse.text, 840)),
      !(lines.length * fontSize * 1.42 <= 520))
    ) {
      fontSize -= 4
    }

    const lineHeight = fontSize * 1.42
    const totalTextHeight = lines.length * lineHeight
    const centerY = CANVAS_HEIGHT * 0.58
    const startY = centerY - totalTextHeight / 2 + lineHeight / 2

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
    ctx.fillRect(0, 553.6, CANVAS_WIDTH, 1120)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#ffffff'
    lines.forEach((line, idx) => {
      ctx.fillText(line, CANVAS_WIDTH / 2, startY + idx * lineHeight)
    })

    ctx.shadowBlur = 10
    ctx.font = '600 40px "Be Vietnam Pro", sans-serif'
    ctx.fillStyle = '#f5b301'
    ctx.fillText(
      verse.reference,
      CANVAS_WIDTH / 2,
      startY + (lines.length - 1) * lineHeight + lineHeight / 2 + 52
    )

    const barY = startY + (lines.length - 1) * lineHeight + lineHeight / 2 + 100
    ctx.fillStyle = 'rgba(245,179,1,0.7)'
    ctx.fillRect(CANVAS_WIDTH / 2 - 60, barY, 120, 3)

    ctx.font = '600 28px "Be Vietnam Pro", sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText('V O W', CANVAS_WIDTH / 2, 1810)
    ctx.shadowBlur = 0
  }, [selectedVerseIndex, selectedWallpaperIndex])

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center">
      <div className="nice-scroll max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0E0E12] p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold text-cream">
            Tạo hình nền
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Tải hình nền xuống"
              className="rounded-full bg-gold p-2.5 text-ink transition active:scale-95 cursor-pointer hover:brightness-105"
            >
              <DownloadIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-full bg-white/10 p-2 text-muted hover:text-white transition active:scale-95 cursor-pointer"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="mt-4 w-full rounded-2xl" />

        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted">
          Câu gốc
        </p>
        <select
          value={selectedVerseIndex}
          onChange={(e) => setSelectedVerseIndex(Number(e.target.value))}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#141418] px-3 py-2.5 text-sm text-cream cursor-pointer"
        >
          {SAMPLE_VERSES.map((v, idx) => (
            <option key={v.reference} value={idx}>
              {v.reference}
            </option>
          ))}
        </select>

        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted">
          Phong cảnh
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {WALLPAPERS.map((wp, idx) => (
            <button
              key={wp.src}
              type="button"
              onClick={() => setSelectedWallpaperIndex(idx)}
              className={`overflow-hidden rounded-xl border-2 ${
                selectedWallpaperIndex === idx ? 'border-gold' : 'border-transparent'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wp.src}
                alt={wp.name}
                className="aspect-[9/16] w-full object-cover"
                loading="lazy"
              />
              <p className="bg-ink py-1 text-[10px] text-cream">{wp.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
