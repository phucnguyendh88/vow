/**
 * @jest-environment node
 */
/**
 * __tests__/moments-realtime-sync.test.ts
 *
 * Bộ test kiểm thử luồng đồng bộ khoảnh khắc sau khi kết bạn (Moments Realtime Sync):
 * 1. Tái hiện lỗi (Problem Statement): Thiếu refreshMoments khi kết bạn / realtime / focus khiến không thấy khoảnh khắc bạn mới.
 * 2. [Test 1]: Hàm refreshMoments truy vấn bảng moments kèm profiles:user_id với is_deleted = false, order created_at DESC.
 * 3. [Test 2]: Khi handleAcceptRequest thành công, kích hoạt refreshMoments để tải khoảnh khắc bạn mới.
 * 4. [Test 3]: Khi nhận sự kiện realtime trên friendships / friend_requests, tự động gọi refreshMoments.
 * 5. [Test 4]: Khi nhận sự kiện realtime trên moments hoặc tab visibilitychange / focus, kích hoạt refreshMoments.
 * 6. [Test 5]: Khi mở History (openHistory) hoặc Grid Modal (showGridModal), đảm bảo đồng bộ khoảnh khắc mới nhất.
 */

interface ProfileShort {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

interface MomentItem {
  id: string
  user_id: string
  media_url: string
  media_type: 'image' | 'video'
  thumbnail_url?: string | null
  caption?: string | null
  is_deleted: boolean
  deleted_at?: string | null
  created_at: string
  profiles?: ProfileShort | null
}

interface FriendItem {
  id: string
  profile: {
    id: string
    name: string
    photos: string[]
    church: string
  }
}

// =============================================================================
// LOGIC HIỆN TẠI (CHỨA BUG) - DÙNG ĐỂ TÁI HIỆN LỖI (BUG REPRODUCTION)
// =============================================================================

class LegacyMomentsManager {
  moments: MomentItem[]
  friends: FriendItem[]
  refreshConnectionsCalled = 0
  refreshMomentsCalled = 0

  constructor(initialMoments: MomentItem[], initialFriends: FriendItem[]) {
    this.moments = [...initialMoments]
    this.friends = [...initialFriends]
  }

  // Logic cũ chỉ có refreshConnections, hoàn toàn KHÔNG CÓ refreshMoments
  async refreshConnections(): Promise<void> {
    this.refreshConnectionsCalled++
  }

  // Khi chấp nhận kết bạn trong code cũ: chỉ gọi refreshConnections
  async handleAcceptRequest(
    supabase: any,
    req: FriendItem
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', req.id)
      if (error) throw error

      this.friends.push(req)
      await this.refreshConnections()
      // BUG: Không gọi refreshMoments(), mảng this.moments không hề được cập nhật
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Khi có realtime postgres_changes trên friend_requests / friendships trong code cũ
  handleRealtimeConnectionChange(): void {
    void this.refreshConnections()
    // BUG: Không gọi refreshMoments
  }

  // Khi visibilitychange / focus trong code cũ
  handleVisibilityChange(): void {
    void this.refreshConnections()
    // BUG: Không gọi refreshMoments
  }

  // Mở History trong code cũ
  openHistory(): { showHistoryViewer: boolean } {
    // BUG: Chỉ set state hiển thị, không trigger đồng bộ dữ liệu khoảnh khắc
    return { showHistoryViewer: true }
  }

  // Mở Grid Modal trong code cũ
  openGridModal(): { showGridModal: boolean } {
    // BUG: Chỉ set state hiển thị, không trigger đồng bộ dữ liệu khoảnh khắc
    return { showGridModal: true }
  }
}

// =============================================================================
// LOGIC CHUẨN CẦN ĐẠT (EXPECTED SPECIFICATION / FIXED LOGIC)
// =============================================================================

class SyncEnabledMomentsManager {
  moments: MomentItem[]
  friends: FriendItem[]
  supabase: any
  userId: string
  refreshConnectionsCalled = 0
  refreshMomentsCalled = 0
  showHistoryViewer = false
  showGridModal = false

  constructor(supabase: any, userId: string, initialMoments: MomentItem[], initialFriends: FriendItem[]) {
    this.supabase = supabase
    this.userId = userId
    this.moments = [...initialMoments]
    this.friends = [...initialFriends]
  }

