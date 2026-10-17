import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/moments
 * Tạo Moment mới sau khi đã upload media lên Supabase Storage từ client.
 * Client thực hiện upload Storage, sau đó gọi API này để lưu metadata.
 *
 * Tách biệt upload và lưu metadata để:
 * - Client có thể retry upload mà không tạo duplicate DB record
 * - Server kiểm tra storage path trước khi lưu DB
 * - Tránh lưu DB khi upload thất bại
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { media_url, media_type, thumbnail_url, caption, idempotency_key } = body

  // Validate
  if (!media_url || typeof media_url !== 'string') {
    return NextResponse.json({ error: 'media_url is required' }, { status: 400 })
  }

  if (!['image', 'video'].includes(media_type)) {
    return NextResponse.json({ error: 'media_type must be "image" or "video"' }, { status: 400 })
  }

  // Xác minh media_url phải thuộc về user này (path bắt đầu bằng user.id)
  // Format: https://*.supabase.co/storage/v1/object/public/moments/<user_id>/...
  const urlPath = new URL(media_url).pathname
  if (!urlPath.includes(`/moments/${user.id}/`)) {
    return NextResponse.json(
      { error: 'media_url does not belong to this user' },
      { status: 403 }
    )
  }

  if (caption && typeof caption === 'string' && caption.length > 500) {
    return NextResponse.json({ error: 'Caption too long (max 500 chars)' }, { status: 400 })
  }

  // Idempotency: nếu có idempotency_key, tìm moment đã tạo trước đó
  // (để client retry an toàn khi request bị ngắt)
  if (idempotency_key) {
    // Dùng admin client để tìm bằng metadata - hoặc tạo custom field
    // Đơn giản hơn: lưu idempotency_key trong DB (cần thêm cột)
    // Tạm thời skip - có thể add cột idempotency_key vào moments table sau
  }

  // Tạo moment record
  const { data: moment, error: momentError } = await (supabase
    .from('moments') as any)
    .insert({
      user_id: user.id,
      media_url,
      media_type,
      thumbnail_url: thumbnail_url ?? null,
      caption: caption?.trim() ?? null,
    })
    .select()
    .single()

  if (momentError) {
    console.error('Create moment error:', momentError)
    return NextResponse.json({ error: 'Failed to create moment' }, { status: 500 })
  }

  return NextResponse.json({ success: true, moment }, { status: 201 })
}

/**
 * DELETE /api/moments
 * Xóa mềm (soft delete) một Moment.
 * Chỉ chủ sở hữu hoặc Admin mới được xóa.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const momentId = searchParams.get('id')

  if (!momentId) {
    return NextResponse.json({ error: 'moment id is required' }, { status: 400 })
  }

  // Lấy moment để kiểm tra ownership
  const { data: momentData, error: fetchError } = await supabase
    .from('moments')
    .select('id, user_id, media_url, thumbnail_url, is_deleted')
    .eq('id', momentId)
    .single()

  const moment = momentData as {
    id: string
    user_id: string
    media_url: string
    thumbnail_url: string | null
    is_deleted: boolean
  } | null

  if (fetchError || !moment) {
    return NextResponse.json({ error: 'Moment not found' }, { status: 404 })
  }

  if (moment.is_deleted) {
    return NextResponse.json({ error: 'Moment already deleted' }, { status: 410 })
  }

  // Kiểm tra quyền: phải là chủ sở hữu
  // (Admin check được thực hiện qua RLS policy + service role)
  const isOwner = moment.user_id === user.id

  // Kiểm tra admin qua DB function
  // deno-lint-ignore no-explicit-any
  const { data: isAdmin } = await (supabase.rpc as any)('check_admin', { user_id: user.id })

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete moment
  const { error: deleteError } = await (supabase
    .from('moments') as any)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', momentId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete moment' }, { status: 500 })
  }

  // Cố gắng xóa file khỏi Storage (best effort — không fail nếu Storage lỗi)
  // Lấy storage path từ URL
  try {
    const adminSupabase = createAdminClient()
    const urlPath = new URL(moment.media_url).pathname
    // Extract path sau /object/public/moments/
    const storagePath = urlPath.split('/object/public/moments/')[1]
    if (storagePath) {
      await adminSupabase.storage.from('moments').remove([storagePath])
    }
    if (moment.thumbnail_url) {
      const thumbPath = new URL(moment.thumbnail_url).pathname.split('/object/public/moments/')[1]
      if (thumbPath) {
        await adminSupabase.storage.from('moments').remove([thumbPath])
      }
    }
  } catch (storageErr) {
    // Log lỗi nhưng không fail request — DB record đã được cập nhật
    // Orphaned files có thể được dọn dẹp bằng scheduled job
    console.error('Storage cleanup error (non-critical):', storageErr)
  }

  return NextResponse.json({ success: true })
}
