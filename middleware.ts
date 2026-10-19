import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const protectedPaths = ['/tim-chua-truoc', '/khoang-khac', '/ket-noi-sau', '/ho-so', '/chat']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  // Fast path: router prefetch with session cookie avoids blocking remote getUser roundtrip
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch'

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.includes('-auth-token'))

  if (isPrefetch && hasAuthCookie) {
    return NextResponse.next()
  }

  // Fast path: public routes that don't need auth verification
  if (!isProtected && pathname !== '/dang-nhap' && !pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Route API admin — kiểm tra ở route handler bằng service_role key
  if (pathname.startsWith('/api/admin')) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Route chính yêu cầu đăng nhập
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/dang-nhap', request.url))
  }

  // Nếu đã đăng nhập và vào trang login thì redirect vào app
  if (pathname === '/dang-nhap' && user) {
    return NextResponse.redirect(new URL('/tim-chua-truoc', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|m4a|mp3)$).*)',
  ],
}
