import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, User } from 'lucide-react'

export default async function TinNhanPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/dang-nhap')

  // Lấy danh sách conversations mà user là thành viên
  const { data: memberRows, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      joined_at,
      conversations (
        id,
        type,
        created_at,
        match_id
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(50)

  const conversations = (memberRows ?? []).map((r: any) => r.conversations).filter(Boolean)

  return (
    <div className="flex flex-col min-h-dvh pb-28 max-w-md mx-auto">
      {/* Header */}
      <header className="px-5 pt-8 pb-4">
        <h1 className="font-serif text-2xl font-semibold text-cream">
          Tin nhắn
        </h1>
        <p className="mt-1 text-xs text-muted">
          {conversations.length} cuộc trò chuyện
        </p>
      </header>

      {error && (
        <div className="mx-5 rounded-2xl bg-surface border border-surface2 p-5 text-center">
          <p className="text-xs text-rose-400">Không thể tải tin nhắn. Vui lòng thử lại sau.</p>
        </div>
      )}

      {!error && conversations.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
          <div className="h-16 w-16 rounded-full bg-surface2 flex items-center justify-center text-muted mb-4">
            <MessageCircle size={28} />
          </div>
          <p className="font-serif text-lg font-semibold text-cream">Chưa có tin nhắn</p>
          <p className="mt-1 text-xs text-muted max-w-xs leading-relaxed">
            Ghép đôi ở tab Kết nối để bắt đầu trò chuyện cùng nhau nhé!
          </p>
          <Link
            href="/ket-noi-sau"
            className="mt-6 rounded-full bg-gold px-6 py-3 text-xs font-semibold text-ink shadow-md shadow-gold/20 active:scale-95 transition"
          >
            Khám phá ngay
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2 px-4">
        {conversations.map((conv: any) => (
          <Link
            key={conv.id}
            href={`/tin-nhan/${conv.id}`}
            className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface border border-white/5 active:scale-[0.99] transition hover:bg-surface2/60 cursor-pointer shadow-md"
          >
            <div className="w-12 h-12 rounded-full bg-surface2 flex-shrink-0 flex items-center justify-center text-muted">
              <User size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-cream truncate">
                {conv.type === 'match' ? 'Tương hợp mới' : conv.type === 'friend' ? 'Bạn bè' : 'Cuộc trò chuyện'}
              </p>
              <p className="text-xs text-muted truncate mt-0.5">
                Bắt đầu cuộc trò chuyện...
              </p>
            </div>
            <span className="text-[11px] text-muted shrink-0">
              {new Date(conv.created_at).toLocaleDateString('vi-VN')}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
