import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MomentsClient from '@/components/moments/MomentsClient'
import type { Moment } from '@/types/database'

interface MomentWithProfile extends Moment {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

export default async function KhoangKhacPage() {
  const supabase = await createClient()

  // Middleware already verified the session; read it locally (no network round trip).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/dang-nhap')

  const myInviteCode = 'VOW-' + user.id.replace(/-/g, '').slice(0, 6).toUpperCase()

  // Vòng 1: Chạy song song 5 truy vấn cơ bản (gộp incoming & outgoing friend_requests làm 1)
  const [profileRes, friendshipsRes, matchesRes, blocksRes, pendingReqsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, church_name')
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('friendships')
      .select('id, user1_id, user2_id, created_at')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),

    supabase
      .from('matches')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),

    supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),

    supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at')
      .or(`receiver_id.eq.${user.id},sender_id.eq.${user.id}`)
      .eq('status', 'pending'),
  ])

  // Privacy: only self + accepted friends + mutual matches, minus blocked users.
  const blockedIds = new Set<string>()
  for (const b of (blocksRes.data ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
    blockedIds.add(b.blocker_id === user.id ? b.blocked_id : b.blocker_id)
  }
  const visibleIds = new Set<string>([user.id])
  for (const f of (friendshipsRes.data ?? []) as Array<{ user1_id: string; user2_id: string }>) {
    visibleIds.add(f.user1_id === user.id ? f.user2_id : f.user1_id)
  }
  for (const m of (matchesRes.data ?? []) as Array<{ user1_id: string; user2_id: string }>) {
    visibleIds.add(m.user1_id === user.id ? m.user2_id : m.user1_id)
  }
  blockedIds.forEach((id) => visibleIds.delete(id))

  const friendships = (friendshipsRes.data ?? []) as Array<{
    id: string
    user1_id: string
    user2_id: string
    created_at: string
  }>
  const allPendingReqs = (pendingReqsRes.data ?? []) as Array<{
    id: string
    sender_id: string
    receiver_id: string
    status: string
    created_at: string
  }>
  const incomingReqs = allPendingReqs.filter((r) => r.receiver_id === user.id)
  const outgoingReqs = allPendingReqs.filter((r) => r.sender_id === user.id)

  const peerIds = new Set<string>()
  friendships.forEach((f) => peerIds.add(f.user1_id === user.id ? f.user2_id : f.user1_id))
  incomingReqs.forEach((r) => peerIds.add(r.sender_id))
  outgoingReqs.forEach((r) => peerIds.add(r.receiver_id))

  // Vòng 2: Chạy song song moments và peerProfiles trong cùng 1 Promise.all (xóa bỏ Vòng 3 tuần tự)
  const [momentsRes, peerProfilesRes] = await Promise.all([
    supabase
      .from('moments')
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        thumbnail_url,
        caption,
        is_deleted,
        deleted_at,
        created_at,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .in('user_id', Array.from(visibleIds))
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(60),

    peerIds.size > 0
      ? supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, church_name')
          .in('id', Array.from(peerIds))
      : Promise.resolve({ data: [], error: null }),
  ])

  if (momentsRes.error) {
    console.error('[KhoangKhacPage] Error fetching moments:', momentsRes.error)
  }

  const peerProfilesMap = new Map<
    string,
    { id: string; name: string; avatar: string | null; church: string }
  >()

  for (const p of (peerProfilesRes.data ?? []) as any[]) {
    peerProfilesMap.set(p.id, {
      id: p.id,
      name: p.full_name || p.username || 'Người dùng VOW',
      avatar: p.avatar_url || null,
      church: p.church_name || '',
    })
  }

  const initialFriends = friendships.map((f) => {
    const peerId = f.user1_id === user.id ? f.user2_id : f.user1_id
    const prof = peerProfilesMap.get(peerId) || {
      id: peerId,
      name: 'Bạn bè',
      avatar: null,
      church: '',
    }
    return {
      id: f.id,
      profile: {
        id: prof.id,
        name: prof.name,
        photos: prof.avatar ? [prof.avatar] : [],
        church: prof.church,
      },
    }
  })

  const initialIncoming = incomingReqs.map((r) => {
    const prof = peerProfilesMap.get(r.sender_id) || {
      id: r.sender_id,
      name: 'Người dùng VOW',
      avatar: null,
      church: '',
    }
    return {
      id: r.id,
      profile: {
        id: prof.id,
        name: prof.name,
        photos: prof.avatar ? [prof.avatar] : [],
        church: prof.church,
      },
    }
  })

  const initialOutgoing = outgoingReqs.map((r) => {
    const prof = peerProfilesMap.get(r.receiver_id) || {
      id: r.receiver_id,
      name: 'Người dùng VOW',
      avatar: null,
      church: '',
    }
    return {
      id: r.id,
      profile: {
        id: prof.id,
        name: prof.name,
        photos: prof.avatar ? [prof.avatar] : [],
        church: prof.church,
      },
    }
  })

  const profileData = profileRes.data as {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null

  const currentUser = {
    id: user.id,
    username:
      profileData?.username ?? (user.user_metadata?.username as string | undefined) ?? null,
    full_name:
      profileData?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    avatar_url:
      profileData?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null,
  }

  return (
    <Suspense fallback={<div className="min-h-[calc(100dvh-6rem)] bg-[#050505]" />}>
      <MomentsClient
        initialMoments={(momentsRes.data as MomentWithProfile[]) ?? []}
        myMoments={[]}
        userId={user.id}
        currentUser={currentUser}
        myInviteCode={myInviteCode}
        fetchError={momentsRes.error ? 'Không thể tải khoảnh khắc lúc này.' : null}
        initialFriends={initialFriends}
        initialIncoming={initialIncoming}
        initialOutgoing={initialOutgoing}
      />
    </Suspense>
  )
}
