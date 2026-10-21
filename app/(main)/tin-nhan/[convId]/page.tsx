export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient from '@/components/chat/ChatClient'
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary'

interface Props {
  params: Promise<{ convId: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { convId } = await params
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/dang-nhap')

  let partner: { id: string; name: string; avatarUrl: string | null } | null = null
  let allConvIdsWithPartner: string[] = [convId]
  let mergedMessages: any[] = []

  try {
    // 1. Chạy song song: lấy thành viên conversation và 50 tin nhắn mới nhất
    const [membersRes, initialMsgsRes] = await Promise.all([
      supabase
        .from('conversation_members')
        .select(`
          user_id,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', convId),

      supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          profiles:sender_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', convId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const members = membersRes.data
    const otherMember = (Array.isArray(members) ? members : [])
      .map((m: any) => {
        const p = m?.profiles
        return Array.isArray(p) ? p[0] : p
      })
      .find((p: any) => p && String(p.id) !== String(user.id))

    const partnerName =
      typeof otherMember?.full_name === 'string' && otherMember.full_name.trim().length > 0
        ? otherMember.full_name.trim()
        : typeof otherMember?.username === 'string' && otherMember.username.trim().length > 0
        ? otherMember.username.trim()
        : 'Thành viên'

    partner = otherMember
      ? {
          id: String(otherMember.id),
          name: partnerName,
          avatarUrl: typeof otherMember.avatar_url === 'string' ? otherMember.avatar_url : null,
        }
      : null

    // Đảo lại theo thứ tự thời gian tăng dần để hiển thị từ cũ đến mới
    const rawInitial = Array.isArray(initialMsgsRes.data) ? initialMsgsRes.data : []
    mergedMessages = [...rawInitial].reverse()

    // 2. Tìm nhanh các conversation_id khác nếu có giữa user.id và partner.id
    if (partner?.id) {
      try {
        const [myConvsRes, partnerConvsRes] = await Promise.all([
          supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', user.id),
          supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', partner.id),
        ])

        const partnerConvSet = new Set(
          (Array.isArray(partnerConvsRes.data) ? partnerConvsRes.data : [])
            .map((r: any) => String(r?.conversation_id || ''))
            .filter(Boolean)
        )

        const sharedIds = (Array.isArray(myConvsRes.data) ? myConvsRes.data : [])
          .map((r: any) => String(r?.conversation_id || ''))
          .filter((cid: string) => cid && partnerConvSet.has(cid))

        if (sharedIds.length > 1) {
          allConvIdsWithPartner = Array.from(new Set([convId, ...sharedIds]))
          // Nếu phát hiện có nhiều hơn 1 conversation, query bổ sung tin nhắn từ các conv còn lại
          const otherConvIds = allConvIdsWithPartner.filter((id) => id !== convId)
          if (otherConvIds.length > 0) {
            const { data: otherMsgs } = await supabase
              .from('messages')
              .select(`
                id,
                conversation_id,
                sender_id,
                content,
                created_at,
                profiles:sender_id (
                  id,
                  username,
                  full_name,
                  avatar_url
                )
              `)
              .in('conversation_id', otherConvIds)
              .eq('is_deleted', false)
              .order('created_at', { ascending: false })
              .limit(50)

            if (Array.isArray(otherMsgs) && otherMsgs.length > 0) {
              const combined = [...mergedMessages, ...otherMsgs]
              const seen = new Set<string>()
              mergedMessages = combined
                .filter((m) => {
                  if (!m?.id || seen.has(m.id)) return false
                  seen.add(m.id)
                  return true
                })
                .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error('[ConversationPage] Error loading conversation:', err)
  }

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#050505]" />}>
      <ChatErrorBoundary>
        <ChatClient
          conversationId={convId}
          allConversationIds={allConvIdsWithPartner}
          currentUserId={user.id}
          initialMessages={mergedMessages as any}
          partner={partner}
        />
      </ChatErrorBoundary>
    </Suspense>
  )
}
