import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const protectedPaths = ['/tim-chua-truoc', '/khoang-khac', '/ket-noi-sau', '/ho-so', '/tin-nhan']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

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

  // Route API admin — kiểm tra quyền quản trị
  if (pathname.startsWith('/api/admin')) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.email !== 'phucnguyendh88@gmail.com' && user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Chuyển tiếp cookies từ supabaseResponse sang redirect response để không mất session token
  const createRedirectResponse = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  // Route chính yêu cầu đăng nhập
  if (isProtected && !user) {
    return createRedirectResponse(new URL('/dang-nhap', request.url))
  }

  // Nếu đã đăng nhập tài khoản chính thức (không phải Guest) và vào trang login thì redirect vào app
  if (pathname === '/dang-nhap' && user && !user.is_anonymous) {
    return createRedirectResponse(new URL('/tim-chua-truoc', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|m4a|mp3)$).*)',
  ],
}
