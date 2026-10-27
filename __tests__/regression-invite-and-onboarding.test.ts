/**
 * @jest-environment node
 */
/**
 * __tests__/regression-invite-and-onboarding.test.ts
 *
 * Bộ test hồi quy (Regression Tests) cho 2 lỗi hồi quy P0:
 * 1. Lỗi 1: Gửi kết bạn bằng mã mời VOW-XXXXXX (RPC array unpacking, UUID fallback không dùng ilike, chặn kết bạn chính mình)
 * 2. Lỗi 2: User mới bỏ qua onboarding (Onboarding Guard & redirectAfterLogin)
 */

interface ProfileRecord {
  id: string
  username: string | null
  full_name: string | null
  avatar_url?: string | null
  church_name?: string | null
  is_complete?: boolean | null
}

interface FriendRequestInsert {
  sender_id: string
  receiver_id: string
  status: string
}

// =============================================================================
// LOGIC HIỆN TẠI (CHỨA BUG) - DÙNG ĐỂ TÁI HIỆN LỖI (BUG REPRODUCTION)
// =============================================================================

/**
 * Mô phỏng logic tìm target hiện tại trong MomentsClient.tsx (lines 1555-1578)
 * CHỨA 2 BUG:
 * 1. rpcData.id: rpcData là mảng [{ id: ... }], truy cập rpcData.id trả về undefined
 * 2. Fallback dùng .or(`username.ilike.${code},id.ilike.${cleanPrefix}%`), gây lỗi SQL UUID ilike
 */
async function legacyFindTargetByInviteCode(
  supabase: any,
  code: string,
  userId: string
): Promise<{ target: ProfileRecord | null; error?: string; usedQuery?: string }> {
  let target: any = null

  // 1. Gọi RPC find_profile_by_invite_code
  try {
    const { data: rpcData } = await supabase.rpc('find_profile_by_invite_code', { code })
    // BUGGY: rpcData là Array [{ id: ... }], rpcData.id là undefined!
    if (rpcData && rpcData.id && rpcData.id !== userId) {
      target = rpcData
    }
  } catch {}

  // 2. Fallback nếu RPC chưa triển khai hoặc không tìm thấy target
  let usedQuery = ''
  if (!target) {
    const cleanPrefix = code.replace(/^(FC|VOW)-/, '').toLowerCase()
    usedQuery = `username.ilike.${code},id.ilike.${cleanPrefix}%`

    // Kiểm tra giả lập xem PostgREST có chấp nhận id.ilike trên cột UUID không
    if (usedQuery.includes('id.ilike.')) {
      // Trong PostgreSQL: operator does not exist: uuid ~~* unknown
      // PostgREST trả về HTTP 400 Bad Request
      const postgrestError = new Error('operator does not exist: uuid ~~* unknown (code: 42883)')
      return { target: null, error: postgrestError.message, usedQuery }
    }

    const { data: directMatches } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, church_name')
      .neq('id', userId)
      .or(usedQuery)
      .limit(1)

    if (Array.isArray(directMatches) && directMatches.length > 0) {
      target = directMatches[0]
    }
  }

  if (!target) {
    return { target: null, error: 'Không tìm thấy người dùng với mã mời này', usedQuery }
  }

  return { target, usedQuery }
}

/**
 * Mô phỏng Onboarding Guard cũ tại app/(main)/tim-chua-truoc/page.tsx:
 * `if (profile && profile.is_complete === false) redirect('/onboarding')`
 * CHỨA BUG: Bỏ sót profile === null, profile.is_complete === null, profile.full_name rỗng
 */
function legacyOnboardingGuard(profile: ProfileRecord | null): string | null {
  if (profile && profile.is_complete === false) {
    return '/onboarding'
  }
  return '/tim-chua-truoc' // Cho phép vào app
}

/**
 * Mô phỏng redirectAfterLogin cũ tại app/(auth)/dang-nhap/page.tsx:
 * router.replace('/tim-chua-truoc')
 * CHỨA BUG: Không kiểm tra trạng thái profile, chuyển thẳng vào /tim-chua-truoc
 */
