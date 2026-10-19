// app/(main)/tin-nhan/page.tsx
// Trang Tin Nhắn — hiện tại listing các conversations của user

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
    <div className="flex flex-col min-h-dvh pb-28">
      {/* Header */}
      <header className="px-5 pt-12 pb-4">
        <h1 className="font-serif-vow text-2xl font-semibold text-cream">
          Tin Nhắn
        </h1>
        <p className="mt-1 text-sm text-muted">
          {conversations.length} cuộc trò chuyện
        </p>
      </header>

      {error && (
        <div className="mx-5 rounded-2xl bg-surface border border-surface2 p-5 text-center">
          <p className="text-sm text-danger">Không thể tải tin nhắn. Vui lòng thử lại.</p>
        </div>
      )}

      {!error && conversations.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3 py-20">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
            <svg className="w-8 h-8 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
            </svg>
          </div>
          <p className="font-medium text-cream">Chưa có tin nhắn nào</p>
          <p className="text-sm text-muted">Kết nối với ai đó để bắt đầu trò chuyện!</p>
          <Link
            href="/ket-noi-sau"
            className="mt-2 px-5 py-2.5 rounded-full bg-gold text-ink text-sm font-semibold"
          >
            Khám phá ngay
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-1 px-4">
        {conversations.map((conv: any) => (
          <Link
            key={conv.id}
            href={`/chat/${conv.id}`}
            className="flex items-center gap-4 p-4 rounded-2xl bg-surface active:scale-[0.99] transition"
          >
            <div className="w-12 h-12 rounded-full bg-surface2 flex-shrink-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream">
                {conv.type === 'match' ? 'Tương hợp' : conv.type === 'friend' ? 'Bạn bè' : 'Nhóm'}
              </p>
              <p className="text-xs text-muted truncate">
                {new Date(conv.created_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <svg className="w-4 h-4 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
