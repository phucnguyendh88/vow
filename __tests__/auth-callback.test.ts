/**
 * @jest-environment node
 */
import { GET } from '@/app/auth/callback/route'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Mock dependencies
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

describe('Auth Callback Route Handler (app/auth/callback/route.ts)', () => {
  const originalEnv = process.env.NODE_ENV
  let mockCookieStore: {
    getAll: jest.Mock
    set: jest.Mock
  }
  let mockSupabase: {
    auth: {
      exchangeCodeForSession: jest.Mock
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    mockCookieStore = {
      getAll: jest.fn().mockReturnValue([]),
      set: jest.fn(),
    }
    ;(cookies as jest.Mock).mockResolvedValue(mockCookieStore)

    mockSupabase = {
      auth: {
        exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                is_complete: true,
                full_name: 'Phúc Nguyễn',
                date_of_birth: '1988-01-01',
                gender: 'male',
              },
              error: null,
            }),
          }),
        }),
      }),
    }
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  afterAll(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('should redirect to /dang-nhap?error=missing_code if code is not provided', async () => {
    const request = new Request('http://localhost:3000/auth/callback')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dang-nhap?error=missing_code')
  })

  it('should redirect to /dang-nhap with provider error if error query param is present', async () => {
    const request = new Request('http://localhost:3000/auth/callback?error=access_denied&error_description=User+declined')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dang-nhap?error=access_denied')
  })

  it('should successfully exchange code for session and forward cookies to redirect response', async () => {
    // Giả lập @supabase/ssr gọi setAll khi exchange code
    ;(createServerClient as jest.Mock).mockImplementation((_url, _key, options) => {
      return {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null,
          }),
          exchangeCodeForSession: jest.fn().mockImplementation(async () => {
            options.cookies.setAll([
              {
                name: 'sb-access-token',
                value: 'token_abc123',
                options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
              },
              {
                name: 'sb-refresh-token',
                value: 'refresh_xyz789',
                options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
              },
            ])
            return { data: {}, error: null }
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  is_complete: true,
                  full_name: 'Phúc Nguyễn',
                  date_of_birth: '1988-01-01',
                  gender: 'male',
                },
                error: null,
              }),
            }),
          }),
        }),
      }
    })

    const request = new Request('http://localhost:3000/auth/callback?code=valid-auth-code&next=/ho-so')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/ho-so')

    // Kiểm tra cookieStore đã được gọi
    expect(mockCookieStore.set).toHaveBeenCalledTimes(2)

    // Kiểm tra Set-Cookie headers đã được chuyển tiếp trực tiếp vào redirect response
    const setCookies = response.headers.getSetCookie()
    expect(setCookies.some((c) => c.includes('sb-access-token=token_abc123'))).toBe(true)
    expect(setCookies.some((c) => c.includes('sb-refresh-token=refresh_xyz789'))).toBe(true)
  })

  it('should sanitize next parameter and prevent open redirect attacks', async () => {
    const request = new Request('http://localhost:3000/auth/callback?code=valid-code&next=//attacker.com/steal')
    const response = await GET(request)

    expect(response.status).toBe(307)
    // Phải fallback về /tim-chua-truoc thay vì redirect đến attacker.com
    expect(response.headers.get('location')).toBe('http://localhost:3000/tim-chua-truoc')
  })

  it('should respect x-forwarded-host and x-forwarded-proto in production (Vercel)', async () => {
    process.env.NODE_ENV = 'production'

    const request = new Request('http://internal-cluster:3000/auth/callback?code=valid-code&next=/tim-chua-truoc', {
      headers: {
        'x-forwarded-host': 'vow-dating.vercel.app, proxy2.internal',
        'x-forwarded-proto': 'https',
      },
    })

    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://vow-dating.vercel.app/tim-chua-truoc')
  })

  it('should handle exchangeError gracefully without crashing and redirect to error page', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: null,
      error: {
        name: 'AuthApiError',
        message: 'Invalid authorization code or expired',
        status: 400,
        code: 'bad_code',
      },
    })

    const request = new Request('http://localhost:3000/auth/callback?code=expired-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dang-nhap?error=auth_failed')

    // Kiểm tra log lỗi đã ghi nhận có cấu trúc
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OAuth Callback] Code exchange error:'),
      expect.objectContaining({
        message: 'Invalid authorization code or expired',
        status: 400,
      })
    )

    consoleErrorSpy.mockRestore()
  })
})
