import Link from 'next/link'

const features = [
  { icon: '📖', label: 'Lời Chúa mỗi ngày' },
  { icon: '📸', label: 'Khoảnh khắc cùng bạn bè' },
  { icon: '♡', label: 'Gặp người cùng đức tin' },
]

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-between min-h-dvh px-6 py-12 text-center">
      {/* Logo VOW */}
      <div />

      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="vow-title text-gold-gradient text-4xl font-bold tracking-widest">
            V O W
          </h1>

          {/* Verse of the day teaser */}
          <div className="space-y-2">
            <p className="text-white/90 text-xl font-light italic leading-relaxed">
              &ldquo;Chúng ta yêu, vì Chúa đã yêu chúng ta trước.&rdquo;
            </p>
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--gold)' }}
            >
              1 Giăng 4:19
            </p>
          </div>

          <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--text-muted)' }}>
            Tình yêu thật sự không bắt nguồn từ khả năng, nỗ lực hay sự xứng
            đáng của bản thân, mà xuất phát từ chính Đức Chúa Trời, Đấng đã
            chủ động yêu thương chúng ta trước.
          </p>
        </div>

        {/* Features list */}
        <div
          className="flex flex-col gap-3 w-full rounded-2xl p-4"
          style={{ background: 'var(--surface)' }}
        >
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-lg">{f.icon}</span>
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                {f.label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          href="/dang-nhap"
          className="w-full py-4 rounded-2xl text-center font-semibold text-base text-black transition-opacity hover:opacity-90 active:opacity-75"
          style={{ background: 'var(--gold)' }}
        >
          Bắt đầu hành trình
        </Link>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Đăng nhập hoặc tạo tài khoản mới chỉ trong vài giây
        </p>
      </div>

      {/* Footer links */}
      <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link href="/dieu-khoan" className="hover:underline">
          Điều khoản sử dụng
        </Link>
        <span>·</span>
        <Link href="/bao-mat" className="hover:underline">
          Chính sách bảo mật
        </Link>
      </div>
    </main>
  )
}
