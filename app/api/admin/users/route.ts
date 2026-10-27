import { createClient, createAdminClient as createServerAdminClient } from '@/lib/supabase/server'
import { createClient as createSupabaseJsAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'phucnguyendh88@gmail.com'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getPrivilegedClient(fallbackSupabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    return createServerAdminClient()
  } catch {
    return fallbackSupabase
  }
}

function getAuthAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return null
  try {
    return createSupabaseJsAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  } catch {
    return null
  }
}

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { isAdmin: false, user: null, supabase, dbClient: supabase }
  }

  const dbClient = getPrivilegedClient(supabase)

  const { data: profile } = await (dbClient as any)
    .from('profiles')
    .select('role, is_banned')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_banned) {
    return { isAdmin: false, user: null, supabase, dbClient }
  }

  const isAdmin =
    profile?.role === 'admin' ||
    user.app_metadata?.role === 'admin' ||
    (user.email ?? '').trim().toLowerCase() === ADMIN_EMAIL

  return { isAdmin, user, supabase, dbClient }
}

/**
 * GET /api/admin/users?page=0&limit=20&search=&provider=
 */
export async function GET(request: Request) {
  const { isAdmin, dbClient } = await verifyAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 100)
  const rawSearch = searchParams.get('search')?.trim() || ''
  // Làm sạch ký tự đặc biệt (,().%\*) để chống PostgREST Filter Injection
  const safeSearch = rawSearch.replace(/[,().%\\*]/g, '').trim()
  const isUuidSearch = UUID_REGEX.test(rawSearch)
  const providerFilter = searchParams.get('provider')?.trim().toLowerCase() || 'all'
  const hasProviderFilter =
    providerFilter !== 'all' &&
    ['google', 'email', 'anonymous', 'guest'].includes(providerFilter)

  // Lấy thông tin phương thức đăng nhập và email từ Supabase Auth Admin nếu có service role key
  const adminAuthClient = getAuthAdminClient()
  const authInfoMap = new Map<string, { provider: string; email: string | null; isAnonymous: boolean }>()

  if (adminAuthClient) {
    try {
      let currentPage = 1
      const perPage = 1000
      while (currentPage <= 5) {
        const { data: authData, error: listErr } = await adminAuthClient.auth.admin.listUsers({
          page: currentPage,
          perPage,
        })
        if (listErr || !authData?.users || authData.users.length === 0) break
        for (const u of authData.users) {
          const isAnon = Boolean(u.is_anonymous)
          const provider = isAnon
            ? 'anonymous'
            : (u.app_metadata?.provider || (u.email ? 'email' : 'anonymous'))
          authInfoMap.set(u.id, {
            provider,
            email: u.email ?? null,
            isAnonymous: isAnon,
          })
        }
        if (authData.users.length < perPage) break
        currentPage++
      }
    } catch (e) {
      console.warn('Could not list auth users:', e)
    }
  }

  let query = (dbClient.from('profiles') as any)
    .select(
      'id, username, full_name, role, is_banned, is_active, church_name, location_text, avatar_url, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (rawSearch) {
    const orClauses: string[] = []
    if (safeSearch) {
      orClauses.push(`full_name.ilike.%${safeSearch}%`, `username.ilike.%${safeSearch}%`)
    }
    if (isUuidSearch) {
      orClauses.push(`id.eq.${rawSearch}`)
    }
    if (orClauses.length > 0) {
      query = query.or(orClauses.join(','))
    }
  }

  if (!hasProviderFilter) {
    query = query.range(page * limit, (page + 1) * limit - 1)
  }

  const { data: users, count, error } = await query

  if (error) {
    console.error('[GET /api/admin/users] Database query error:', error)
    return NextResponse.json({ error: 'Không thể tải danh sách người dùng' }, { status: 500 })
  }

  const enrichUser = (u: any) => {
    const authMeta = authInfoMap.get(u.id)
    return {
      ...u,
      auth_provider: authMeta?.provider || 'email',
      email: authMeta?.email || null,
      is_anonymous: authMeta?.isAnonymous ?? false,
    }
  }

  if (hasProviderFilter) {
    const allFiltered = (users ?? [])
      .map(enrichUser)
      .filter((u: any) => {
        if (providerFilter === 'google') return u.auth_provider === 'google'
        if (providerFilter === 'email') return u.auth_provider === 'email'
        if (providerFilter === 'anonymous' || providerFilter === 'guest') {
          return u.is_anonymous || u.auth_provider === 'anonymous'
        }
        return true
      })

    const pagedUsers = allFiltered.slice(page * limit, (page + 1) * limit)
    return NextResponse.json({
      users: pagedUsers,
      total: allFiltered.length,
      page,
      limit,
    })
  }

  return NextResponse.json({
    users: (users ?? []).map(enrichUser),
    total: count ?? 0,
    page,
    limit,
  })
}