async function legacyRedirectAfterLogin(
  supabase: any,
  router: { replace: (url: string) => void }
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Không lấy được phiên đăng nhập.')
  router.replace('/tim-chua-truoc')
  return '/tim-chua-truoc'
}

// =============================================================================
// LOGIC CHUẨN CẦN ĐẠT (EXPECTED SPECIFICATION / FIXED LOGIC)
// =============================================================================

/**
 * Hàm chuẩn: Chuyển đổi mã prefix 6 hex char thành UUID range an toàn cho PostgREST
 * Ví dụ: '1a594b' -> { gte: '1a594b00-0000-0000-0000-000000000000', lte: '1a594bff-ffff-ffff-ffff-ffffffffffff' }
 */
function getUuidRangeFromPrefix(cleanPrefix: string): { gte: string; lte: string } | null {
  const hexOnly = cleanPrefix.replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  if (hexOnly.length < 4 || hexOnly.length > 32) return null
  const minSuffix = '0'.repeat(32 - hexOnly.length)
  const maxSuffix = 'f'.repeat(32 - hexOnly.length)
  const formatUuid = (hex: string) =>
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  return {
    gte: formatUuid(hexOnly + minSuffix),
    lte: formatUuid(hexOnly + maxSuffix),
  }
}

/**
 * Hàm xử lý chuẩn cho tìm kiếm mã mời (Lỗi 1):
 * - Bóc tách đúng rpcData[0] khi trả về mảng PostgreSQL RETURNS TABLE
 * - Fallback không dùng id.ilike trên UUID (dùng range UUID hoặc username lookup)
 * - Chặn kết bạn với chính mình
 */
async function expectedFindTargetByInviteCode(
  supabase: any,
  code: string,
  userId: string
): Promise<{ target: ProfileRecord | null; error?: string; usedQuery?: string }> {
  const cleanCode = code.trim().toUpperCase()
  if (!cleanCode) return { target: null, error: 'Mã không hợp lệ' }

  let target: ProfileRecord | null = null

  // 1. Gọi RPC find_profile_by_invite_code
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('find_profile_by_invite_code', {
      code: cleanCode,
    })

    if (!rpcError && rpcData) {
      // Bóc tách đúng: nếu là Array thì lấy rpcData[0], nếu là Object đơn thì lấy rpcData
      const found = Array.isArray(rpcData) ? rpcData[0] : rpcData
      if (found && found.id) {
        if (found.id === userId) {
          return { target: null, error: 'Không thể kết bạn với chính mình' }
        }
        target = found
      }
    }
  } catch {}

  // 2. Fallback nếu RPC không khả dụng hoặc trả về rỗng
  let usedQuery = ''
  if (!target) {
    const cleanPrefix = cleanCode.replace(/^(FC|VOW)-/, '').toLowerCase()
    const uuidRange = getUuidRangeFromPrefix(cleanPrefix)

    if (uuidRange) {
      // Dùng range gte/lte hợp lệ cho cột UUID thay vì ilike
      usedQuery = `id.gte.${uuidRange.gte},id.lte.${uuidRange.lte}`
      const { data: rangeMatches } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, church_name')
        .neq('id', userId)
        .gte('id', uuidRange.gte)
        .lte('id', uuidRange.lte)
        .limit(1)

      if (Array.isArray(rangeMatches) && rangeMatches.length > 0) {
        target = rangeMatches[0]
      }
    }

    // Nếu vẫn chưa tìm thấy, thử tìm theo username chính xác
    if (!target) {
      usedQuery = `username.eq.${cleanCode}`
      const { data: userMatches } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, church_name')
        .neq('id', userId)
        .ilike('username', cleanCode)
        .limit(1)

      if (Array.isArray(userMatches) && userMatches.length > 0) {
        target = userMatches[0]
      }
    }
  }

  if (!target) {
    return { target: null, error: 'Không tìm thấy người dùng với mã mời này', usedQuery }
  }

  if (target.id === userId) {
    return { target: null, error: 'Không thể kết bạn với chính mình', usedQuery }
  }

  return { target, usedQuery }
}

