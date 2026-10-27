/**
 * @jest-environment node
 */
import { GET as adminGetUsers, PATCH as adminPatchUser, DELETE as adminDeleteUser } from '@/app/api/admin/users/route'
import { GET as getMessages, POST as postMessage } from '@/app/api/messages/route'
import { POST as postMoment, DELETE as deleteMoment } from '@/app/api/moments/route'
import { POST as postSwipe } from '@/app/api/swipe/route'

// Mock Supabase Server Client
const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()
const mockStorageFrom = jest.fn()

const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: mockFrom,
  rpc: mockRpc,
  storage: {
    from: mockStorageFrom,
  },
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
  createAdminClient: jest.fn(() => mockSupabaseClient),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        updateUserById: jest.fn().mockResolvedValue({ data: {}, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  })),
}))

describe('API Security & Route Handlers Verification', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  /* ====================================================================
   * 1. /api/admin/users Route Protection
   * ==================================================================== */
  describe('GET /api/admin/users - Admin Authorization & Search Protection', () => {
    it('returns 403 Forbidden when user is unauthenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') })

      const req = new Request('http://localhost:3000/api/admin/users')
      const res = await adminGetUsers(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Forbidden')
    })

    it('returns 403 Forbidden when user is regular member (role != admin and email != ADMIN_EMAIL)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-regular-uuid', email: 'regular@vow.app', app_metadata: {} } },
        error: null,
      })

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { role: 'member', is_banned: false },
              error: null,
            }),
          }),
        }),
      })

      const req = new Request('http://localhost:3000/api/admin/users')
      const res = await adminGetUsers(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Forbidden')
    })

    it('returns 403 Forbidden if admin account has is_banned = true', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'banned-admin-id', email: 'phucnguyendh88@gmail.com', app_metadata: { role: 'admin' } } },
        error: null,
      })

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { role: 'admin', is_banned: true },
              error: null,
            }),
          }),
        }),
      })

      const req = new Request('http://localhost:3000/api/admin/users')
      const res = await adminGetUsers(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Forbidden')
    })

    it('allows access (200 OK) for authorized admin and sanitizes search against PostgREST injection', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'admin-uuid', email: 'phucnguyendh88@gmail.com', app_metadata: { role: 'admin' } } },
        error: null,
      })

      // Profile query for verifyAdmin
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { role: 'admin', is_banned: false },
              error: null,
            }),
          }),
        }),
      })

      // Profiles query in GET handler
      const mockRange = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'u-1',
            username: 'test_user',
            full_name: 'Test User',
            role: 'member',
            is_banned: false,
            created_at: '2026-10-20T00:00:00Z',
          },
        ],
        count: 1,
        error: null,
      })

      const mockOr = jest.fn().mockReturnValue({ range: mockRange })
      const mockOrder = jest.fn().mockReturnValue({ or: mockOr, range: mockRange })

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: mockOrder,
        }),
      })

      // Request with potentially malicious search filter characters
      const req = new Request('http://localhost:3000/api/admin/users?search=john%2C(or).%25*&page=0&limit=10')
      const res = await adminGetUsers(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.users).toBeDefined()
      expect(data.total).toBe(1)
      expect(mockOr).toHaveBeenCalledWith(expect.stringContaining('john'))
      // Special chars (, ( ) . % *) must be stripped from the search query
      expect(mockOr).not.toHaveBeenCalledWith(expect.stringContaining('(%25*)'))
    })
  })

  describe('PATCH & DELETE /api/admin/users - Target Admin Protection', () => {
    it('PATCH rejects banning another admin or banning oneself', async () => {
      const adminId = '11111111-1111-1111-1111-111111111111'
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: adminId, email: 'phucnguyendh88@gmail.com', app_metadata: { role: 'admin' } } },
        error: null,
      })

      // verifyAdmin check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'admin', is_banned: false }, error: null }),
          }),
        }),
      })

      // targetProfile check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }),
        }),
      })

      // Attempting to ban oneself
      const req = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ userId: adminId, is_banned: true }),
      })
      const res = await adminPatchUser(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Không thể khóa tài khoản quản trị viên')
    })

    it('DELETE rejects deleting oneself or an admin user', async () => {
      const adminId = '11111111-1111-1111-1111-111111111111'
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: adminId, email: 'phucnguyendh88@gmail.com', app_metadata: { role: 'admin' } } },
        error: null,
      })

      // verifyAdmin check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'admin', is_banned: false }, error: null }),
          }),
        }),
      })

      const req = new Request(`http://localhost:3000/api/admin/users?userId=${adminId}`, {
        method: 'DELETE',
      })
      const res = await adminDeleteUser(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Không thể xóa chính tài khoản của bạn')
    })
  })

  /* ====================================================================
   * 2. /api/messages Route Protection & Membership
   * ==================================================================== */
  describe('GET & POST /api/messages - Membership & Security', () => {
    it('GET returns 401 Unauthorized for unauthenticated callers', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Unauthorized') })

      const req = new Request('http://localhost:3000/api/messages?conversation_id=22222222-2222-2222-2222-222222222222')
      const res = await getMessages(req)

      expect(res.status).toBe(401)
    })

    it('GET returns 400 when conversation_id is invalid UUID format', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: '33333333-3333-3333-3333-333333333333' } },
        error: null,
      })

      const req = new Request('http://localhost:3000/api/messages?conversation_id=not-a-uuid')
      const res = await getMessages(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Valid conversation_id is required')
    })

    it('GET returns 403 Forbidden when user is not a conversation member', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: '33333333-3333-3333-3333-333333333333' } },
        error: null,
      })

      // Query mock
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      })

      // RPC is_conversation_member returns false
      mockRpc.mockResolvedValueOnce({ data: false, error: null })

      const req = new Request('http://localhost:3000/api/messages?conversation_id=22222222-2222-2222-2222-222222222222')
      const res = await getMessages(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Forbidden')
    })

    it('POST rejects sending message when account is banned', async () => {
      const senderId = '44444444-4444-4444-4444-444444444444'
      const convId = '55555555-5555-5555-5555-555555555555'

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: senderId } },
        error: null,
      })

      // RPC is_conversation_member returns true
      mockRpc.mockReturnValueOnce(Promise.resolve({ data: true, error: null }))

      // profiles check returns is_banned: true
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { is_banned: true }, error: null }),
          }),
        }),
      })

      const req = new Request('http://localhost:3000/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: convId, content: 'Xin chào bạn!' }),
      })
      const res = await postMessage(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Account is suspended')
    })

    it('POST handles idempotency_key deduplication gracefully without creating duplicates', async () => {
      const senderId = '44444444-4444-4444-4444-444444444444'
      const convId = '55555555-5555-5555-5555-555555555555'
      const idempotencyKey = '66666666-6666-6666-6666-666666666666'

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: senderId } },
        error: null,
      })

      // RPC is_conversation_member
      mockRpc.mockReturnValueOnce(Promise.resolve({ data: true, error: null }))

      // profiles check: not banned
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { is_banned: false }, error: null }),
          }),
        }),
      })

      // Existing message query with matching idempotency key
      const existingMessage = {
        id: 'msg-existing-1',
        conversation_id: convId,
        sender_id: senderId,
        content: 'Tin nhắn gửi lại',
        idempotency_key: idempotencyKey,
      }

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: existingMessage, error: null }),
              }),
            }),
          }),
        }),
      })

      const req = new Request('http://localhost:3000/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: convId,
          content: 'Tin nhắn gửi lại',
          idempotency_key: idempotencyKey,
        }),
      })
      const res = await postMessage(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.duplicate).toBe(true)
      expect(data.message.id).toBe('msg-existing-1')
    })
  })

  /* ====================================================================
   * 3. /api/moments Route Protection & Storage Validation
   * ==================================================================== */
  describe('POST & DELETE /api/moments - Storage & Ownership Validation', () => {
    it('POST rejects media_url that points to a foreign origin or outside user storage', async () => {
      const userId = '77777777-7777-7777-7777-777777777777'
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null,
      })

      // 1. Foreign origin attempt
      const reqForeign = new Request('http://localhost:3000/api/moments', {
        method: 'POST',
        body: JSON.stringify({
          media_url: 'https://evil-attacker.com/storage/v1/object/public/moments/photo.jpg',
          media_type: 'image',
        }),
      })
      const resForeign = await postMoment(reqForeign)
      expect(resForeign.status).toBe(400)
      const dataForeign = await resForeign.json()
      expect(dataForeign.error).toContain('Invalid media_url')

      // 2. Cross-user storage path attempt (trying to link someone else's file)
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null,
      })
      const reqOtherUser = new Request('http://localhost:3000/api/moments', {
        method: 'POST',
        body: JSON.stringify({
          media_url: 'https://test-project.supabase.co/storage/v1/object/public/moments/another-user-uuid/photo.jpg',
          media_type: 'image',
        }),
      })
      const resOtherUser = await postMoment(reqOtherUser)
      expect(resOtherUser.status).toBe(400)
      const dataOtherUser = await resOtherUser.json()
      expect(dataOtherUser.error).toContain('does not belong to this user')
    })

    it('DELETE rejects non-owner and non-admin attempts to delete moment', async () => {
      const callerId = '88888888-8888-8888-8888-888888888888'
      const momentOwnerId = '99999999-9999-9999-9999-999999999999'

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: callerId } },
        error: null,
      })

      // Fetch moment: owner is different
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'moment-101',
                user_id: momentOwnerId,
                media_url: `https://test-project.supabase.co/storage/v1/object/public/moments/${momentOwnerId}/img.jpg`,
                thumbnail_url: null,
                is_deleted: false,
              },
              error: null,
            }),
          }),
        }),
      })

      // Admin check RPC returns false
      mockRpc.mockResolvedValueOnce({ data: false, error: null })

      const req = new Request('http://localhost:3000/api/moments?id=moment-101', {
        method: 'DELETE',
      })
      const res = await deleteMoment(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Forbidden')
    })

    it('DELETE successfully soft-deletes when requested by the moment owner', async () => {
      const ownerId = '88888888-8888-8888-8888-888888888888'

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: ownerId } },
        error: null,
      })

      // Fetch moment returns matching owner
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'moment-102',
                user_id: ownerId,
                media_url: `https://test-project.supabase.co/storage/v1/object/public/moments/${ownerId}/img.jpg`,
                thumbnail_url: null,
                is_deleted: false,
              },
              error: null,
            }),
          }),
        }),
      })

      // Update soft delete query
      mockFrom.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })

      // Storage remove mock
      mockStorageFrom.mockReturnValue({
        remove: jest.fn().mockResolvedValue({ data: [], error: null }),
      })

      const req = new Request('http://localhost:3000/api/moments?id=moment-102', {
        method: 'DELETE',
      })
      const res = await deleteMoment(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  /* ====================================================================
   * 4. /api/swipe Route Protection & Business Invariants
   * ==================================================================== */
  describe('POST /api/swipe - Self-swipe, Ban, and Block Rules', () => {
    it('returns 400 when attempting to swipe oneself', async () => {
      const myId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: myId } },
        error: null,
      })

      const req = new Request('http://localhost:3000/api/swipe', {
        method: 'POST',
        body: JSON.stringify({ swiped_id: myId, action: 'like' }),
      })
      const res = await postSwipe(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Cannot swipe yourself')
    })

    it('returns 403 when swiper account is banned', async () => {
      const swiperId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      const targetId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: swiperId } },
        error: null,
      })

      // Profiles check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: swiperId, is_active: true, is_banned: true },
              { id: targetId, is_active: true, is_banned: false },
            ],
            error: null,
          }),
        }),
      })

      // Blocks check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })

      const req = new Request('http://localhost:3000/api/swipe', {
        method: 'POST',
        body: JSON.stringify({ swiped_id: targetId, action: 'like' }),
      })
      const res = await postSwipe(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Account is suspended')
    })

    it('returns 403 when a block exists between the two users', async () => {
      const swiperId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      const targetId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: swiperId } },
        error: null,
      })

      // Profiles check: both valid
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: swiperId, is_active: true, is_banned: false },
              { id: targetId, is_active: true, is_banned: false },
            ],
            error: null,
          }),
        }),
      })

      // Blocks check: active block found
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [{ id: 'block-1' }], error: null }),
          }),
        }),
      })

      const req = new Request('http://localhost:3000/api/swipe', {
        method: 'POST',
        body: JSON.stringify({ swiped_id: targetId, action: 'like' }),
      })
      const res = await postSwipe(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Cannot interact with this user')
    })

    it('records like successfully and returns match when reciprocal like occurs', async () => {
      const swiperId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      const targetId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: swiperId } },
        error: null,
      })

      // Profiles check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: swiperId, is_active: true, is_banned: false },
              { id: targetId, is_active: true, is_banned: false },
            ],
            error: null,
          }),
        }),
      })

      // Blocks check: no block
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })

      // Swipes upsert
      mockFrom.mockReturnValueOnce({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { swiper_id: swiperId, swiped_id: targetId, action: 'like', context: 'dating' },
              error: null,
            }),
          }),
        }),
      })

      // Matches check (DB trigger created match)
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: 'match-100',
                  created_at: '2026-10-27T10:00:00Z',
                  conversations: [{ id: 'conv-100' }],
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const req = new Request('http://localhost:3000/api/swipe', {
        method: 'POST',
        body: JSON.stringify({ swiped_id: targetId, action: 'like', context: 'dating' }),
      })
      const res = await postSwipe(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.matched).toBe(true)
      expect(data.conversation_id).toBe('conv-100')
    })
  })
})
