import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * OAuth callback handler.
 * Supabase redirect về đây sau khi đăng nhập Google thành công.
 * Exchange auth code for session và redirect vào app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/tim-chua-truoc'
  const error = searchParams.get('error')

  if (error) {
    console.error('OAuth error:', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${origin}/dang-nhap?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      return NextResponse.redirect(`${origin}/dang-nhap?error=auth_failed`)
    }

    // Redirect an toàn — chỉ redirect đến cùng origin
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`)
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`)
    } else {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/dang-nhap?error=missing_code`)
}
