import { cn } from '@/lib/utils'
import { getDayOfYear, getTodayLesson, getAllLessons } from '@/lib/bible'
import { STICKERS, getStickerSrc } from '@/lib/stickers'

describe('Core Logic Modules', () => {
  describe('lib/utils - cn (classNames)', () => {
    it('should concatenate multiple class names', () => {
      const result = cn('btn', 'btn-primary', 'w-full')
      expect(result).toBe('btn btn-primary w-full')
    })

    it('should filter out false, null, undefined and empty strings', () => {
      const condition = false
      const result = cn(
        'base-class',
        condition && 'conditional-class',
        null,
        undefined,
        '',
        'active'
      )
      expect(result).toBe('base-class active')
    })

    it('should return empty string when no valid classes are passed', () => {
      expect(cn(null, undefined, false, '')).toBe('')
      expect(cn()).toBe('')
    })
  })

  describe('lib/bible - Scripture and Lessons', () => {
    it('should return all lessons with proper schema', () => {
      const lessons = getAllLessons()
      expect(Array.isArray(lessons)).toBe(true)
      expect(lessons.length).toBeGreaterThan(0)

      const first = lessons[0]
      expect(first).toHaveProperty('sach')
      expect(first).toHaveProperty('ma')
      expect(first).toHaveProperty('chuong')
      expect(first).toHaveProperty('cau')
      expect(first).toHaveProperty('loi_kinh_thanh')
      expect(first).toHaveProperty('bai_hoc')
      expect(first).toHaveProperty('loi_cau_nguyen')
      expect(typeof first.loi_kinh_thanh).toBe('string')
      expect(first.loi_kinh_thanh.length).toBeGreaterThan(0)
    })

    it('should calculate getDayOfYear correctly for fixed dates', () => {
      // 2026-01-01 should be day 1 of 2026
      const jan1 = new Date(2026, 0, 1)
      const dayOfYearJan1 = getDayOfYear(jan1)
      expect(dayOfYearJan1).toBe(1)

      // 2026-02-01 should be day 32 (31 days in Jan + 1)
      const feb1 = new Date(2026, 1, 1)
      expect(getDayOfYear(feb1)).toBe(32)
    })

    it('should return a valid lesson for getTodayLesson deterministically', () => {
      const testDate = new Date(2026, 9, 20) // Oct 20, 2026
      const lesson1 = getTodayLesson(testDate)
      const lesson2 = getTodayLesson(testDate)

      expect(lesson1).toBeDefined()
      expect(lesson1.sach).toBeDefined()
      expect(lesson1.chuong).toBeGreaterThanOrEqual(1)
      expect(lesson1).toEqual(lesson2)
    })
  })

  describe('lib/stickers - Sticker helper and dictionary', () => {
    it('should contain predefined sticker list with valid keys and paths', () => {
      expect(STICKERS.length).toBeGreaterThanOrEqual(16)
      STICKERS.forEach((sticker) => {
        expect(sticker.key).toBeTruthy()
        expect(sticker.label).toBeTruthy()
        expect(sticker.src).toMatch(/^\/stickers\/.*\.png$/)
      })
    })

    it('should return correct src for existing sticker keys', () => {
      expect(getStickerSrc('da-qua-hai-oi')).toBe('/stickers/da-qua-hai-oi.png')
      expect(getStickerSrc('ngoan-xinh-iu')).toBe('/stickers/ngoan-xinh-iu.png')
    })

    it('should return null for non-existent sticker keys', () => {
      expect(getStickerSrc('invalid-key')).toBeNull()
      expect(getStickerSrc('')).toBeNull()
    })
  })

  describe('Date & Time helpers logic', () => {
    // Helper replicating devotion greeting logic
    function getGreeting(hour: number): string {
      if (hour >= 5 && hour < 11) return 'buổi sáng'
      if (hour >= 11 && hour < 13) return 'buổi trưa'
      if (hour >= 13 && hour < 18) return 'buổi chiều'
      return 'buổi tối'
    }

    it('should return correct greeting according to hour ranges', () => {
      expect(getGreeting(6)).toBe('buổi sáng')
      expect(getGreeting(10)).toBe('buổi sáng')
      expect(getGreeting(11)).toBe('buổi trưa')
      expect(getGreeting(12)).toBe('buổi trưa')
      expect(getGreeting(14)).toBe('buổi chiều')
      expect(getGreeting(17)).toBe('buổi chiều')
      expect(getGreeting(20)).toBe('buổi tối')
      expect(getGreeting(2)).toBe('buổi tối')
    })

    // Helper replicating devotion week dates calculation
    function getWeekDates(todayStr: string): string[] {
      const date = new Date(todayStr)
      const dayOfWeek = date.getDay() // 0 = CN, 1 = T2...
      const monday = new Date(date)
      monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7))
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d.toISOString().split('T')[0]
      })
    }

    it('should generate a 7-day week starting on Monday', () => {
      // 2026-10-20 is Tuesday
      const week = getWeekDates('2026-10-20')
      expect(week).toHaveLength(7)
      expect(week[0]).toBe('2026-10-19') // Monday
      expect(week[1]).toBe('2026-10-20') // Tuesday
      expect(week[6]).toBe('2026-10-25') // Sunday
    })
  })

  describe('Dating swipe gesture logic & Theme handling', () => {
    function resolveSwipeAction(offsetX: number): 'like' | 'pass' | null {
      if (offsetX > 100) return 'like'
      if (offsetX < -100) return 'pass'
      return null
    }

    it('should trigger like when dragging right > 100px', () => {
      expect(resolveSwipeAction(101)).toBe('like')
      expect(resolveSwipeAction(250)).toBe('like')
    })

    it('should trigger pass when dragging left < -100px', () => {
      expect(resolveSwipeAction(-101)).toBe('pass')
      expect(resolveSwipeAction(-300)).toBe('pass')
    })

    it('should not trigger action when drag offset is within [-100, 100]', () => {
      expect(resolveSwipeAction(0)).toBeNull()
      expect(resolveSwipeAction(50)).toBeNull()
      expect(resolveSwipeAction(-50)).toBeNull()
      expect(resolveSwipeAction(100)).toBeNull()
      expect(resolveSwipeAction(-100)).toBeNull()
    })

    it('should properly compute theme class toggling', () => {
      function getNextThemeState(currentIsLight: boolean) {
        const next = !currentIsLight
        return {
          isLight: next,
          classesToAdd: next ? ['devotion-light'] : ['dark'],
          classesToRemove: next ? ['dark'] : ['devotion-light'],
          storageKey: 'vow_theme',
          storageVal: next ? 'light' : 'dark',
        }
      }

      const lightState = getNextThemeState(false)
      expect(lightState.isLight).toBe(true)
      expect(lightState.classesToAdd).toContain('devotion-light')
      expect(lightState.classesToRemove).toContain('dark')
      expect(lightState.storageVal).toBe('light')

      const darkState = getNextThemeState(true)
      expect(darkState.isLight).toBe(false)
      expect(darkState.classesToAdd).toContain('dark')
      expect(darkState.classesToRemove).toContain('devotion-light')
      expect(darkState.storageVal).toBe('dark')
    })
  })
})
