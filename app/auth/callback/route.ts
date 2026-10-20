import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database'

/**
 * OAuth callback handler.
 * Supabase redirect về đây sau khi người dùng xác thực Google OAuth thành công.
 * Thực hiện:
 * 1. Đọc code & an toàn hóa baseUrl / safeNext (hỗ trợ cả localhost và Vercel proxy).
 * 2. Exchange authorization code lấy session bằng @supabase/ssr.
 * 3. Chuyển tiếp tường minh toàn bộ cookie phiên (setAll) vào NextResponse.redirect
 *    để tránh mất session trên các trình duyệt chặn third-party cookie (Safari ITP, Brave, Mobile WebKit).
 * 4. Ghi log lỗi bảo mật không làm lộ secret.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')
  const error = searchParams.get('error')

  // Xử lý fallback URL redirect an toàn cho cả môi trường localhost và production (Vercel)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  let baseUrl = origin
  if (!isLocalEnv && forwardedHost) {
    const host = forwardedHost.split(',')[0].trim()
    const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : 'https'
    baseUrl = `${proto}://${host}`
  }

  // Đảm bảo đường dẫn redirect an toàn, chỉ cho phép relative path bắt đầu bằng '/',
  // chống tấn công Open Redirect (vd: //evil.com hoặc /\evil.com)
  const safeNext =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\')
      ? rawNext
      : '/tim-chua-truoc'

  if (error) {
    const errorDescription = searchParams.get('error_description')
    console.error('[OAuth Callback] Provider returned error:', {
      error,
      errorDescription,
    })
    return NextResponse.redirect(
      new URL(`/dang-nhap?error=${encodeURIComponent(error)}`, baseUrl)
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }> = []

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

    const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookies: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookies.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Bỏ qua lỗi nếu cookieStore ở chế độ read-only
            }
          })
          cookiesToSet.push(...cookies)
        },
      },
    })

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      // Log lỗi có cấu trúc để phục vụ debug nhưng KHÔNG làm lộ secret/tokens
      console.error('[OAuth Callback] Code exchange error:', {
        name: exchangeError.name,
        message: exchangeError.message,
        status: exchangeError.status,
        code: (exchangeError as any).code,
      })
      return NextResponse.redirect(new URL('/dang-nhap?error=auth_failed', baseUrl))
    }

    // Tạo response redirect đến trang đích
    const redirectResponse = NextResponse.redirect(new URL(safeNext, baseUrl))

    // Chuyển tiếp các cookie phiên làm việc đã được setAll vào response
    // để tránh mất session trên các trình duyệt chặn third-party cookie
    cookiesToSet.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options)
    })

    return redirectResponse
  }

  console.warn('[OAuth Callback] Missing authorization code in request')
  return NextResponse.redirect(new URL('/dang-nhap?error=missing_code', baseUrl))
}

