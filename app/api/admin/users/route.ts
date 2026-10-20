import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'phucnguyendh88@gmail.com'

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { isAdmin: false, user: null, supabase }
  }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin =
    profile?.role === 'admin' ||
    user.app_metadata?.role === 'admin' ||
    (user.email ?? '').toLowerCase() === ADMIN_EMAIL

  return { isAdmin, user, supabase }
}

/**
 * GET /api/admin/users?page=0&limit=20&search=
 */
export async function GET(request: Request) {
  const { isAdmin, supabase } = await verifyAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '0', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const search = searchParams.get('search')?.trim() || ''

  let query = (supabase.from('profiles') as any)
    .select(
      'id, username, full_name, role, is_banned, is_active, church_name, location_text, avatar_url, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,username.ilike.%${search}%,id.eq.${search.includes('-') ? search : '00000000-0000-0000-0000-000000000000'}`
    )
  }

  const { data: users, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: users ?? [], total: count ?? 0, page, limit })
}

/**
 * PATCH /api/admin/users
 * Cập nhật trạng thái khóa (ban/unban)
 */
export async function PATCH(request: Request) {
  const { isAdmin, user, supabase } = await verifyAdmin()
  if (!isAdmin || !user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const { userId, is_banned } = body

  // Kiểm tra target user không phải là admin
  const { data: targetProfile } = await (supabase.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single()

  if (targetProfile?.role === 'admin' || userId === user.id) {
    return NextResponse.json({ error: 'Không thể khóa tài khoản quản trị viên' }, { status: 400 })
  }

  const { error } = await (supabase.from('profiles') as any)
    .update({ is_banned: Boolean(is_banned) })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId, is_banned: Boolean(is_banned) })
}

/**
 * DELETE /api/admin/users
 * Xóa vĩnh viễn tài khoản người dùng
 */
export async function DELETE(request: Request) {
  const { isAdmin, user, supabase } = await verifyAdmin()
  if (!isAdmin || !user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const targetId = searchParams.get('userId')

  if (!targetId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Không thể xóa chính tài khoản của bạn' }, { status: 400 })
  }

  // Chặn xóa admin
  const { data: targetProfile } = await (supabase.from('profiles') as any)
    .select('role')
    .eq('id', targetId)
    .single()

  if (targetProfile?.role === 'admin') {
    return NextResponse.json({ error: 'Không được phép xóa tài khoản quản trị viên' }, { status: 400 })
  }

  // Xóa dữ liệu profile và cascades
  const { error: deleteProfileError } = await (supabase.from('profiles') as any)
    .delete()
    .eq('id', targetId)

  if (deleteProfileError) {
    return NextResponse.json({ error: deleteProfileError.message }, { status: 500 })
  }

  // Nếu có service role key, xóa triệt để trong auth.users
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (serviceKey && supabaseUrl) {
    try {
      const adminAuthClient = createAdminClient(supabaseUrl, serviceKey)
      await adminAuthClient.auth.admin.deleteUser(targetId)
    } catch (e) {
      console.warn('Could not delete auth user with service key:', e)
    }
  }

  return NextResponse.json({ success: true, deletedUserId: targetId })
}
