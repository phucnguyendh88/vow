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
    // 1. Lấy các thành viên trong conversation để xác định partner
    const { data: members } = await supabase
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
      .eq('conversation_id', convId)

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

    // 2. Tìm tất cả conversation_id chung giữa user.id và partner.id để gộp luồng tin nhắn bị tách
    if (partner?.id) {
      try {
        const [myConvsRes, partnerConvsRes] = await Promise.all([
          supabase
            .from('conversation_members')
            .select('conversation_id, conversations(id, type)')
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
          .filter((r: any) => {
            const cid = String(r?.conversation_id || '')
            const cObj = Array.isArray(r?.conversations) ? r.conversations[0] : r?.conversations
            const cType = cObj?.type
            return (
              cid &&
              partnerConvSet.has(cid) &&
              (!cType || cType === 'friend' || cType === 'match')
            )
          })
          .map((r: any) => String(r.conversation_id))

        if (sharedIds.length > 0) {
          allConvIdsWithPartner = Array.from(new Set([convId, ...sharedIds]))
        }
      } catch {}
    }

    // 3. Lấy tin nhắn từ tất cả các conversation_id chung của cặp user này, sắp xếp theo thời gian
    const { data: messages } = await supabase
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
      .in('conversation_id', allConvIdsWithPartner)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(100)

    mergedMessages = Array.isArray(messages) ? messages : []
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

