import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Supabase client cho phía server (Server Components, Server Actions, Route Handlers).
 * Sử dụng cookies để duy trì phiên đăng nhập.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll được gọi từ Server Component — bỏ qua lỗi này
            // Middleware xử lý việc refresh token
          }
        },
      },
    }
  )
}

/**
 * Supabase Admin client dùng service_role key.
 * CHỈ dùng trong Server Actions / Route Handlers cần bypass RLS.
 * KHÔNG BAO GIỜ expose client này ra frontend.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
