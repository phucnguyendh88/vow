import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Điều khoản sử dụng — VOW',
}

const sections = [
  {
    heading: '1. Chấp nhận điều khoản',
    body: [
      'Khi tạo tài khoản hoặc dùng VOW, bạn đồng ý với toàn bộ điều khoản này. Nếu không đồng ý, vui lòng không sử dụng app.',
    ],
  },
  {
    heading: '2. Điều kiện sử dụng',
    body: [
      '• Bạn từ 18 tuổi trở lên.\n• Bạn cung cấp thông tin trung thực (tên, tuổi, ảnh là của chính bạn).\n• Một người chỉ dùng một tài khoản. Tài khoản là của riêng bạn, không chia sẻ.',
    ],
  },
  {
    heading: '3. Quy tắc cộng đồng',
    body: [
      'VOW là cộng đồng Cơ Đốc. Khi dùng app, bạn cam kết:\n• Tôn trọng người khác; không quấy rối, đe dọa, kỳ thị hay gạ gẫm.\n• Không đăng nội dung khiêu dâm, bạo lực, lừa đảo, cờ bạc, hay vi phạm pháp luật Việt Nam.\n• Không spam, không quảng cáo, không thu thập thông tin người khác.\n• Nội dung cầu nguyện và chia sẻ đức tin được chào đón — nhưng không dùng danh nghĩa đức tin để thao túng hay lừa gạt người khác.',
      'Vi phạm có thể dẫn đến cảnh cáo, khóa tạm thời hoặc khóa vĩnh viễn tài khoản mà không cần báo trước.',
    ],
  },
  {
    heading: '4. Nội dung của bạn',
    body: [
      'Bạn giữ quyền với nội dung mình đăng (ảnh, tin nhắn, bài cầu nguyện). Khi đăng lên VOW, bạn cho phép chúng tôi lưu trữ và hiển thị nội dung đó cho người dùng khác theo đúng logic của app (ví dụ: khoảnh khắc chỉ bạn bè thấy).',
      'Bạn chịu trách nhiệm về nội dung mình đăng. Không đăng nội dung của người khác khi chưa được phép.',
    ],
  },
  {
    heading: '5. Kết nối và gặp gỡ ngoài đời',
    body: [
      'VOW chỉ là cầu nối. Chúng tôi không xác minh danh tính người dùng và không chịu trách nhiệm về hành vi của người dùng khác.',
      'Nếu bạn gặp gỡ ai đó ngoài đời, hãy tự bảo vệ mình: gặp ở nơi công cộng, cho người thân biết, và tin vào linh cảm của bạn.',
    ],
  },
  {
    heading: '6. Tài khoản khách (Guest)',
    body: [
      'Tài khoản khách dùng thử nhanh các tính năng cơ bản. Một số tính năng (kết nối, nhắn tin) có thể yêu cầu đăng ký đầy đủ. Dữ liệu tài khoản khách có thể bị xóa sau thời gian không hoạt động.',
    ],
  },
  {
    heading: '7. Thay đổi và ngừng dịch vụ',
    body: [
      'Chúng tôi có thể cập nhật app và điều khoản này; thay đổi quan trọng sẽ được thông báo trong app. Chúng tôi có thể tạm ngừng hoặc ngừng dịch vụ khi cần thiết.',
    ],
  },
  {
    heading: '8. Miễn trừ trách nhiệm',
    body: [
      'App được cung cấp "nguyên trạng". Trong phạm vi pháp luật cho phép, chúng tôi không chịu trách nhiệm về thiệt hại phát sinh từ việc bạn sử dụng app hoặc tương tác với người dùng khác.',
    ],
  },
  {
    heading: '9. Liên hệ',
    body: [
      'Mọi thắc mắc về điều khoản xin liên hệ: phucnguyendh88@gmail.com',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-svh bg-ink text-cream">
      <div className="mx-auto max-w-md px-6 py-10 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-cream mb-6 transition"
        >
          <ArrowLeft size={16} />
          <span>Về trang chủ</span>
        </Link>

        <h1 className="font-serif text-3xl font-semibold text-cream">
          Điều khoản sử dụng
        </h1>
        <p className="mt-2 text-xs text-muted">
          Cập nhật lần cuối: Tháng 10, 2026
        </p>

        <div className="mt-8 space-y-6">
          {sections.map((s) => (
            <section key={s.heading} className="rounded-2xl bg-surface p-5 border border-white/5">
              <h2 className="font-serif text-lg font-semibold text-gold mb-3">
                {s.heading}
              </h2>
              {s.body.map((p, idx) => (
                <p
                  key={idx}
                  className="text-sm leading-relaxed text-cream/80 whitespace-pre-line mt-2 first:mt-0"
                >
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
