/**
 * @jest-environment node
 */
/**
 * __tests__/reconnect-after-unfriend.test.ts
 *
 * Bộ test kiểm thử luồng Hủy kết bạn rồi kết bạn lại (Reconnect After Unfriend):
 * 1. [Test 1]: Tái hiện bug: Khi bản ghi friend_requests cũ vẫn còn tồn tại trong DB (status = accepted/rejected),
 *    lệnh INSERT bị PostgreSQL chặn với lỗi 23505 (unique_friend_request).
 *    Code cũ nuốt lỗi (error.code !== '23505') khiến UI tạo item giả rồi biến mất khi refreshConnections().
 * 2. [Test 2]: Hàm handleRemoveFriend chuẩn phải đồng thời xóa bản ghi trong friend_requests giữa 2 người (cả 2 chiều)
 *    khi xóa friendships.
 * 3. [Test 3]: Hàm handleSendFriendRequest chuẩn phải kiểm tra các trạng thái trước khi tạo lời mời:
 *    - Đã là bạn bè -> thông báo và dừng.
 *    - Đã có lời mời gửi đi đang chờ (outgoing pending) -> thông báo và dừng.
 *    - Đang có lời mời đến từ người đó (incoming pending) -> thông báo chấp nhận.
 *    - Dọn dẹp bản ghi cũ không còn pending trước khi INSERT.
 * 4. [Test 4]: Không nuốt lỗi 23505 (throw error nếu lỗi xảy ra), đảm bảo lời mời mới được lưu thực sự
 *    và người nhận nhìn thấy trong danh sách incoming.
 */

interface FriendRequestRow {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

interface FriendshipRow {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
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
// MOCK DATABASE GIẢ LẬP RÀNG BUỘC TOÀN VẸN POSTGRESQL (PostgreSQL DB Simulation)
// =============================================================================

class MockSupabaseDatabase {
  friendRequests: FriendRequestRow[] = []
  friendships: FriendshipRow[] = []

  reset() {
    this.friendRequests = []
    this.friendships = []
  }

  // Giả lập constraint UNIQUE(sender_id, receiver_id) của PostgreSQL
  insertFriendRequest(req: { sender_id: string; receiver_id: string; status: 'pending' }): {
    data: FriendRequestRow | null
    error: any
  } {
    const duplicate = this.friendRequests.some(
      (r) =>
        (r.sender_id === req.sender_id && r.receiver_id === req.receiver_id) ||
        (r.sender_id === req.receiver_id && r.receiver_id === req.sender_id)
    )

    if (duplicate) {
      return {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "unique_friend_request" (Key (sender_id, receiver_id) already exists.)',
        },
      }
    }

    const newRow: FriendRequestRow = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender_id: req.sender_id,
      receiver_id: req.receiver_id,
      status: req.status,
      created_at: new Date().toISOString(),
    }
    this.friendRequests.push(newRow)
    return { data: newRow, error: null }
  }

  deleteFriendship(id: string): { error: any } {
    this.friendships = this.friendships.filter((f) => f.id !== id)
    return { error: null }
  }

  deleteFriendRequestsBetween(userA: string, userB: string): { count: number; error: any } {
    const prevCount = this.friendRequests.length
    this.friendRequests = this.friendRequests.filter(
      (r) =>
        !(
          (r.sender_id === userA && r.receiver_id === userB) ||
          (r.sender_id === userB && r.receiver_id === userA)
        )
    )
    return { count: prevCount - this.friendRequests.length, error: null }
  }
}

// =============================================================================
// LOGIC HIỆN TẠI (CHỨA BUG) - DÙNG ĐỂ TÁI HIỆN LỖI
// =============================================================================

class LegacyFriendManager {
  userId: string
  db: MockSupabaseDatabase
  outgoing: FriendItem[] = []
  friends: FriendItem[] = []
  notifications: string[] = []

  constructor(userId: string, db: MockSupabaseDatabase) {
    this.userId = userId
    this.db = db
  }

  // BUG Trong MomentsClient cũ: Chỉ xóa bảng friendships, BỎ QUÊN bảng friend_requests
  async handleRemoveFriend(fr: FriendItem): Promise<void> {
    this.db.deleteFriendship(fr.id)
    this.friends = this.friends.filter((f) => f.id !== fr.id)
    this.notifications.push(`Đã hủy kết bạn với ${fr.profile.name}`)
    // BUG: friend_requests cũ với status = 'accepted' vẫn nằm nguyên trong DB!
  }