/**
 * Onboarding Guard chuẩn (Lỗi 2a, 2b, 2c, 2d):
 * BẮT BUỘC chuyển hướng /onboarding nếu:
 * - profile === null
 * - profile.is_complete !== true
 * - profile.full_name rỗng / chỉ có khoảng trắng / null
 */
function expectedOnboardingGuard(profile: ProfileRecord | null): string {
  if (
    !profile ||
    profile.is_complete !== true ||
    !profile.full_name ||
    profile.full_name.trim().length === 0
  ) {
    return '/onboarding'
  }
  return '/tim-chua-truoc'
}

/**
 * redirectAfterLogin chuẩn (Lỗi 2e):
 * Kiểm tra trạng thái hồ sơ trước khi điều hướng
 */
async function expectedRedirectAfterLogin(
  supabase: any,
  router: { replace: (url: string) => void }
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    throw new Error('Không lấy được phiên đăng nhập.')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_complete, full_name')
    .eq('id', session.user.id)
    .maybeSingle()

  const destination = expectedOnboardingGuard(profile)
  router.replace(destination)
  return destination
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Regression Tests: P0 Bugs (Invite Code & Onboarding Guard)', () => {
  const currentUserId = '00000000-0000-0000-0000-000000000000'
  const friendUserId = '1a594b00-0000-0000-0000-000000000001'
  const friendProfile: ProfileRecord = {
    id: friendUserId,
    username: 'john',
    full_name: 'John Doe',
    avatar_url: null,
    church_name: 'Hội Thánh Tin Lành',
  }

  // ---------------------------------------------------------------------------
  // 1. LỖI 1: GỬI KẾT BẠN BẰNG MÃ MỜI VOW-XXXXXX
  // ---------------------------------------------------------------------------
  describe('Lỗi 1: Gửi kết bạn bằng mã mời VOW-XXXXXX', () => {
    describe('1.a) Tái hiện & Kiểm tra xử lý mảng trả về từ RPC find_profile_by_invite_code', () => {
      it('[BUG REPRODUCTION] Logic cũ thất bại khi RPC trả về Array [{ id: ... }] vì rpcData.id là undefined', async () => {
        const mockSupabase = {
          rpc: jest.fn().mockResolvedValue({
            // Chuẩn PostgreSQL RETURNS TABLE trả về mảng các dòng
            data: [friendProfile],
            error: null,
          }),
          from: jest.fn(),
        }

        const result = await legacyFindTargetByInviteCode(mockSupabase, 'VOW-1A594B', currentUserId)

        // TÁI HIỆN BUG: Logic cũ không lấy được profile từ RPC vì kiểm tra rpcData.id (undefined)
        // và rơi vào fallback bị lỗi cú pháp UUID ilike
        expect(mockSupabase.rpc).toHaveBeenCalledWith('find_profile_by_invite_code', {
          code: 'VOW-1A594B',
        })
        expect(result.target).toBeNull()
        expect(result.error).toBeDefined()
      })

      it('[EXPECTED FIX] Hàm xử lý bóc tách đúng phần tử đầu tiên rpcData[0] từ mảng RPC', async () => {
        const mockSupabase = {
          rpc: jest.fn().mockResolvedValue({
            data: [friendProfile],
            error: null,
          }),
        }

        const result = await expectedFindTargetByInviteCode(mockSupabase, 'VOW-1A594B', currentUserId)

        expect(result.target).not.toBeNull()
        expect(result.target?.id).toBe(friendUserId)
        expect(result.target?.full_name).toBe('John Doe')
        expect(result.target?.church_name).toBe('Hội Thánh Tin Lành')
      })

      it('[EXPECTED FIX] Phòng thủ: Xử lý an toàn cả khi RPC trả về mảng [row] hoặc object đơn row', async () => {
        // Trường hợp 1: Trả về Object đơn lẻ
        const mockSupabaseSingle = {
          rpc: jest.fn().mockResolvedValue({
            data: friendProfile,
            error: null,
          }),
        }
        const singleResult = await expectedFindTargetByInviteCode(
          mockSupabaseSingle,
          'VOW-1A594B',
          currentUserId
        )
        expect(singleResult.target?.id).toBe(friendUserId)

        // Trường hợp 2: Trả về Mảng nhiều dòng (lấy dòng đầu tiên)
        const mockSupabaseMulti = {
          rpc: jest.fn().mockResolvedValue({
            data: [friendProfile, { ...friendProfile, id: 'extra-id' }],
            error: null,
          }),
        }
        const multiResult = await expectedFindTargetByInviteCode(
          mockSupabaseMulti,
          'VOW-1A594B',
          currentUserId
        )
        expect(multiResult.target?.id).toBe(friendUserId)
      })
    })

    describe('1.b) Tái hiện & Kiểm tra luồng Fallback khi RPC không khả dụng', () => {
      it('[BUG REPRODUCTION] Logic cũ tạo chuỗi truy vấn id.ilike. prefix% gây lỗi 400 Bad Request trên PostgreSQL UUID', async () => {
        const mockSupabase = {
          // Giả lập RPC không tồn tại / trả về rỗng
          rpc: jest.fn().mockResolvedValue({ data: null, error: new Error('function does not exist') }),
          from: jest.fn(),
        }

        const result = await legacyFindTargetByInviteCode(mockSupabase, 'VOW-1A594B', currentUserId)

        // Ghi nhận hành vi: Query chứa `id.ilike.` trên cột UUID gây crash
        expect(result.usedQuery).toContain('id.ilike.')
        expect(result.error).toContain('operator does not exist: uuid ~~* unknown')
        expect(result.target).toBeNull()
      })

      it('[EXPECTED FIX] Luồng fallback tìm kiếm user theo tiền tố UUID mà KHÔNG dùng cú pháp id.ilike', async () => {
        const mockFrom = jest.fn()
        const mockSelect = jest.fn()
        const mockNeq = jest.fn()
        const mockGte = jest.fn()
        const mockLte = jest.fn()
        const mockLimit = jest.fn()

        mockFrom.mockReturnValue({ select: mockSelect })
        mockSelect.mockReturnValue({ neq: mockNeq })
        mockNeq.mockReturnValue({ gte: mockGte })
        mockGte.mockReturnValue({ lte: mockLte })
        mockLte.mockReturnValue({ limit: mockLimit })
        mockLimit.mockResolvedValue({ data: [friendProfile], error: null })

        const mockSupabase = {
          rpc: jest.fn().mockResolvedValue({ data: [], error: null }), // RPC rỗng
          from: mockFrom,
        }

        const result = await expectedFindTargetByInviteCode(mockSupabase, 'VOW-1A594B', currentUserId)

        // Xác nhận query KHÔNG chứa id.ilike
        expect(result.usedQuery).not.toContain('id.ilike.')
        expect(mockFrom).toHaveBeenCalledWith('profiles')
        // Xác nhận sử dụng range hợp lệ trên cột UUID
        expect(mockGte).toHaveBeenCalledWith('id', '1a594b00-0000-0000-0000-000000000000')
        expect(mockLte).toHaveBeenCalledWith('id', '1a594bff-ffff-ffff-ffff-ffffffffffff')
        expect(result.target?.id).toBe(friendUserId)
      })

      it('[EXPECTED FIX] Trả về thông báo lỗi thân thiện khi không tìm thấy mã ở cả RPC và Fallback', async () => {
        const mockSupabase = {
          rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              neq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
                ilike: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }

        const result = await expectedFindTargetByInviteCode(mockSupabase, 'VOW-999999', currentUserId)
        expect(result.target).toBeNull()
        expect(result.error).toBe('Không tìm thấy người dùng với mã mời này')
      })
    })

    describe('1.c) Chặn kết bạn với chính mình (self-friend request prevention)', () => {
      it('[EXPECTED FIX] Từ chối khi RPC trả về profile trùng với userId của người gửi', async () => {
        const mockSupabase = {
          rpc: jest.fn().mockResolvedValue({
            data: [{ ...friendProfile, id: currentUserId }], // Trùng với currentUserId
            error: null,
          }),
        }

        const result = await expectedFindTargetByInviteCode(mockSupabase, 'VOW-000000', currentUserId)

        expect(result.target).toBeNull()
        expect(result.error).toBe('Không thể kết bạn với chính mình')
      })

      it('[EXPECTED FIX] Từ chối khi fallback trả về chính mình và không cho phép insert', async () => {
        const mockSupabase = {
          rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              neq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    // Giả lập DB trả về chính user do query lọt
                    limit: jest.fn().mockResolvedValue({
                      data: [{ ...friendProfile, id: currentUserId }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }

        const result = await expectedFindTargetByInviteCode(mockSupabase, 'VOW-000000', currentUserId)
        expect(result.target).toBeNull()
        expect(result.error).toBe('Không thể kết bạn với chính mình')
      })
    })
  })

  // ---------------------------------------------------------------------------
  // 2. LỖI 2: USER MỚI BỎ QUA ONBOARDING
  // ---------------------------------------------------------------------------
  describe('Lỗi 2: User mới bỏ qua onboarding', () => {
    describe('2.a, 2.b, 2.c, 2.d) Kiểm tra Onboarding Guard', () => {
      it('[BUG REPRODUCTION] Logic cũ để lọt profile === null vào giao diện chính /tim-chua-truoc', () => {
        // TÁI HIỆN BUG: profile && profile.is_complete === false trả về null -> người dùng vào thẳng app!
        const destination = legacyOnboardingGuard(null)
        expect(destination).toBe('/tim-chua-truoc')
      })

      it('[BUG REPRODUCTION] Logic cũ để lọt is_complete === null hoặc thiếu full_name vào /tim-chua-truoc', () => {
        // TÁI HIỆN BUG: is_complete === null không khớp với false
        const destNullComplete = legacyOnboardingGuard({
          id: 'user-1',
          username: 'test',
          full_name: 'Test Name',
          is_complete: null,
        })
        expect(destNullComplete).toBe('/tim-chua-truoc')

        // TÁI HIỆN BUG: is_complete === true nhưng full_name rỗng
        const destEmptyName = legacyOnboardingGuard({
          id: 'user-2',
          username: 'test',
          full_name: '',
          is_complete: true,
        })
        expect(destEmptyName).toBe('/tim-chua-truoc')
      })

      it('2.a) [EXPECTED FIX] User chưa có profile (profile === null): BẮT BUỘC chuyển hướng về /onboarding', () => {
        const destination = expectedOnboardingGuard(null)
        expect(destination).toBe('/onboarding')
      })

      it('2.b) [EXPECTED FIX] User có profile nhưng is_complete === false: BẮT BUỘC chuyển hướng về /onboarding', () => {
        const destination = expectedOnboardingGuard({
          id: 'user-1',
          username: 'new_user',
          full_name: 'Người Mới',
          is_complete: false,
        })
        expect(destination).toBe('/onboarding')
      })

      it('2.b) [EXPECTED FIX] User có profile nhưng is_complete === null: BẮT BUỘC chuyển hướng về /onboarding', () => {
        const destination = expectedOnboardingGuard({
          id: 'user-1',
          username: 'new_user',
          full_name: 'Người Mới',
          is_complete: null,
        })
        expect(destination).toBe('/onboarding')
      })

      it('2.c) [EXPECTED FIX] User có profile nhưng thiếu full_name (chuỗi rỗng): BẮT BUỘC chuyển hướng về /onboarding', () => {
        const destinationEmpty = expectedOnboardingGuard({
          id: 'user-1',
          username: 'new_user',
          full_name: '',
          is_complete: true,
        })
        expect(destinationEmpty).toBe('/onboarding')

        const destinationSpaces = expectedOnboardingGuard({
          id: 'user-1',
          username: 'new_user',
          full_name: '   ',
          is_complete: true,
        })
        expect(destinationSpaces).toBe('/onboarding')

        const destinationNullName = expectedOnboardingGuard({
          id: 'user-1',
          username: 'new_user',
          full_name: null,
          is_complete: true,
        })
        expect(destinationNullName).toBe('/onboarding')
      })

      it('2.d) [EXPECTED FIX] User cũ đã hoàn tất (is_complete === true và full_name đầy đủ): Cho phép vào /tim-chua-truoc', () => {
        const destination = expectedOnboardingGuard({
          id: 'user-old',
          username: 'john_doe',
          full_name: 'John Doe',
          is_complete: true,
        })
        expect(destination).toBe('/tim-chua-truoc')
      })
    })

    describe('2.e) Kiểm tra hàm redirectAfterLogin khi đăng nhập (guest hoặc Google)', () => {
      let mockRouter: { replace: jest.Mock }

      beforeEach(() => {
        mockRouter = { replace: jest.fn() }
      })

      it('[BUG REPRODUCTION] redirectAfterLogin cũ điều hướng thẳng tới /tim-chua-truoc mà không kiểm tra profile', async () => {
        const mockSupabase = {
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: { user: { id: 'new-guest-id' } } },
            }),
          },
        }

        const dest = await legacyRedirectAfterLogin(mockSupabase, mockRouter)

        // TÁI HIỆN BUG: Không query profiles, gọi thẳng replace('/tim-chua-truoc')
        expect(mockRouter.replace).toHaveBeenCalledWith('/tim-chua-truoc')
        expect(dest).toBe('/tim-chua-truoc')
      })

      it('2.e) [EXPECTED FIX] Tài khoản Guest mới (chưa có profile trong DB): điều hướng về /onboarding', async () => {
        const mockSupabase = {
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: { user: { id: 'new-guest-id' } } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null, // Chưa có profile
                  error: null,
                }),
              }),
            }),
          }),
        }

        const dest = await expectedRedirectAfterLogin(mockSupabase, mockRouter)

        expect(dest).toBe('/onboarding')
        expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding')
      })

      it('2.e) [EXPECTED FIX] Tài khoản Google mới (profile có is_complete === false): điều hướng về /onboarding', async () => {
        const mockSupabase = {
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: { user: { id: 'google-user-id' } } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'google-user-id',
                    full_name: 'Google User',
                    is_complete: false,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }

        const dest = await expectedRedirectAfterLogin(mockSupabase, mockRouter)

        expect(dest).toBe('/onboarding')
        expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding')
      })

      it('2.e) [EXPECTED FIX] Tài khoản đăng nhập có profile nhưng full_name rỗng: điều hướng về /onboarding', async () => {
        const mockSupabase = {
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: { user: { id: 'email-user-id' } } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'email-user-id',
                    full_name: '',
                    is_complete: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }

        const dest = await expectedRedirectAfterLogin(mockSupabase, mockRouter)

        expect(dest).toBe('/onboarding')
        expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding')
      })

      it('2.e) [EXPECTED FIX] Tài khoản đã hoàn tất onboarding (is_complete === true & full_name đầy đủ): điều hướng về /tim-chua-truoc', async () => {
        const mockSupabase = {
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: { user: { id: 'verified-user-id' } } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'verified-user-id',
                    full_name: 'Tín Hữu Gắn Bó',
                    is_complete: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }

        const dest = await expectedRedirectAfterLogin(mockSupabase, mockRouter)

        expect(dest).toBe('/tim-chua-truoc')
        expect(mockRouter.replace).toHaveBeenCalledWith('/tim-chua-truoc')
      })

      it('2.e) [EXPECTED FIX] Ném lỗi rõ ràng khi không có session hợp lệ', async () => {
        const mockSupabase = {
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: null },
            }),
          },
        }

        await expect(expectedRedirectAfterLogin(mockSupabase, mockRouter)).rejects.toThrow(
          'Không lấy được phiên đăng nhập.'
        )
        expect(mockRouter.replace).not.toHaveBeenCalled()
      })
    })
  })
})
