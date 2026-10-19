import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Chính sách bảo mật — VOW',
}

const sections = [
  {
    heading: '1. VOW là ai',
    body: [
      'VOW là ứng dụng kết nối cộng đồng Cơ Đốc: tĩnh nguyện mỗi ngày, khoảnh khắc cùng bạn bè, và kết nối với người cùng đức tin.',
      'Đơn vị vận hành: TYL Team\nLiên hệ: phucnguyendh88@gmail.com',
    ],
  },
  {
    heading: '2. Dữ liệu chúng tôi thu thập',
    body: [
      'Khi bạn đăng ký và dùng VOW, chúng tôi thu thập:',
      '• Thông tin hồ sơ: tên, năm sinh, giới tính, hội thánh, khu vực, giới thiệu bản thân (bio), sở thích, ảnh đại diện.\n• Thông tin đăng nhập: thông tin tài khoản Google (nếu đăng nhập bằng Google).\n• Nội dung bạn tạo: ảnh khoảnh khắc, tin nhắn, phản ứng tin nhắn, nội dung cầu nguyện, lịch sử đọc tĩnh nguyện, lượt quẹt THÍCH/BỎ QUA.\n• Dữ liệu kỹ thuật: nhật ký truy cập cơ bản phục vụ vận hành và chống lạm dụng.',
      'Chúng tôi không thu thập vị trí GPS chính xác, danh bạ, hay dữ liệu sức khỏe.',
    ],
  },
  {
    heading: '3. Dữ liệu dùng để làm gì',
    body: [
      '• Hiển thị hồ sơ của bạn cho người dùng khác theo đúng logic app (hồ sơ cho mục Kết nối, khoảnh khắc chỉ bạn bè thấy, tin nhắn chỉ trong cuộc trò chuyện của bạn).\n• Ghép đôi, gợi ý kết bạn, và vận hành các tính năng: Tĩnh nguyện / Bạn bè / Kết nối / Hồ sơ.\n• Bảo mật tài khoản, ngăn spam và hành vi lạm dụng.\n• Cải thiện app. Chúng tôi không bán dữ liệu của bạn cho bất kỳ ai, và không dùng dữ liệu để quảng cáo.',
    ],
  },
  {
    heading: '4. Dữ liệu được lưu ở đâu',
    body: [
      'Dữ liệu lưu trên hạ tầng Supabase, máy chủ đặt tại Singapore. Chúng tôi áp dụng các biện pháp bảo mật hợp lý (mã hóa đường truyền, phân quyền truy cập theo vai trò), nhưng không có hệ thống nào an toàn tuyệt đối.',
    ],
  },
  {
    heading: '5. Ai thấy dữ liệu của bạn',
    body: [
      '• Người dùng khác chỉ thấy những gì app thiết kế cho họ thấy (như mục 3).\n• Đội ngũ vận hành VOW có thể truy cập dữ liệu khi cần hỗ trợ kỹ thuật hoặc xử lý vi phạm.\n• Chúng tôi chỉ tiết lộ dữ liệu cho bên thứ ba khi pháp luật yêu cầu.',
    ],
  },
  {
    heading: '6. Quyền của bạn (theo Nghị định 13/2023/NĐ-CP)',
    body: [
      'Bạn có quyền: được biết, đồng ý, rút lại sự đồng ý, truy cập, chỉnh sửa, xóa dữ liệu, hạn chế xử lý, và khiếu nại.',
      'Để thực hiện quyền, liên hệ email ở mục 1.',
    ],
  },
  {
    heading: '7. Xóa tài khoản',
    body: [
      'Bạn có thể yêu cầu xóa tài khoản bất cứ lúc nào qua email liên hệ. Sau khi xác minh, chúng tôi xóa hồ sơ, ảnh, tin nhắn và nội dung của bạn khỏi hệ thống đang hoạt động trong vòng 3 ngày.',
    ],
  },
  {
    heading: '8. Người dưới 18 tuổi',
    body: [
      'VOW chỉ dành cho người từ 18 tuổi trở lên. Nếu phát hiện tài khoản dưới 18 tuổi, chúng tôi sẽ khóa và xóa.',
    ],
  },
  {
    heading: '9. Thay đổi chính sách',
    body: [
      'Khi có thay đổi quan trọng, chúng tôi thông báo trong app.',
    ],
  },
]

export default function PrivacyPage() {
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
          Chính sách bảo mật
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
