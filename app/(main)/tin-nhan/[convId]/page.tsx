import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient from '@/components/chat/ChatClient'

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

  // Thành viên đối phương
  const otherMember = (members ?? [])
    .map((m: any) => m.profiles)
    .find((p: any) => p && p.id !== user.id)

  const partner = otherMember
    ? {
        id: otherMember.id,
        name: otherMember.full_name ?? otherMember.username ?? 'Thành viên',
        avatarUrl: otherMember.avatar_url,
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
    <ChatClient
      conversationId={convId}
      currentUserId={user.id}
      initialMessages={(messages as any) ?? []}
      partner={partner}
    />
  )
}
