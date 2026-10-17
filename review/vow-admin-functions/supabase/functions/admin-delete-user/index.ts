// Edge Function: admin-delete-user
// Xóa user: Auth user + dữ liệu liên quan theo đúng thứ tự FK.
// POST { user_id: string, confirm: true }
// Không cho xóa chính admin đang thao tác.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, requireAdmin, writeAuditLog } from "../_shared/admin.ts";

const ADMIN_EMAIL = "phucnguyendh88@gmail.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return errorResponse("Chỉ hỗ trợ POST", 405);
  }

  const auth = await requireAdmin(req, SUPABASE_URL, SUPABASE_ANON_KEY);
  if ("response" in auth) return auth.response;
  const admin = auth.user;

  let body: { user_id?: string; confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body không hợp lệ", 400);
  }
  const targetId = (body.user_id || "").trim();
  if (!targetId) return errorResponse("Thiếu user_id", 400);
  if (body.confirm !== true) return errorResponse("Cần xác nhận xóa", 400);

  // Không cho xóa chính mình (so theo email admin)
  // Lấy auth user của target để so sánh email
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Kiểm tra target tồn tại trong profiles
    const { data: profile } = await service
      .from("profiles")
      .select("user_id")
      .eq("user_id", targetId)
      .maybeSingle();
    if (!profile) {
      return errorResponse("Không tìm thấy người dùng", 404);
    }

    // Tìm auth user id tương ứng (profiles.user_id thường là auth uid)
    // Thử lấy auth user để kiểm tra có phải admin không
    const { data: authUser } = await service.auth.admin.getUserById(targetId);
    if (authUser?.user?.email?.trim().toLowerCase() === ADMIN_EMAIL) {
      return errorResponse("Không thể xóa tài khoản quản trị", 403);
    }

    // Xóa dữ liệu liên quan theo thứ tự (từ chi tiết đến tổng quát).
    // Dùng service_role nên bypass RLS. Thứ tự quan trọng để tránh lỗi FK.
    const steps: string[] = [];

    // 1. message_reactions của user
    await service.from("message_reactions").delete().eq("user_id", targetId);
    steps.push("message_reactions");

    // 2. messages do user gửi
    await service.from("messages").delete().eq("sender_id", targetId);
    steps.push("messages");

    // 3. conversation_members của user (rời khỏi mọi conversation)
    // Lấy danh sách conversation chỉ còn mình user này để dọn conversation rỗng
    const { data: memberRows } = await service
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", targetId);
    const convIds = [...new Set((memberRows || []).map((r) => r.conversation_id))];
    await service.from("conversation_members").delete().eq("user_id", targetId);
    steps.push("conversation_members");

    // 4. Xóa conversations rỗng (không còn member nào) mà user từng tham gia
    for (const cid of convIds) {
      const { count } = await service
        .from("conversation_members")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", cid);
      if ((count || 0) === 0) {
        await service.from("conversations").delete().eq("id", cid);
      }
    }
    steps.push("empty_conversations");

    // 5. moments của user
    await service.from("moments").delete().eq("user_id", targetId);
    steps.push("moments");

    // 6. friendships (cả 2 chiều)
    await service
      .from("friendships")
      .delete()
      .or(`user_id.eq.${targetId},friend_id.eq.${targetId}`);
    steps.push("friendships");

    // 7. swipes, matches (bảng match cũ)
    await service.from("swipes").delete().eq("user_id", targetId);
    await service.from("matches").delete().or(`user_id.eq.${targetId},profile_id.eq.${targetId}`);
    steps.push("swipes_matches");

    // 8. dating_matches (cả 2 chiều)
    await service
      .from("dating_matches")
      .delete()
      .or(`user_a_id.eq.${targetId},user_b_id.eq.${targetId}`);
    steps.push("dating_matches");

    // 9. blocked_users, reports
    await service
      .from("blocked_users")
      .delete()
      .or(`blocker_id.eq.${targetId},blocked_id.eq.${targetId}`);
    await service
      .from("reports")
      .delete()
      .or(`reporter_id.eq.${targetId},reported_id.eq.${targetId}`);
    steps.push("blocked_reports");

    // 10. devotional_reads, prayers
    await service.from("devotional_reads").delete().eq("user_id", targetId);
    await service.from("prayers").delete().eq("user_id", targetId);
    steps.push("devotional_prayers");

    // 11. profiles
    const { error: pErr } = await service.from("profiles").delete().eq("user_id", targetId);
    if (pErr) throw pErr;
    steps.push("profiles");

    // 12. Auth user (Supabase Admin API) — không atomic với DB, làm cuối cùng
    let authDeleted = false;
    if (authUser?.user) {
      const { error: aErr } = await service.auth.admin.deleteUser(targetId);
      if (aErr) {
        // Ghi log nhưng không fail toàn bộ — dữ liệu DB đã xóa
        await writeAuditLog(service, admin.email, "delete_user_partial", targetId, {
          steps,
          auth_error: aErr.message,
        });
        return jsonResponse({
          ok: false,
          partial: true,
          message: "Đã xóa dữ liệu nhưng xóa Auth user thất bại. Có thể thử lại.",
          steps,
        });
      }
      authDeleted = true;
    }

    await writeAuditLog(service, admin.email, "delete_user", targetId, {
      steps,
      auth_deleted: authDeleted,
    });

    return jsonResponse({ ok: true, steps, auth_deleted: authDeleted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Xóa người dùng thất bại";
    await writeAuditLog(service, admin.email, "delete_user_failed", targetId, {
      error: message,
    });
    return errorResponse("Xóa người dùng thất bại", 500);
  }
});
