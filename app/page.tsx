import Link from 'next/link'

export const metadata = {
  title: 'VOW — Niềm tin, cùng nhau',
  description:
    'Nơi yên tĩnh để gặp Chúa mỗi ngày, chia sẻ khoảnh khắc với bạn bè và kết nối với những người cùng đức tin.',
}

function PillIcon({ type }: { type: 'book' | 'camera' | 'heart' }) {
  return (
    <svg
      className="h-3.5 w-3.5 text-gold"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'book' ? (
        <>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </>
      ) : type === 'camera' ? (
        <>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </>
      ) : (
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      )}
    </svg>
  )
}

const features: { icon: 'book' | 'camera' | 'heart'; label: string }[] = [
  { icon: 'book', label: 'Lời Chúa mỗi ngày' },
  { icon: 'camera', label: 'Khoảnh khắc cùng bạn bè' },
  { icon: 'heart', label: 'Gặp người cùng đức tin' },
]

export default function HomePage() {
  return (
    <div
      className="min-h-svh bg-ink text-cream flex flex-col"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(245,179,1,0.10), transparent 60%), radial-gradient(ellipse 90% 60% at 50% 110%, rgba(245,179,1,0.06), transparent 60%)',
      }}
    >
      <div className="mx-auto max-w-md w-full flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-serif text-2xl font-semibold tracking-[0.35em] text-gold">
          VOW
        </p>

        <blockquote className="mt-6 max-w-xs">
          <p className="font-serif text-[1.7rem] italic leading-snug text-cream">
            “Chúng ta yêu, vì Chúa đã yêu chúng ta trước.”
          </p>
          <cite className="mt-3 block font-serif text-base italic font-medium tracking-wide text-gold">
            1 Giăng 4:19
          </cite>
        </blockquote>

        <p className="mt-6 max-w-xs text-[14px] leading-relaxed text-cream/70">
          Tình yêu thật sự không bắt nguồn từ khả năng, nỗ lực hay sự xứng đáng của bản thân, mà xuất phát từ chính Đức Chúa Trời, Đấng đã chủ động yêu thương chúng ta trước.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5 max-w-xs">
          {features.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3.5 py-1.5 text-[13px] text-cream/90"
            >
              <PillIcon type={item.icon} />
              {item.label}
            </span>
          ))}
        </div>

        <Link
          href="/dang-nhap"
          className="mt-9 w-full max-w-xs rounded-full bg-gold px-6 py-4 text-center text-base font-semibold text-ink shadow-lg shadow-gold/20 transition hover:brightness-105 active:scale-[0.99]"
        >
          Bắt đầu hành trình
        </Link>

        <p className="mt-4 text-xs text-muted">
          Đăng nhập hoặc tạo tài khoản mới chỉ trong vài giây
        </p>

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
