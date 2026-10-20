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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/dang-nhap')

  const myInviteCode = 'FC-' + user.id.replace(/-/g, '').slice(0, 6).toUpperCase()

  const [momentsRes, profileRes, friendshipsRes, incomingReqRes, outgoingReqRes] =
    await Promise.all([
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
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(60),

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
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status, created_at')
        .eq('receiver_id', user.id)
        .eq('status', 'pending'),

      supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status, created_at')
        .eq('sender_id', user.id)
        .eq('status', 'pending'),
    ])

  const friendships = (friendshipsRes.data ?? []) as Array<{
    id: string
    user1_id: string
    user2_id: string
    created_at: string
  }>
  const incomingReqs = (incomingReqRes.data ?? []) as Array<{
    id: string
    sender_id: string
    receiver_id: string
    status: string
    created_at: string
  }>
  const outgoingReqs = (outgoingReqRes.data ?? []) as Array<{
    id: string
    sender_id: string
    receiver_id: string
    status: string
    created_at: string
  }>

  const peerIds = new Set<string>()
  friendships.forEach((f) => peerIds.add(f.user1_id === user.id ? f.user2_id : f.user1_id))
  incomingReqs.forEach((r) => peerIds.add(r.sender_id))
  outgoingReqs.forEach((r) => peerIds.add(r.receiver_id))

  const peerProfilesMap = new Map<
    string,
    { id: string; name: string; avatar: string | null; church: string }
  >()

  if (peerIds.size > 0) {
    const { data: peerProfiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, church_name')
      .in('id', Array.from(peerIds))

    for (const p of (peerProfiles ?? []) as any[]) {
      peerProfilesMap.set(p.id, {
        id: p.id,
        name: p.full_name || p.username || 'Người dùng VOW',
        avatar: p.avatar_url || null,
        church: p.church_name || '',
      })
    }
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
    <MomentsClient
      initialMoments={(momentsRes.data as MomentWithProfile[]) ?? []}
      myMoments={[]}
      userId={user.id}
      currentUser={currentUser}
      myInviteCode={myInviteCode}
      fetchError={momentsRes.error?.message ?? null}
      initialFriends={initialFriends}
      initialIncoming={initialIncoming}
      initialOutgoing={initialOutgoing}
    />
  )
}