  // BUG Trong MomentsClient cũ: Nuốt lỗi 23505
  async handleSendFriendRequest(targetId: string, targetName: string): Promise<boolean> {
    const { data: insertedRow, error } = this.db.insertFriendRequest({
      sender_id: this.userId,
      receiver_id: targetId,
      status: 'pending',
    })

    // BUG NGHIÊM TRỌNG: Nuốt lỗi 23505!
    if (error && error.code !== '23505') throw error

    // Nếu có lỗi 23505, insertedRow = null nhưng UI vẫn tạo mock id giả
    const newReqItem: FriendItem = {
      id: insertedRow?.id || `req-${Date.now()}`,
      profile: {
        id: targetId,
        name: targetName,
        photos: [],
        church: '',
      },
    }

    // UI hiển thị giả mạo là đã gửi thành công
    this.outgoing.push(newReqItem)
    this.notifications.push(`Đã gửi lời mời tới ${targetName}`)
    return true
  }

  // Khi refreshConnections đồng bộ lại từ DB
  refreshConnections(): void {
    // Chỉ lấy các request có status = 'pending' và sender_id = userId thực tế trong DB
    const actualOutgoingInDb = this.db.friendRequests.filter(
      (r) => r.sender_id === this.userId && r.status === 'pending'
    )
    this.outgoing = actualOutgoingInDb.map((r) => ({
      id: r.id,
      profile: { id: r.receiver_id, name: 'Người dùng', photos: [], church: '' },
    }))
  }
}

// =============================================================================
// LOGIC CHUẨN CẦN ĐẠT (EXPECTED SPECIFICATION / FIXED LOGIC)
// =============================================================================

class FixedFriendManager {
  userId: string
  db: MockSupabaseDatabase
  outgoing: FriendItem[] = []
  incoming: FriendItem[] = []
  friends: FriendItem[] = []
  notifications: string[] = []

  constructor(userId: string, db: MockSupabaseDatabase) {
    this.userId = userId
    this.db = db
  }

  /**
   * [Test 2]: handleRemoveFriend chuẩn
   * Phải đồng thời xóa bản ghi trong friend_requests giữa 2 người dùng (cả 2 chiều)
   */
  async handleRemoveFriend(fr: FriendItem): Promise<void> {
    // 1. Xóa trong friendships
    this.db.deleteFriendship(fr.id)

    // 2. Đồng thời dọn dẹp triệt để trong friend_requests (cả 2 chiều)
    this.db.deleteFriendRequestsBetween(this.userId, fr.profile.id)

    this.friends = this.friends.filter((f) => f.id !== fr.id)
    this.notifications.push(`Đã hủy kết bạn với ${fr.profile.name}`)
  }

  /**
   * [Test 3] & [Test 4]: handleSendFriendRequest chuẩn
   * - Kiểm tra nếu đã là bạn bè -> báo lỗi và dừng
   * - Kiểm tra nếu đã có outgoing pending -> báo lỗi và dừng
   * - Kiểm tra nếu đang có incoming pending -> thông báo chấp nhận
   * - Tự động dọn dẹp bản ghi cũ không còn pending
   * - KHÔNG nuốt lỗi 23505 (ném lỗi nếu có lỗi DB)
   */
  async handleSendFriendRequest(
    targetId: string,
    targetName: string
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Kiểm tra đã là bạn bè chưa
    const alreadyFriends = this.friends.some((f) => f.profile.id === targetId)
    if (alreadyFriends) {
      const msg = `Bạn và ${targetName} đã là bạn bè`
      this.notifications.push(msg)
      return { success: false, error: msg }
    }

    // 2. Kiểm tra đã có outgoing pending chưa
    const hasOutgoing = this.outgoing.some((r) => r.profile.id === targetId)
    if (hasOutgoing) {
      const msg = `Bạn đã gửi lời mời tới ${targetName} rồi, vui lòng chờ phản hồi`
      this.notifications.push(msg)
      return { success: false, error: msg }
    }

    // 3. Kiểm tra có incoming pending từ người đó không
    const hasIncoming = this.incoming.some((r) => r.profile.id === targetId)
    if (hasIncoming) {
      const msg = `${targetName} đã gửi lời mời kết bạn cho bạn, hãy chấp nhận lời mời`
      this.notifications.push(msg)
      return { success: false, error: msg }
    }

    // 4. Dọn dẹp bản ghi cũ / stale (đã accepted hoặc rejected từ trước) trước khi INSERT
    this.db.deleteFriendRequestsBetween(this.userId, targetId)

    // 5. INSERT bản ghi mới
    const { data: insertedRow, error } = this.db.insertFriendRequest({
      sender_id: this.userId,
      receiver_id: targetId,
      status: 'pending',
    })

    // [Test 4]: KHÔNG NUỐT LỖI 23505!
    if (error) {
      throw new Error(`Gửi lời mời thất bại: ${error.message}`)
    }

    const newReqItem: FriendItem = {
      id: insertedRow!.id,
      profile: {
        id: targetId,
        name: targetName,
        photos: [],
        church: '',
      },
    }

    this.outgoing.push(newReqItem)
    this.notifications.push(`Đã gửi lời mời tới ${targetName}`)
    return { success: true }
  }

