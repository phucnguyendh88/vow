export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient from '@/components/chat/ChatClient'
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary'
import ConversationLoading from './loading'

interface Props {
  params: Promise<{ convId: string }>
  searchParams: Promise<{ pname?: string; pavatar?: string; cids?: string }>
}

export default async function ConversationPage({ params, searchParams }: Props) {
  const [{ convId }, query] = await Promise.all([params, searchParams])
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/dang-nhap')

  const cidsParam = typeof query?.cids === 'string' && query.cids.trim().length > 0 ? query.cids.trim() : ''
  const parsedCids = cidsParam ? cidsParam.split(',').map((s) => s.trim()).filter(Boolean) : []
  const allConvIdsWithPartner: string[] = Array.from(new Set([convId, ...parsedCids]))

  const fallbackPartnerName =
    typeof query?.pname === 'string' && query.pname.trim().length > 0
      ? query.pname.trim()
      : 'Thành viên'
  const fallbackPartnerAvatar =
    typeof query?.pavatar === 'string' && query.pavatar.trim().length > 0
      ? query.pavatar.trim()
      : null

  let partner: { id: string; name: string; avatarUrl: string | null } = {
    id: '',
    name: fallbackPartnerName,
    avatarUrl: fallbackPartnerAvatar,
  }
  let mergedMessages: any[] = []

  try {
    // Chạy song song duy nhất 1 vòng mạng: lấy thành viên và 40 tin nhắn mới nhất
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
        .in('conversation_id', allConvIdsWithPartner)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    const members = membersRes.data
    const otherMember = (Array.isArray(members) ? members : [])
      .map((m: any) => {
        const p = m?.profiles
        return Array.isArray(p) ? p[0] : p
      })
      .find((p: any) => p && String(p.id) !== String(user.id))

    if (otherMember) {
      const partnerName =
        typeof otherMember?.full_name === 'string' && otherMember.full_name.trim().length > 0
          ? otherMember.full_name.trim()
          : typeof otherMember?.username === 'string' && otherMember.username.trim().length > 0
          ? otherMember.username.trim()
          : fallbackPartnerName

      partner = {
        id: String(otherMember.id),
        name: partnerName,
        avatarUrl:
          typeof otherMember?.avatar_url === 'string'
            ? otherMember.avatar_url
            : fallbackPartnerAvatar,
      }
    }

    const rawInitial = Array.isArray(initialMsgsRes.data) ? initialMsgsRes.data : []
    mergedMessages = [...rawInitial].reverse()
  } catch (err) {
    console.error('[ConversationPage] Fast load error:', err)
  }

  return (
    <Suspense fallback={<ConversationLoading />}>
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
