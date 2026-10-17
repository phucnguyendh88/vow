// Edge Function: admin-moments
// Liệt kê TẤT CẢ moments toàn hệ thống (không lọc theo user hiện tại).
// GET ?page=1&limit=24
//
// Ảnh (sửa 2026-10-14 — fix sau migration Storage):
//  - Ưu tiên tạo signed URL từ image_path (bucket moment-images, TTL 1 giờ).
//  - Fallback về image_data_url (base64 cũ) nếu chưa có image_path.
//  - Nếu cả hai đều không có / tạo signed URL thất bại: trả imageError rõ ràng,
//    KHÔNG làm hỏng toàn bộ danh sách.
//  - Không log signed URL / token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, requireAdmin } from "../_shared/admin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** TTL signed URL cho admin xem trước: 1 giờ (đồng nhất với app). */
const SIGNED_URL_TTL_SECONDS = 3600;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  const auth = await requireAdmin(req, SUPABASE_URL, SUPABASE_ANON_KEY);
  if ("response" in auth) return auth.response;

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(60, Math.max(1, parseInt(url.searchParams.get("limit") || "24", 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error, count } = await service
      .from("moments")
      .select("id, user_id, image_data_url, image_path, caption, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;

    // Map tên tác giả
    const userIds = [...new Set((data || []).map((m) => m.user_id))];
    const nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      for (const p of profiles || []) nameMap[p.user_id] = p.name;
    }

    // Resolve ảnh từng moment. Lỗi 1 ảnh không làm hỏng cả danh sách.
    const moments = await Promise.all(
      (data || []).map(async (m) => {
        let imageDataUrl: string | null = null;
        let imageError: string | null = null;

        const storagePath = (m.image_path || "").trim();
        if (storagePath) {
          try {
            const { data: signed, error: signError } = await service.storage
              .from("moment-images")
              .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
            if (signError || !signed?.signedUrl) throw signError || new Error("empty signed url");
            imageDataUrl = signed.signedUrl;
          } catch (e) {
            // Chỉ log path + message để chẩn đoán. KHÔNG log signed URL / token.
            console.error(
              `[admin-moments] signed URL failed, moment=${m.id} path=${storagePath}:`,
              e instanceof Error ? e.message : e,
            );
            imageError = "Không tạo được link ảnh từ Storage";
          }
        }

        // Fallback: base64 cũ cho moments chưa migrate
        if (!imageDataUrl && m.image_data_url) {
          imageDataUrl = m.image_data_url;
          imageError = null;
        }

        if (!imageDataUrl && !imageError) {
          imageError = "Moment này không có ảnh";
        }

        return {
          id: m.id,
          userId: m.user_id,
          authorName: nameMap[m.user_id] || "Người dùng",
          imageDataUrl,
          // Trường bổ sung (UI cũ bỏ qua nếu không dùng): trạng thái lỗi ảnh rõ ràng
          imageError,
          caption: m.caption || "",
          createdAt: m.created_at,
        };
      }),
    );

    return jsonResponse({ moments, total: count || 0, page, limit });
  } catch {
    return errorResponse("Không tải được moments", 500);
  }
});
