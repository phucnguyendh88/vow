import {
  getVietnamDateString,
  getVietnamDate,
  getDayOfYear,
  getTodayLesson,
  getAllLessons,
  getSundayToSaturdayDates,
} from '@/lib/bible'

describe('Timezone & Devotion Date Calculations (Vietnam UTC+7)', () => {
  describe('getVietnamDateString - Timezone Conversion', () => {
    it('formats date correctly as YYYY-MM-DD according to Asia/Ho_Chi_Minh timezone', () => {
      // 10:00 UTC on Oct 27 -> 17:00 in Vietnam on Oct 27
      const date1 = new Date('2026-10-27T10:00:00Z')
      expect(getVietnamDateString(date1)).toBe('2026-10-27')
    })

    it('handles the exact UTC boundary when date changes in Vietnam before UTC', () => {
      // 16:59:59 UTC on Oct 27 -> 23:59:59 in Vietnam on Oct 27
      const beforeMidnightUtc = new Date('2026-10-27T16:59:59Z')
      expect(getVietnamDateString(beforeMidnightUtc)).toBe('2026-10-27')

      // 17:00:00 UTC on Oct 27 -> 00:00:00 in Vietnam on Oct 28 (new day in Vietnam!)
      const midnightVnUtc = new Date('2026-10-27T17:00:00Z')
      expect(getVietnamDateString(midnightVnUtc)).toBe('2026-10-28')
    })

    it('correctly transitions across year boundary according to Vietnam timezone', () => {
      // 2026-12-31 16:59:59 UTC is still Dec 31, 2026 in Vietnam
      const newYearEveVn = new Date('2026-12-31T16:59:59Z')
      expect(getVietnamDateString(newYearEveVn)).toBe('2026-12-31')

      // 2026-12-31 17:00:00 UTC is Jan 1, 2027 in Vietnam
      const newYearVn = new Date('2026-12-31T17:00:00Z')
      expect(getVietnamDateString(newYearVn)).toBe('2027-01-01')
    })
  })

  describe('getVietnamDate - Midday Normalized Date', () => {
    it('returns a local Date object set to 12:00:00 midday to prevent DST/offset drift', () => {
      const sampleUtc = new Date('2026-10-27T18:00:00Z') // Oct 28 in VN
      const vnDate = getVietnamDate(sampleUtc)

      expect(vnDate.getFullYear()).toBe(2026)
      expect(vnDate.getMonth()).toBe(9) // 0-indexed: 9 = October
      expect(vnDate.getDate()).toBe(28)
      expect(vnDate.getHours()).toBe(12)
      expect(vnDate.getMinutes()).toBe(0)
    })
  })

  describe('getDayOfYear & Leap Year Calculations', () => {
    it('calculates the 1st day of the year', () => {
      const jan1 = new Date(2026, 0, 1)
      expect(getDayOfYear(jan1)).toBe(1)
    })

    it('calculates day 32 for February 1st in common years', () => {
      const feb1 = new Date(2026, 1, 1)
      expect(getDayOfYear(feb1)).toBe(32)
    })

    it('calculates day 365 for December 31st in non-leap year (2026)', () => {
      const dec31 = new Date(2026, 11, 31)
      expect(getDayOfYear(dec31)).toBe(365)
    })

    it('handles leap years accurately (2024 has 366 days)', () => {
      const feb29Leap = new Date(2024, 1, 29)
      expect(getDayOfYear(feb29Leap)).toBe(60)

      const mar1Leap = new Date(2024, 2, 1)
      expect(getDayOfYear(mar1Leap)).toBe(61)

      const dec31Leap = new Date(2024, 11, 31)
      expect(getDayOfYear(dec31Leap)).toBe(366)
    })
  })

  describe('getTodayLesson - Scripture Content & Determinism', () => {
    it('retrieves all lessons without corruption', () => {
      const all = getAllLessons()
      expect(all.length).toBeGreaterThan(0)
      for (const lesson of all) {
        expect(lesson.sach).toBeTruthy()
        expect(lesson.chuong).toBeGreaterThanOrEqual(1)
        expect(lesson.cau).toBeGreaterThanOrEqual(1)
        expect(lesson.loi_kinh_thanh).toBeTruthy()
        expect(lesson.bai_hoc).toBeTruthy()
        expect(lesson.loi_cau_nguyen).toBeTruthy()
      }
    })

    it('returns consistent lesson for the same day deterministically', () => {
      const dateA = new Date(2026, 9, 27, 8, 0, 0)
      const dateB = new Date(2026, 9, 27, 23, 0, 0)

      const lessonA = getTodayLesson(dateA)
      const lessonB = getTodayLesson(dateB)

      expect(lessonA).toEqual(lessonB)
    })

    it('does not throw when reaching the end of the year or beyond lesson count', () => {
      const dec31 = new Date(2026, 11, 31)
      const lesson = getTodayLesson(dec31)
      expect(lesson).toBeDefined()
      expect(lesson.sach).toBeDefined()
    })
  })

  describe('getSundayToSaturdayDates - Weekly Devotion Range', () => {
    it('computes 7 consecutive days starting on Sunday when today is Sunday', () => {
      // 2026-10-25 is Sunday
      const week = getSundayToSaturdayDates('2026-10-25')
      expect(week).toHaveLength(7)
      expect(week[0]).toBe('2026-10-25') // CN
      expect(week[1]).toBe('2026-10-26') // T2
      expect(week[2]).toBe('2026-10-27') // T3
      expect(week[3]).toBe('2026-10-28') // T4
      expect(week[4]).toBe('2026-10-29') // T5
      expect(week[5]).toBe('2026-10-30') // T6
      expect(week[6]).toBe('2026-10-31') // T7
    })

    it('computes Sunday to Saturday correctly when today is midweek (Wednesday)', () => {
      // 2026-10-28 is Wednesday
      const week = getSundayToSaturdayDates('2026-10-28')
      expect(week).toHaveLength(7)
      expect(week[0]).toBe('2026-10-25') // Previous Sunday
      expect(week[3]).toBe('2026-10-28') // Wednesday
      expect(week[6]).toBe('2026-10-31') // Saturday
    })

    it('computes Sunday to Saturday correctly when today is Saturday', () => {
      // 2026-10-31 is Saturday
      const week = getSundayToSaturdayDates('2026-10-31')
      expect(week).toHaveLength(7)
      expect(week[0]).toBe('2026-10-25') // Sunday
      expect(week[6]).toBe('2026-10-31') // Saturday (today)
    })

    it('handles week spanning across month boundaries seamlessly', () => {
      // 2026-11-04 is Wednesday (spanning from Oct 2026 into Nov 2026)
      // 2026-11-01 was Sunday
      const week = getSundayToSaturdayDates('2026-11-04')
      expect(week).toHaveLength(7)
      expect(week[0]).toBe('2026-11-01')
      expect(week[1]).toBe('2026-11-02')
      expect(week[6]).toBe('2026-11-07')
    })

    it('handles week spanning across year boundaries (Dec to Jan)', () => {
      // 2026-12-31 is Thursday
      // Sunday was 2026-12-27, Saturday is 2027-01-02
      const week = getSundayToSaturdayDates('2026-12-31')
      expect(week).toHaveLength(7)
      expect(week[0]).toBe('2026-12-27')
      expect(week[4]).toBe('2026-12-31')
      expect(week[5]).toBe('2027-01-01')
      expect(week[6]).toBe('2027-01-02')
    })

    it('falls back gracefully to current local week without throwing on invalid input', () => {
      const fallbackEmpty = getSundayToSaturdayDates('')
      expect(fallbackEmpty).toHaveLength(7)

      const fallbackInvalid = getSundayToSaturdayDates('invalid-date')
      expect(fallbackInvalid).toHaveLength(7)
      expect(fallbackInvalid[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('Devotion Greeting Time Ranges (Vietnam Hours)', () => {
    function getDevotionGreeting(hour: number): string {
      if (hour >= 5 && hour < 11) return 'buổi sáng'
      if (hour >= 11 && hour < 14) return 'buổi trưa'
      if (hour >= 14 && hour < 18) return 'buổi chiều'
      return 'buổi tối'
    }

    it('returns buổi sáng for hours 5 through 10', () => {
      expect(getDevotionGreeting(5)).toBe('buổi sáng')
      expect(getDevotionGreeting(8)).toBe('buổi sáng')
      expect(getDevotionGreeting(10)).toBe('buổi sáng')
    })

    it('returns buổi trưa for hours 11 through 13', () => {
      expect(getDevotionGreeting(11)).toBe('buổi trưa')
      expect(getDevotionGreeting(12)).toBe('buổi trưa')
      expect(getDevotionGreeting(13)).toBe('buổi trưa')
    })

    it('returns buổi chiều for hours 14 through 17', () => {
      expect(getDevotionGreeting(14)).toBe('buổi chiều')
      expect(getDevotionGreeting(16)).toBe('buổi chiều')
      expect(getDevotionGreeting(17)).toBe('buổi chiều')
    })

    it('returns buổi tối for hours 18 through 4', () => {
      expect(getDevotionGreeting(18)).toBe('buổi tối')
      expect(getDevotionGreeting(22)).toBe('buổi tối')
      expect(getDevotionGreeting(0)).toBe('buổi tối')
      expect(getDevotionGreeting(4)).toBe('buổi tối')
    })
  })
})