/**
 * PATCH /api/admin/users
 * Cập nhật trạng thái khóa (ban/unban)
 */
export async function PATCH(request: Request) {
  const { isAdmin, user, dbClient } = await verifyAdmin()
  if (!isAdmin || !user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.userId || typeof body.userId !== 'string' || !UUID_REGEX.test(body.userId)) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  const { userId, is_banned } = body
  const banStatus = Boolean(is_banned)

  // Kiểm tra target user không phải là admin
  const { data: targetProfile } = await (dbClient.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (targetProfile?.role === 'admin' || userId === user.id) {
    return NextResponse.json({ error: 'Không thể khóa tài khoản quản trị viên' }, { status: 400 })
  }

  const { error } = await (dbClient.from('profiles') as any)
    .update({ is_banned: banStatus })
    .eq('id', userId)

  if (error) {
    console.error('[PATCH /api/admin/users] Update error:', error)
    return NextResponse.json({ error: 'Không thể cập nhật trạng thái tài khoản' }, { status: 500 })
  }

  // Đồng bộ trạng thái khóa trong Supabase Auth nếu có service role key
  const adminAuthClient = getAuthAdminClient()
  if (adminAuthClient) {
    try {
      await adminAuthClient.auth.admin.updateUserById(userId, {
        ban_duration: banStatus ? '876000h' : 'none',
      })
    } catch (e) {
      console.warn('Could not sync ban_duration with auth user:', e)
    }
  }

  return NextResponse.json({ success: true, userId, is_banned: banStatus })
}

/**
 * DELETE /api/admin/users
 * Xóa vĩnh viễn tài khoản người dùng
 */
export async function DELETE(request: Request) {
  const { isAdmin, user, dbClient } = await verifyAdmin()
  if (!isAdmin || !user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const targetId = searchParams.get('userId')?.trim()

  if (!targetId || !UUID_REGEX.test(targetId)) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Không thể xóa chính tài khoản của bạn' }, { status: 400 })
  }

  // Chặn xóa admin
  const { data: targetProfile } = await (dbClient.from('profiles') as any)
    .select('role')
    .eq('id', targetId)
    .maybeSingle()

  if (targetProfile?.role === 'admin') {
    return NextResponse.json({ error: 'Không được phép xóa tài khoản quản trị viên' }, { status: 400 })
  }

  // Xóa dữ liệu profile và cascades bằng dbClient (ưu tiên service_role)
  const { error: deleteProfileError } = await (dbClient.from('profiles') as any)
    .delete()
    .eq('id', targetId)

  if (deleteProfileError) {
    console.error('[DELETE /api/admin/users] Delete profile error:', deleteProfileError)
    return NextResponse.json({ error: 'Không thể xóa hồ sơ người dùng' }, { status: 500 })
  }

  // Nếu có service role key, xóa triệt để trong auth.users
  const adminAuthClient = getAuthAdminClient()
  if (adminAuthClient) {
    try {
      await adminAuthClient.auth.admin.deleteUser(targetId)
    } catch (e) {
      console.warn('Could not delete auth user with service key:', e)
    }
  }

  return NextResponse.json({ success: true, deletedUserId: targetId })
}
