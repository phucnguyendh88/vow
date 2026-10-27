import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_MOMENT_BUCKETS = ['moments', 'moment-images', 'moment-videos'] as const

function validateAndExtractMomentStorage(
  rawUrl: string,
  userId: string
): { valid: boolean; bucket: string | null; objectPath: string | null } {
  try {
    const parsedUrl = new URL(rawUrl)
    const supabaseUrlStr = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrlStr) {
      const expectedOrigin = new URL(supabaseUrlStr).origin
      if (parsedUrl.origin !== expectedOrigin) {
        return { valid: false, bucket: null, objectPath: null }
      }
    }

    const match = parsedUrl.pathname.match(
      /^\/storage\/v1\/object\/public\/(moments|moment-images|moment-videos)\/([^/]+)\/(.+)$/
    )
    if (!match) {
      return { valid: false, bucket: null, objectPath: null }
    }

    const [, bucket, ownerSegment, restPath] = match
    if (ownerSegment !== userId || !restPath || restPath.includes('..')) {
      return { valid: false, bucket: null, objectPath: null }
    }

    return {
      valid: true,
      bucket,
      objectPath: `${ownerSegment}/${restPath}`,
    }
  } catch {
    return { valid: false, bucket: null, objectPath: null }
  }
}

function extractBucketAndPath(rawUrl: string): { bucket: string; objectPath: string } | null {
  try {
    const parsedUrl = new URL(rawUrl)
    const match = parsedUrl.pathname.match(
      /^\/storage\/v1\/object\/public\/(moments|moment-images|moment-videos)\/(.+)$/
    )
    if (!match || !match[1] || !match[2]) return null
    return { bucket: match[1], objectPath: match[2] }
  } catch {
    return null
  }
}

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

  const { media_url, media_type, thumbnail_url, caption } = body

  // Validate media_url & media_type
  if (!media_url || typeof media_url !== 'string') {
    return NextResponse.json({ error: 'media_url is required' }, { status: 400 })
  }

  if (!['image', 'video'].includes(media_type)) {
    return NextResponse.json({ error: 'media_type must be "image" or "video"' }, { status: 400 })
  }

  // Xác minh media_url hợp lệ, cùng origin với Supabase project và thuộc thư mục của user này
  const mediaCheck = validateAndExtractMomentStorage(media_url, user.id)
  if (!mediaCheck.valid) {
    return NextResponse.json(
      { error: 'Invalid media_url or media_url does not belong to this user' },
      { status: 400 }
    )
  }

  // Nếu có thumbnail_url thì xác minh tương tự
  if (thumbnail_url !== undefined && thumbnail_url !== null) {
    if (typeof thumbnail_url !== 'string') {
      return NextResponse.json({ error: 'Invalid thumbnail_url' }, { status: 400 })
    }
    const thumbCheck = validateAndExtractMomentStorage(thumbnail_url, user.id)
    if (!thumbCheck.valid) {
      return NextResponse.json(
        { error: 'Invalid thumbnail_url or thumbnail_url does not belong to this user' },
        { status: 400 }
      )
    }
  }

  if (caption && typeof caption === 'string' && caption.length > 500) {
    return NextResponse.json({ error: 'Caption too long (max 500 chars)' }, { status: 400 })
  }

  // Kiểm tra user không bị khóa (is_banned)
  const { data: senderProfile } = await (supabase.from('profiles') as any)
    .select('is_banned')
    .eq('id', user.id)
    .maybeSingle()

  if ((senderProfile as any)?.is_banned) {
    return NextResponse.json({ error: 'Account is suspended' }, { status: 403 })
  }

  // Tạo moment record
  const { data: moment, error: momentError } = await (supabase.from('moments') as any)
    .insert({
      user_id: user.id,
      media_url,
      media_type: media_type as 'image' | 'video',
      thumbnail_url: thumbnail_url ?? null,
      caption: typeof caption === 'string' ? caption.trim() || null : null,
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

  // Kiểm tra quyền: phải là chủ sở hữu hoặc Admin
  const isOwner = moment.user_id === user.id
  let isAdmin = false
  if (!isOwner) {
    const { data: adminCheck } = await (supabase.rpc as any)('check_admin', { user_id: user.id })
    isAdmin = Boolean(adminCheck)
  }

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete moment
  const { error: deleteError } = await (supabase.from('moments') as any)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', momentId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete moment' }, { status: 500 })
  }

  // Cố gắng xóa file khỏi Storage (best effort — không fail nếu Storage lỗi)
  // Trích xuất động tên bucket (moments | moment-images | moment-videos) và path
  try {
    let storageClient: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient> =
      supabase
    try {
      storageClient = createAdminClient()
    } catch {
      storageClient = supabase
    }

    const mediaTarget = extractBucketAndPath(moment.media_url)
    if (mediaTarget && (ALLOWED_MOMENT_BUCKETS as readonly string[]).includes(mediaTarget.bucket)) {
      await storageClient.storage.from(mediaTarget.bucket).remove([mediaTarget.objectPath])
    }

    if (moment.thumbnail_url) {
      const thumbTarget = extractBucketAndPath(moment.thumbnail_url)
      if (thumbTarget && (ALLOWED_MOMENT_BUCKETS as readonly string[]).includes(thumbTarget.bucket)) {
        await storageClient.storage.from(thumbTarget.bucket).remove([thumbTarget.objectPath])
      }
    }
  } catch (storageErr) {
    // Log lỗi nhưng không fail request — DB record đã được cập nhật
    console.error('Storage cleanup error (non-critical):', storageErr)
  }

  return NextResponse.json({ success: true })
}
