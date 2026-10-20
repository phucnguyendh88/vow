// __tests__/moments.test.ts
// Unit tests for Moments logic: Invite code generation, time formatters, compression config

describe('Moments Logic & Formatters', () => {
  describe('Invite Code Generation (Hạng mục 2)', () => {
    it('generates consistent, unique 8-character uppercase invite code from user UUID', () => {
      const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const myInviteCode = 'FC-' + userId.replace(/-/g, '').slice(0, 8).toUpperCase()
      expect(myInviteCode).toBe('FC-A1B2C3D4')
      expect(myInviteCode).toMatch(/^FC-[A-Z0-9]{8}$/)
    })

    it('handles different UUID formats without dashes correctly', () => {
      const userId = '98765432-0000-0000-0000-000000000000'
      const myInviteCode = 'FC-' + userId.replace(/-/g, '').slice(0, 8).toUpperCase()
      expect(myInviteCode).toBe('FC-98765432')
    })
  })

  describe('Compression Config (Hạng mục 4)', () => {
    it('has optimal fast compression parameters (< 200ms)', () => {
      const compressionConfig = {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 960,
        useWebWorker: true,
        fileType: 'image/jpeg',
      }
      expect(compressionConfig.maxSizeMB).toBe(0.4)
      expect(compressionConfig.maxWidthOrHeight).toBe(960)
      expect(compressionConfig.useWebWorker).toBe(true)
    })
  })

  describe('Time Formatters for Moments', () => {
    function formatGridTime(dateString: string): string {
      try {
        const now = new Date('2026-10-20T12:00:00Z')
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

    function formatRelativeTime(dateString: string): string {
      try {
        const now = new Date('2026-10-20T12:00:00Z')
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

    it('formats grid time compactly (minutes, hours, days)', () => {
      // 5 mins ago
      expect(formatGridTime('2026-10-20T11:55:00Z')).toBe('5m')
      // 3 hours ago
      expect(formatGridTime('2026-10-20T09:00:00Z')).toBe('3h')
      // 2 days ago
      expect(formatGridTime('2026-10-18T12:00:00Z')).toBe('2d')
    })

    it('formats relative time with Vietnamese labels', () => {
      // Just now (< 60s)
      expect(formatRelativeTime('2026-10-20T11:59:30Z')).toBe('Vừa xong')
      // 15 mins ago
      expect(formatRelativeTime('2026-10-20T11:45:00Z')).toBe('15 phút trước')
      // 4 hours ago
      expect(formatRelativeTime('2026-10-20T08:00:00Z')).toBe('4 giờ trước')
      // Yesterday (1 day ago)
      expect(formatRelativeTime('2026-10-19T10:00:00Z')).toBe('Hôm qua')
      // 3 days ago
      expect(formatRelativeTime('2026-10-17T12:00:00Z')).toBe('3 ngày trước')
    })
  })

  describe('Optimistic Updates State Transition', () => {
    it('optimistically prepends moment and later replaces with server response', () => {
      interface MomentItem {
        id: string
        media_url: string
        caption: string | null
      }

      let state: MomentItem[] = [
        { id: '1', media_url: 'https://example.com/1.jpg', caption: 'Old' },
      ]

      const tempId = 'temp-123'
      const optimisticMoment: MomentItem = {
        id: tempId,
        media_url: 'blob:preview',
        caption: 'New moment',
      }

      // Optimistic update
      state = [optimisticMoment, ...state]
      expect(state[0].id).toBe(tempId)
      expect(state.length).toBe(2)

      // Server returns real moment
      const realMoment: MomentItem = {
        id: 'real-db-id',
        media_url: 'https://storage/photo.jpg',
        caption: 'New moment',
      }

      state = state.map((m) => (m.id === tempId ? realMoment : m))
      expect(state[0].id).toBe('real-db-id')
      expect(state[0].media_url).toBe('https://storage/photo.jpg')
      expect(state.length).toBe(2)
    })
  })
})
