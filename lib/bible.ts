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

const lessons = dailyLessons as BibleLesson[]

export function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function getTodayLesson(date = new Date()): BibleLesson {
  const dayIndex = getDayOfYear(date)
  const idx = Math.abs(dayIndex) % lessons.length
  return lessons[idx]
}

export function getAllLessons(): BibleLesson[] {
  return lessons
}
