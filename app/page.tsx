import Link from 'next/link'

const features = [
  { icon: '📖', label: 'Lời Chúa mỗi ngày' },
  { icon: '📸', label: 'Khoảnh khắc cùng bạn bè' },
  { icon: '♡', label: 'Gặp người cùng đức tin' },
]

export default function HomePage() {
  return (
    <div
      className="relative flex min-h-dvh flex-col justify-between"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(245,179,1,0.06), transparent 60%)',
      }}
    >
      <div className="mx-auto max-w-md w-full flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Logo VOW */}
        <p className="font-serif-vow text-2xl font-semibold tracking-[0.35em] text-gold">
          VOW
        </p>

        {/* Verse quote */}
        <blockquote className="mt-6 max-w-xs">
          <p className="font-serif-vow text-[1.7rem] italic leading-snug text-cream">
            “Chúng ta yêu, vì Chúa đã yêu chúng ta trước.”
          </p>
          <cite className="mt-3 block font-serif-vow text-base italic font-medium tracking-wide text-gold not-italic">
            1 Giăng 4:19
          </cite>
        </blockquote>

        {/* Scripture subtitle */}
        <p className="mt-6 max-w-xs text-[14px] leading-relaxed text-cream/70">
          Tình yêu thật sự không bắt nguồn từ khả năng, nỗ lực hay sự xứng đáng của bản thân, mà xuất phát từ chính Đức Chúa Trời, Đấng đã chủ động yêu thương chúng ta trước.
        </p>

        {/* 3 Pills */}
        <div className="mt-7 flex flex-wrap justify-center gap-2.5 max-w-xs">
          {features.map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3.5 py-1.5 text-[13px] text-cream/90 border border-white/5"
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </span>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          href="/dang-nhap"
          className="mt-9 w-full max-w-xs rounded-full bg-gold px-6 py-4 text-center text-base font-semibold text-ink shadow-lg shadow-gold/20 transition hover:brightness-105 active:scale-[0.99]"
        >
          Bắt đầu hành trình
        </Link>

        <p className="mt-4 text-xs text-muted">
          Đăng nhập hoặc tạo tài khoản mới chỉ trong vài giây
        </p>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted/80">
          <Link href="/dieu-khoan" className="hover:text-gold underline underline-offset-4">
            Điều khoản sử dụng
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/chinh-sach-bao-mat" className="hover:text-gold underline underline-offset-4">
            Chính sách bảo mật
          </Link>
        </div>
      </div>
    </div>
  )
}