  refreshConnections(): void {
    const actualOutgoing = this.db.friendRequests.filter(
      (r) => r.sender_id === this.userId && r.status === 'pending'
    )
    this.outgoing = actualOutgoing.map((r) => ({
      id: r.id,
      profile: { id: r.receiver_id, name: 'Người dùng', photos: [], church: '' },
    }))

    const actualIncoming = this.db.friendRequests.filter(
      (r) => r.receiver_id === this.userId && r.status === 'pending'
    )
    this.incoming = actualIncoming.map((r) => ({
      id: r.id,
      profile: { id: r.sender_id, name: 'Người gửi', photos: [], church: '' },
    }))
  }
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Regression Tests: Reconnect After Unfriend (Hủy kết bạn rồi kết bạn lại)', () => {
  let db: MockSupabaseDatabase
  const userA = 'user-a-uuid-1111'
  const userB = 'user-b-uuid-2222'

  beforeEach(() => {
    db = new MockSupabaseDatabase()
  })

  // ---------------------------------------------------------------------------
  // [TEST 1]: TÁI HIỆN LỖI CODE CŨ
  // ---------------------------------------------------------------------------
  describe('[Test 1]: Tái hiện bug: friend_requests cũ gây lỗi 23505 và bị nuốt lỗi', () => {
    it('lệnh INSERT bị PostgreSQL từ chối với mã lỗi 23505 khi bản ghi cũ còn tồn tại', () => {
      // Giả lập 2 người từng kết bạn trong quá khứ
      db.friendRequests.push({
        id: 'req-old-001',
        sender_id: userA,
        receiver_id: userB,
        status: 'accepted',
        created_at: '2026-10-01T00:00:00Z',
      })

      // Cố gắng INSERT một request mới mà không dọn dẹp bản ghi cũ
      const result = db.insertFriendRequest({
        sender_id: userA,
        receiver_id: userB,
        status: 'pending',
      })

      // Ghi nhận hành vi: PostgreSQL chặn vi phạm unique constraint
      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('23505')
      expect(result.error.message).toContain('unique_friend_request')
    })

    it('[BUG REPRODUCTION] Code cũ nuốt lỗi 23505 khiến UI tạo lời mời giả, sau khi refresh lời mời biến mất', async () => {
      // Thiết lập trạng thái: A và B đang là bạn bè
      const friendshipId = 'friendship-ab-001'
      db.friendships.push({
        id: friendshipId,
        user1_id: userA,
        user2_id: userB,
        created_at: '2026-10-01T00:00:00Z',
      })
      db.friendRequests.push({
        id: 'req-old-001',
        sender_id: userA,
        receiver_id: userB,
        status: 'accepted',
        created_at: '2026-10-01T00:00:00Z',
      })

      const legacyManagerA = new LegacyFriendManager(userA, db)
      legacyManagerA.friends.push({
        id: friendshipId,
        profile: { id: userB, name: 'User B', photos: [], church: '' },
      })

      // BƯỚC 1: A bấm HỦY KẾT BẠN với B
      await legacyManagerA.handleRemoveFriend(legacyManagerA.friends[0])

      // friendships đã bị xóa
      expect(db.friendships.length).toBe(0)
      // NHƯNG friend_requests cũ VẪN CÒN trong DB (BUG 1)
      expect(db.friendRequests.length).toBe(1)
      expect(db.friendRequests[0].status).toBe('accepted')

      // BƯỚC 2: A gửi lời mời kết bạn LẠI tới B
      await legacyManagerA.handleSendFriendRequest(userB, 'User B')

      // UI hiển thị giả mạo là đã gửi (vì code cũ nuốt lỗi 23505 và push req-${Date.now()})
      expect(legacyManagerA.outgoing.length).toBe(1)
      expect(legacyManagerA.notifications).toContain('Đã gửi lời mời tới User B')

      // BƯỚC 3: refreshConnections chạy (hoặc user chuyển tab / reload trang)
      legacyManagerA.refreshConnections()

      // HẬU QUẢ: Lời mời biến mất hoàn toàn! Trong DB không hề có pending request nào được tạo!
      expect(legacyManagerA.outgoing.length).toBe(0)
      const actualPendingInDb = db.friendRequests.filter((r) => r.status === 'pending')
      expect(actualPendingInDb.length).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // [TEST 2]: handleRemoveFriend CHUẨN - DỌN DẸP friend_requests
  // ---------------------------------------------------------------------------
  describe('[Test 2]: handleRemoveFriend dọn dẹp bản ghi friend_requests (cả 2 chiều)', () => {
    it('xóa đồng thời friendships và tất cả bản ghi friend_requests giữa 2 người dùng', async () => {
      // Khởi tạo quan hệ bạn bè giữa A và B
      const friendshipId = 'friendship-ab-002'
      db.friendships.push({
        id: friendshipId,
        user1_id: userA,
        user2_id: userB,
        created_at: '2026-10-10T00:00:00Z',
      })
      // Bản ghi request cũ (B từng gửi cho A)
      db.friendRequests.push({
        id: 'req-accepted-ba',
        sender_id: userB,
        receiver_id: userA,
        status: 'accepted',
        created_at: '2026-10-10T00:00:00Z',
      })

      const managerA = new FixedFriendManager(userA, db)
      const friendItemB: FriendItem = {
        id: friendshipId,
        profile: { id: userB, name: 'User B', photos: [], church: '' },
      }
      managerA.friends.push(friendItemB)

      // Thực hiện hủy kết bạn
      await managerA.handleRemoveFriend(friendItemB)

      // Kiểm tra: Cả friendships VÀ friend_requests đều đã sạch bóng
      expect(db.friendships.length).toBe(0)
      expect(db.friendRequests.length).toBe(0)
      expect(managerA.friends.length).toBe(0)
    })

    it('dọn dẹp cả bản ghi chiều ngược lại (sender_id: B, receiver_id: A)', async () => {
      db.friendships.push({
        id: 'f-1',
        user1_id: userB,
        user2_id: userA,
        created_at: '2026-10-01T00:00:00Z',
      })
      db.friendRequests.push({
        id: 'r-1',
        sender_id: userB,
        receiver_id: userA,
        status: 'accepted',
        created_at: '2026-10-01T00:00:00Z',
      })

      const managerB = new FixedFriendManager(userB, db)
      await managerA_removes_B(managerB, 'f-1', userA)

      expect(db.friendRequests.length).toBe(0)
    })

    async function managerA_removes_B(manager: FixedFriendManager, fId: string, peerId: string) {
      await manager.handleRemoveFriend({
        id: fId,
        profile: { id: peerId, name: 'Peer', photos: [], church: '' },
      })
    }
  })

  // ---------------------------------------------------------------------------
  // [TEST 3]: handleSendFriendRequest KIỂM TRA TRẠNG THÁI TRƯỚC KHI TẠO LỜI MỜI
  // ---------------------------------------------------------------------------
  describe('[Test 3]: handleSendFriendRequest kiểm tra trạng thái và dọn dẹp trước khi INSERT', () => {
    let managerA: FixedFriendManager

    beforeEach(() => {
      managerA = new FixedFriendManager(userA, db)
    })

    it('thông báo và dừng lại nếu hai người đã là bạn bè', async () => {
      managerA.friends.push({
        id: 'friend-b',
        profile: { id: userB, name: 'User B', photos: [], church: '' },
      })

      const result = await managerA.handleSendFriendRequest(userB, 'User B')

      expect(result.success).toBe(false)
      expect(result.error).toContain('đã là bạn bè')
      // Không ghi vào DB
      expect(db.friendRequests.length).toBe(0)
    })

    it('thông báo và dừng lại nếu đã có lời mời gửi đi đang chờ (outgoing pending)', async () => {
      managerA.outgoing.push({
        id: 'req-pending-b',
        profile: { id: userB, name: 'User B', photos: [], church: '' },
      })

      const result = await managerA.handleSendFriendRequest(userB, 'User B')

      expect(result.success).toBe(false)
      expect(result.error).toContain('đã gửi lời mời tới User B rồi')
      expect(db.friendRequests.length).toBe(0)
    })

    it('thông báo hướng dẫn chấp nhận nếu đang có lời mời đến từ người đó (incoming pending)', async () => {
      managerA.incoming.push({
        id: 'req-incoming-from-b',
        profile: { id: userB, name: 'User B', photos: [], church: '' },
      })

      const result = await managerA.handleSendFriendRequest(userB, 'User B')

      expect(result.success).toBe(false)
      expect(result.error).toContain('hãy chấp nhận lời mời')
      expect(db.friendRequests.length).toBe(0)
    })

    it('tự động dọn dẹp bản ghi cũ / rejected trước khi INSERT để đảm bảo không bị 23505', async () => {
      // Giả lập còn sót bản ghi rejected cũ trong DB
      db.friendRequests.push({
        id: 'req-rejected-old',
        sender_id: userA,
        receiver_id: userB,
        status: 'rejected',
        created_at: '2026-09-01T00:00:00Z',
      })

      const result = await managerA.handleSendFriendRequest(userB, 'User B')

      expect(result.success).toBe(true)
      // Bản ghi cũ đã được dọn sạch, thay bằng bản ghi pending mới
      expect(db.friendRequests.length).toBe(1)
      expect(db.friendRequests[0].status).toBe('pending')
      expect(db.friendRequests[0].sender_id).toBe(userA)
      expect(db.friendRequests[0].receiver_id).toBe(userB)
    })
  })

  // ---------------------------------------------------------------------------
  // [TEST 4]: KHÔNG NUỐT LỖI 23505 & ĐỒNG BỘ ĐẦY ĐỦ CHO NGƯỜI NHẬN
  // ---------------------------------------------------------------------------
  describe('[Test 4]: Không nuốt lỗi 23505, đảm bảo lời mời mới tồn tại thực sự và người nhận thấy trong incoming', () => {
    it('ném lỗi rõ ràng nếu có lỗi DB thực sự xảy ra thay vì giả mạo thành công', async () => {
      const brokenDb = new MockSupabaseDatabase()
      // Giả lập DB bị lỗi không thể giải quyết
      brokenDb.insertFriendRequest = () => ({
        data: null,
        error: { code: '42P01', message: 'relation "friend_requests" does not exist' },
      })

      const manager = new FixedFriendManager(userA, brokenDb)

      await expect(manager.handleSendFriendRequest(userB, 'User B')).rejects.toThrow(
        'Gửi lời mời thất bại: relation "friend_requests" does not exist'
      )
    })

    it('toàn bộ luồng hoàn chỉnh: Hủy kết bạn -> Gửi kết bạn lại -> Người nhận thấy trong danh sách incoming', async () => {
      // 1. Trạng thái ban đầu: A và B là bạn bè
      const fId = 'f-ab-complete'
      db.friendships.push({ id: fId, user1_id: userA, user2_id: userB, created_at: '2026-10-01T00:00:00Z' })
      db.friendRequests.push({ id: 'r-ab-initial', sender_id: userA, receiver_id: userB, status: 'accepted', created_at: '2026-10-01T00:00:00Z' })

      const managerA = new FixedFriendManager(userA, db)
      const managerB = new FixedFriendManager(userB, db)

      managerA.friends.push({ id: fId, profile: { id: userB, name: 'User B', photos: [], church: '' } })
      managerB.friends.push({ id: fId, profile: { id: userA, name: 'User A', photos: [], church: '' } })

      // 2. A hủy kết bạn với B
      await managerA.handleRemoveFriend(managerA.friends[0])

      // Xác nhận DB đã sạch
      expect(db.friendships.length).toBe(0)
      expect(db.friendRequests.length).toBe(0)

      // 3. A gửi lời mời kết bạn lại cho B
      const sendRes = await managerA.handleSendFriendRequest(userB, 'User B')
      expect(sendRes.success).toBe(true)

      // 4. Đồng bộ kết nối ở cả 2 phía
      managerA.refreshConnections()
      managerB.refreshConnections()

      // Phía A: Outgoing hiển thị đúng lời mời gửi đi
      expect(managerA.outgoing.length).toBe(1)
      expect(managerA.outgoing[0].profile.id).toBe(userB)

      // Phía B: Incoming hiển thị đúng lời mời nhận được từ A!
      expect(managerB.incoming.length).toBe(1)
      expect(managerB.incoming[0].profile.id).toBe(userA)
      expect(db.friendRequests.length).toBe(1)
      expect(db.friendRequests[0].status).toBe('pending')
    })
  })
})
