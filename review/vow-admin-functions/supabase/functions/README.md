# VOW Admin Edge Functions — Hướng dẫn deploy

## Danh sách functions

| Function | Method | Mô tả |
|---|---|---|
| `admin-users` | GET | Liệt kê users + thông tin auth (email, provider, anonymous) |
| `admin-delete-user` | POST | Xóa user: dữ liệu liên quan + Auth user |
| `admin-stats` | GET | Thống kê tổng quan |
| `admin-moments` | GET | Tất cả moments toàn hệ thống |
| `admin-delete-moment` | POST | Xóa moment |
| `admin-reports` | GET | Liệt kê reports |
| `admin-resolve-report` | POST | Xử lý report (dismiss / delete_moments) |
| `admin-audit-log` | GET | Xem nhật ký quản trị |

Tất cả đều xác thực JWT server-side và chỉ cho phép `phucnguyendh88@gmail.com`.

## Deploy (cần Supabase CLI + quyền project)

```bash
# 1. Cài Supabase CLI (nếu chưa có)
npm i -g supabase

# 2. Login
supabase login

# 3. Link project VOW
supabase link --project-ref epyzeqwqadcrkixfkptg

# 4. Deploy từng function
supabase functions deploy admin-users
supabase functions deploy admin-delete-user
supabase functions deploy admin-stats
supabase functions deploy admin-moments
supabase functions deploy admin-delete-moment
supabase functions deploy admin-reports
supabase functions deploy admin-resolve-report
supabase functions deploy admin-audit-log

# 5. Set secrets (trong Dashboard → Edge Functions → Secrets, hoặc CLI)
supabase secrets set SUPABASE_URL=https://epyzeqwqadcrkixfkptg.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<anon-key>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**Lưu ý:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` được Supabase tự inject
vào Edge Functions khi deploy qua CLI/Dashboard — thường không cần set thủ công.
Chỉ set nếu function báo thiếu env.

## Migration cần chạy trước

```sql
-- Trong SQL Editor (1 lần):
-- supabase-migration-admin-audit-log.sql
```

## Bảo mật

- `service_role` chỉ dùng trong Edge Functions (backend), không bao giờ xuất hiện ở client.
- Mỗi function verify JWT qua `auth.getUser(token)` rồi so sánh email với `ADMIN_EMAIL` cố định.
- Không tin bất kỳ trường nào do client gửi lên để quyết định quyền.