  /**
   * [Test 1]: Hàm refreshMoments chuẩn
   * Truy vấn bảng moments với profiles:user_id, is_deleted = false, sắp xếp created_at DESC
   */
  async refreshMoments(): Promise<MomentItem[]> {
    this.refreshMomentsCalled++
    try {
      const { data, error } = await this.supabase
        .from('moments')
        .select(`
          id,
          user_id,
          media_url,
          media_type,
          thumbnail_url,
          caption,
          is_deleted,
          deleted_at,
          created_at,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(60)

      if (error) throw error

      if (Array.isArray(data)) {
        this.moments = data
      }
      return this.moments
    } catch {
      // Xử lý lỗi duyên dáng, giữ lại moments cũ
      return this.moments
    }
  }

  async refreshConnections(): Promise<void> {
    this.refreshConnectionsCalled++
  }

  /**
   * [Test 2]: Khi chấp nhận kết bạn
   * Bắt buộc kích hoạt cả refreshConnections() VÀ refreshMoments()
   */
  async handleAcceptRequest(req: FriendItem): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', req.id)

      if (error) throw error

      this.friends.push(req)
      await Promise.all([this.refreshConnections(), this.refreshMoments()])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  /**
   * [Test 3]: Khi nhận realtime sự kiện kết bạn (friendships / friend_requests)
   */
  handleRealtimeFriendshipChange(): void {
    void this.refreshConnections()
    void this.refreshMoments()
  }

  /**
   * [Test 4]: Khi nhận realtime trên moments hoặc tab visibility / focus
   */
  handleRealtimeMomentsChange(): void {
    void this.refreshMoments()
  }

  handleVisibilityOrFocus(isVisible: boolean): void {
    if (isVisible) {
      void this.refreshConnections()
      void this.refreshMoments()
    }
  }

  /**
   * [Test 5]: Khi mở History hoặc Grid Modal
   */
  openHistory(): void {
    this.showHistoryViewer = true
    void this.refreshMoments()
  }

  openGridModal(): void {
    this.showGridModal = true
    void this.refreshMoments()
  }
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Moments Realtime Sync & Friends Integration Tests', () => {
  const currentUserId = 'user-current-001'
  const newFriendId = 'user-newfriend-002'

  const initialMyMoment: MomentItem = {
    id: 'moment-mine-1',
    user_id: currentUserId,
    media_url: 'https://vow.app/mine.jpg',
    media_type: 'image',
    is_deleted: false,
    created_at: '2026-10-27T10:00:00Z',
    profiles: {
      id: currentUserId,
      username: 'me',
      full_name: 'Tôi',
      avatar_url: null,
    },
  }

  const newFriendMoment: MomentItem = {
    id: 'moment-friend-1',
    user_id: newFriendId,
    media_url: 'https://vow.app/friend.jpg',
    media_type: 'image',
    caption: 'Xin chào từ bạn mới!',
    is_deleted: false,
    created_at: '2026-10-27T10:30:00Z',
    profiles: {
      id: newFriendId,
      username: 'newfriend',
      full_name: 'Bạn Mới',
      avatar_url: 'https://vow.app/friend-avatar.jpg',
    },
  }

  const incomingFriendReq: FriendItem = {
    id: 'req-12345',
    profile: {
      id: newFriendId,
      name: 'Bạn Mới',
      photos: ['https://vow.app/friend-avatar.jpg'],
      church: 'Hội Thánh Tin Lành',
    },
  }

  // ---------------------------------------------------------------------------
  // TÁI HIỆN LỖI (PROBLEM STATEMENT)
  // ---------------------------------------------------------------------------
  describe('Tái hiện lỗi: MomentsClient cũ không đồng bộ khoảnh khắc bạn mới', () => {
    it('[BUG REPRODUCTION] Khi kết bạn thành công, code cũ chỉ gọi refreshConnections mà không cập nhật moments', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }

      const legacyManager = new LegacyMomentsManager([initialMyMoment], [])
      expect(legacyManager.moments.length).toBe(1)
      expect(legacyManager.moments[0].id).toBe('moment-mine-1')

      // Thực hiện chấp nhận kết bạn
      const result = await legacyManager.handleAcceptRequest(mockSupabase, incomingFriendReq)
      expect(result.success).toBe(true)

      // Ghi nhận lỗi: refreshConnections được gọi nhưng refreshMoments không tồn tại
      expect(legacyManager.refreshConnectionsCalled).toBe(1)
      expect(legacyManager.refreshMomentsCalled).toBe(0)

      // Khoảnh khắc của người bạn mới KHÔNG xuất hiện trong state moments
      const hasNewFriendMoment = legacyManager.moments.some((m) => m.user_id === newFriendId)
      expect(hasNewFriendMoment).toBe(false)
      expect(legacyManager.moments.length).toBe(1)
    })

    it('[BUG REPRODUCTION] Khi nhận realtime kết bạn hoặc tab focus, code cũ không tải lại moments', () => {
      const legacyManager = new LegacyMomentsManager([initialMyMoment], [])

      legacyManager.handleRealtimeConnectionChange()
      legacyManager.handleVisibilityChange()

      expect(legacyManager.refreshConnectionsCalled).toBe(2)
      // refreshMoments vẫn là 0, người dùng hoàn toàn không thấy khoảnh khắc mới
      expect(legacyManager.refreshMomentsCalled).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // [TEST 1]: HÀM refreshMoments
  // ---------------------------------------------------------------------------
  describe('[Test 1]: Hàm refreshMoments truy vấn bảng moments theo đúng đặc tả', () => {
    it('truy vấn moments kèm profiles:user_id, is_deleted = false, created_at DESC và cập nhật state', async () => {
      let capturedSelect = ''
      let capturedEqField = ''
      let capturedEqVal: any = null
      let capturedOrderField = ''
      let capturedOrderAsc: boolean | null = null

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          expect(table).toBe('moments')
          return {
            select: jest.fn().mockImplementation((selectFields: string) => {
              capturedSelect = selectFields
              return {
                eq: jest.fn().mockImplementation((field: string, val: any) => {
                  capturedEqField = field
                  capturedEqVal = val
                  return {
                    order: jest.fn().mockImplementation((orderField: string, opts: any) => {
                      capturedOrderField = orderField
                      capturedOrderAsc = opts?.ascending
                      return {
                        limit: jest.fn().mockResolvedValue({
                          data: [newFriendMoment, initialMyMoment],
                          error: null,
                        }),
                      }
                    }),
                  }
                }),
              }
            }),
          }
        }),
      }

      const manager = new SyncEnabledMomentsManager(mockSupabase, currentUserId, [initialMyMoment], [])
      expect(manager.moments.length).toBe(1)

      const updatedMoments = await manager.refreshMoments()

      // Kiểm tra cấu trúc truy vấn
      expect(capturedSelect).toContain('profiles:user_id')
      expect(capturedSelect).toContain('id')
      expect(capturedSelect).toContain('media_url')
      expect(capturedSelect).toContain('caption')
      expect(capturedEqField).toBe('is_deleted')
      expect(capturedEqVal).toBe(false)
      expect(capturedOrderField).toBe('created_at')
      expect(capturedOrderAsc).toBe(false)

      // Kiểm tra state đã được cập nhật khoảnh khắc mới
      expect(updatedMoments.length).toBe(2)
      expect(manager.moments.length).toBe(2)
      expect(manager.moments[0].id).toBe('moment-friend-1')
      expect(manager.moments[0].profiles?.full_name).toBe('Bạn Mới')
    })

    it('xử lý an toàn khi truy vấn DB trả về lỗi mà không làm sập giao diện', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Network timeout'),
                }),
              }),
            }),
          }),
        }),
      }

      const manager = new SyncEnabledMomentsManager(mockSupabase, currentUserId, [initialMyMoment], [])
      const result = await manager.refreshMoments()

      // Giữ nguyên moments hiện có, không bị rỗng do lỗi mạng
      expect(result.length).toBe(1)
      expect(manager.moments.length).toBe(1)
      expect(manager.moments[0].id).toBe('moment-mine-1')
    })
  })

  // ---------------------------------------------------------------------------
  // [TEST 2]: KHI handleAcceptRequest ĐƯỢC GỌI
  // ---------------------------------------------------------------------------
  describe('[Test 2]: Kích hoạt refreshMoments khi handleAcceptRequest thành công', () => {
    it('cập nhật friend_requests thành accepted và đồng thời tải ngay khoảnh khắc của bạn mới', async () => {
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'friend_requests') {
            return {
              update: jest.fn().mockImplementation((updatePayload: any) => {
                expect(updatePayload).toEqual({ status: 'accepted' })
                return {
                  eq: jest.fn().mockImplementation((field: string, idVal: string) => {
                    expect(field).toBe('id')
                    expect(idVal).toBe(incomingFriendReq.id)
                    return Promise.resolve({ error: null })
                  }),
                }
              }),
            }
          }
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [newFriendMoment, initialMyMoment],
                      error: null,
                    }),
                  }),
                }),
              }),
            }
          }
          throw new Error(`Unexpected table: ${table}`)
        }),
      }

      const manager = new SyncEnabledMomentsManager(mockSupabase, currentUserId, [initialMyMoment], [])
      expect(manager.moments.length).toBe(1)

      const result = await manager.handleAcceptRequest(incomingFriendReq)

      expect(result.success).toBe(true)
      expect(manager.refreshConnectionsCalled).toBe(1)
      expect(manager.refreshMomentsCalled).toBe(1)

      // Khoảnh khắc của bạn mới xuất hiện ngay lập tức
      expect(manager.moments.length).toBe(2)
      expect(manager.moments.some((m) => m.user_id === newFriendId)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // [TEST 3]: SỰ KIỆN REALTIME TRÊN friendships / friend_requests
  // ---------------------------------------------------------------------------
  describe('[Test 3]: Tự động gọi refreshMoments khi nhận sự kiện Realtime kết bạn', () => {
    it('kích hoạt refreshMoments khi nhận sự kiện INSERT trên friendships hoặc UPDATE trên friend_requests', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [newFriendMoment, initialMyMoment],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }

      const manager = new SyncEnabledMomentsManager(mockSupabase, currentUserId, [initialMyMoment], [])
      expect(manager.refreshMomentsCalled).toBe(0)

      // Mô phỏng sự kiện Realtime bắn về khi người kia chấp nhận
      manager.handleRealtimeFriendshipChange()

      expect(manager.refreshConnectionsCalled).toBe(1)
      expect(manager.refreshMomentsCalled).toBe(1)

      // Đợi microtask hoàn thành
      await Promise.resolve()
      expect(manager.moments.length).toBe(2)
      expect(manager.moments[0].id).toBe('moment-friend-1')
    })
  })

  // ---------------------------------------------------------------------------
  // [TEST 4]: REALTIME TRÊN moments VÀ TAB VISIBILITY / FOCUS
  // ---------------------------------------------------------------------------
  describe('[Test 4]: Kích hoạt refreshMoments khi có sự kiện Realtime trên moments hoặc tab focus', () => {
    let manager: SyncEnabledMomentsManager

    beforeEach(() => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [newFriendMoment, initialMyMoment],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }
      manager = new SyncEnabledMomentsManager(mockSupabase, currentUserId, [initialMyMoment], [])
    })

    it('kích hoạt refreshMoments khi có Realtime INSERT / UPDATE trên bảng moments', async () => {
      expect(manager.refreshMomentsCalled).toBe(0)

      // Mô phỏng realtime bạn bè vừa đăng khoảnh khắc mới
      manager.handleRealtimeMomentsChange()

      expect(manager.refreshMomentsCalled).toBe(1)
      await Promise.resolve()
      expect(manager.moments.length).toBe(2)
    })

    it('kích hoạt refreshMoments khi tab trình duyệt chuyển sang trạng thái visible', () => {
      expect(manager.refreshMomentsCalled).toBe(0)

      manager.handleVisibilityOrFocus(true) // document.visibilityState === 'visible'

      expect(manager.refreshMomentsCalled).toBe(1)
      expect(manager.refreshConnectionsCalled).toBe(1)
    })

    it('không kích hoạt refreshMoments khi tab đang ở trạng thái hidden', () => {
      expect(manager.refreshMomentsCalled).toBe(0)

      manager.handleVisibilityOrFocus(false) // document.visibilityState === 'hidden'

      expect(manager.refreshMomentsCalled).toBe(0)
      expect(manager.refreshConnectionsCalled).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // [TEST 5]: KHI MỞ LỊCH SỬ HOẶC LƯỚI KHOẢNH KHẮC
  // ---------------------------------------------------------------------------
  describe('[Test 5]: Đảm bảo đồng bộ mới nhất khi mở History hoặc Grid Modal', () => {
    let manager: SyncEnabledMomentsManager

    beforeEach(() => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [newFriendMoment, initialMyMoment],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }
      manager = new SyncEnabledMomentsManager(mockSupabase, currentUserId, [initialMyMoment], [])
    })

    it('gọi refreshMoments khi người dùng mở Lịch sử (openHistory)', async () => {
      expect(manager.showHistoryViewer).toBe(false)
      expect(manager.refreshMomentsCalled).toBe(0)

      manager.openHistory()

      expect(manager.showHistoryViewer).toBe(true)
      expect(manager.refreshMomentsCalled).toBe(1)

      await Promise.resolve()
      expect(manager.moments.length).toBe(2)
      expect(manager.moments[0].id).toBe('moment-friend-1')
    })

    it('gọi refreshMoments khi người dùng mở Lưới khoảnh khắc (openGridModal)', async () => {
      expect(manager.showGridModal).toBe(false)
      expect(manager.refreshMomentsCalled).toBe(0)

      manager.openGridModal()

      expect(manager.showGridModal).toBe(true)
      expect(manager.refreshMomentsCalled).toBe(1)

      await Promise.resolve()
      expect(manager.moments.length).toBe(2)
      expect(manager.moments[0].id).toBe('moment-friend-1')
    })
  })
})
