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

  // Lấy các thành viên trong conversation để xác định partner
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

  // Thành viên đối phương (hỗ trợ cả trường hợp profiles là mảng hoặc object)
  const otherMember = (Array.isArray(members) ? members : [])
    .map((m: any) => {
      const p = m.profiles
      return Array.isArray(p) ? p[0] : p
    })
    .find((p: any) => p && String(p.id) !== String(user.id))

  const partnerName =
    typeof otherMember?.full_name === 'string' && otherMember.full_name.trim().length > 0
      ? otherMember.full_name.trim()
      : typeof otherMember?.username === 'string' && otherMember.username.trim().length > 0
      ? otherMember.username.trim()
      : 'Thành viên'

  const partner = otherMember
    ? {
        id: String(otherMember.id),
        name: partnerName,
        avatarUrl: typeof otherMember.avatar_url === 'string' ? otherMember.avatar_url : null,
      }
    : null

  // Lấy 50 tin nhắn gần nhất
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
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(50)

  return (
    <ChatErrorBoundary>
      <ChatClient
        conversationId={convId}
        currentUserId={user.id}
        initialMessages={(Array.isArray(messages) ? messages : []) as any}
        partner={partner}
      />
    </ChatErrorBoundary>
  )
}
