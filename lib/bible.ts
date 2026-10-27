import dailyLessons from './daily-lessons.js'

export interface BibleLesson {
  sach: string
  ma: string
  chuong: number
  cau: number
  loi_kinh_thanh: string
  bai_hoc: string
  loi_cau_nguyen: string
}

export type DailyLesson = BibleLesson

const lessons = dailyLessons as BibleLesson[]

export function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Lấy chuỗi ngày định dạng YYYY-MM-DD theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
 */
export function getVietnamDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
}

/**
 * Lấy đối tượng Date đã chuẩn hóa theo múi giờ Việt Nam (UTC+7)
 */
export function getVietnamDate(date = new Date()): Date {
  const vnOffsetMs = 7 * 60 * 60 * 1000
  const vnNow = new Date(date.getTime() + vnOffsetMs)
  const [yyyy, mm, dd] = vnNow.toISOString().split('T')[0].split('-').map((n) => parseInt(n, 10))
  return new Date(yyyy, (mm || 1) - 1, dd || 1, 12, 0, 0)
}

/**
 * Tính toán mảng 7 ngày trong tuần từ Chủ Nhật (CN) đến Thứ Bảy (T7) cho dải tuần tĩnh nguyện
 */
export function getSundayToSaturdayDates(todayStr: string): string[] {
  const parts = (todayStr || '').split('-').map(Number)
  const nowLocal = new Date()
  const d =
    parts.length === 3 && !parts.some(isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate())
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i)
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const day = String(cur.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })
}

export function getTodayLesson(date?: Date): BibleLesson {
  const targetDate = date ?? getVietnamDate()
  const dayIndex = getDayOfYear(targetDate)
  const idx = Math.abs(dayIndex) % lessons.length
  return lessons[idx]
}

export function getAllLessons(): BibleLesson[] {
  return lessons
}
