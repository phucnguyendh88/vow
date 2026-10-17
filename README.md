# VOW — Ứng dụng Kết nối Cơ Đốc

> Học Kinh Thánh hằng ngày · Chia sẻ khoảnh khắc (Locket-style) · Hẹn hò kết nối (Tinder-style)

## Stack

- **Frontend & API:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Animation:** Framer Motion
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth (Google OAuth + Anonymous/Guest)
- **Storage:** Supabase Storage (ảnh & video)
- **Realtime:** Supabase Realtime (WebSocket)
- **Deploy:** Vercel + Supabase Cloud

## Cấu trúc dự án

```
vow/
├── app/
│   ├── (auth)/dang-nhap/     # Trang đăng nhập
│   ├── (main)/               # Layout chính với Bottom Nav
│   │   ├── tim-chua-truoc/   # Tab 1: Học Kinh Thánh
│   │   ├── khoang-khac/      # Tab 2: Khoảnh khắc (Locket)
│   │   └── ket-noi-sau/      # Tab 3: Hẹn hò (Tinder)
│   ├── api/
│   │   ├── swipe/            # API quẹt Like/Pass
│   │   ├── moments/          # API tạo/xóa khoảnh khắc
│   │   ├── messages/         # API tin nhắn
│   │   └── admin/            # API quản trị (cần Admin role)
│   └── auth/callback/        # OAuth callback handler
├── components/
│   ├── ui/BottomNav.tsx
│   ├── devotion/DevotionClient.tsx
│   ├── moments/MomentsClient.tsx
│   └── dating/DatingClient.tsx
├── lib/supabase/
│   ├── client.ts             # Browser Supabase client
│   └── server.ts             # Server + Admin Supabase client
├── types/database.ts         # TypeScript types từ DB schema
├── middleware.ts             # Auth middleware
└── supabase/
    └── migrations/001_initial_schema.sql
```

## Cài đặt & Chạy

### 1. Tạo Supabase project

1. Vào [supabase.com](https://supabase.com) → New Project
2. Lấy **Project URL** và **anon key** từ Settings → API
3. Chạy migration: Project → SQL Editor → Paste nội dung `supabase/migrations/001_initial_schema.sql`
4. Bật Google OAuth: Authentication → Providers → Google → Enable

### 2. Cài đặt local

```bash
# Copy file env
copy .env.example .env.local

# Điền vào .env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cài dependencies
npm install

# Chạy development server
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

### 3. Deploy lên Vercel

```bash
# Push lên GitHub
git init
git add .
git commit -m "feat: initial VOW app"
git remote add origin https://github.com/<username>/vow.git
git push -u origin main
```

Sau đó:
1. [vercel.com](https://vercel.com) → Import từ GitHub
2. Thêm Environment Variables (3 biến từ .env.local)
3. Deploy!

## Tính năng đã triển khai

### ✅ Auth & Session
- Đăng nhập Google OAuth
- Đăng nhập ẩn danh (Guest)
- Session persistence qua middleware
- Protect routes

### ✅ Tab 1: Tìm Chúa Trước
- Câu Kinh Thánh hàng ngày (Verse of the Day)
- Bài suy ngẫm
- Chuỗi streak theo tuần (T2→CN)
- Đánh dấu đã đọc hôm nay

### ✅ Tab 2: Khoảnh Khắc
- Camera trước/sau với flip
- Zoom thực sự (dựa trên thiết bị)
- Chụp ảnh & compress trước upload
- Upload lên Supabase Storage
- Gallery picker từ thiết bị
- Lịch sử khoảnh khắc (grid)

### ✅ Tab 3: Kết Nối Sau
- Card swipe UI với Framer Motion animation
- Like/Pass với bảo vệ chống duplicate (UNIQUE constraint)
- Auto Match detection qua DB trigger
- Match celebration popup
- Danh sách Matches
- Block check trước khi swipe

### ✅ API Backend
- `/api/swipe` — Ghi nhận quẹt, kiểm tra block, verify auth
- `/api/moments` — Upload metadata, soft delete với Storage cleanup
- `/api/messages` — Phân trang cursor-based, idempotency key

### ✅ Database
- 15 bảng với đầy đủ RLS policies
- Trigger tự động tạo profile khi đăng ký
- Trigger auto-match khi 2 người cùng Like
- Trigger auto-friendship khi friend request được chấp nhận
- idempotency_key cho messages
- Soft delete cho moments và messages

## 🚧 Đang phát triển

- [ ] Chat realtime UI
- [ ] Friend requests
- [ ] Admin dashboard
- [ ] Push notifications
- [ ] Report/Block UI
- [ ] Profile editor
- [ ] Tạo hình nền câu Kinh Thánh (canvas export)
