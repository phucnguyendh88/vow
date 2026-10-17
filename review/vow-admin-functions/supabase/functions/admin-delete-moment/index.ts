// Edge Function: admin-delete-moment
// Xóa moment (kèm dọn ảnh Storage). POST { moment_id: string }
//
// Thứ tự an toàn (sửa 2026-10-14):
//  1. Verify quyền admin (server-side, như cũ).
//  2. Lấy image_path TRƯỚC khi xóa.
//  3. Xóa row DB trước — nếu DB fail thì không đụng Storage
//     (tránh xóa ảnh xong nhưng moment vẫn còn → feed gãy ảnh).
//  4. Dọn object Storage sau — nếu fail thì ghi log rõ để xử lý lại
//     (chỉ orphan vô hình, không ảnh hưởng hiển thị).
//  5. Fail-closed khi path bất thường: chỉ xóa object nằm trong folder
//     của đúng user sở hữu moment (định dạng "{user_id}/{uuid}.ext",
//     upload với upsert:false nên mỗi object chỉ thuộc 1 moment).
//  6. Không log signed URL / token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, requireAdmin, writeAuditLog } from "../_shared/admin.ts";

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

  let body: { moment_id?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body không hợp lệ", 400);
  }
  const momentId = (body.moment_id || "").trim();
  if (!momentId) return errorResponse("Thiếu moment_id", 400);

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    // Lấy image_path TRƯỚC khi xóa để dọn Storage sau
    const { data: m } = await service
      .from("moments")
      .select("id, user_id, image_path")
      .eq("id", momentId)
      .maybeSingle();
    if (!m) return errorResponse("Không tìm thấy moment", 404);

    // Xóa row DB trước — DB là nguồn chân lý cho hiển thị
    const { error: deleteError } = await service.from("moments").delete().eq("id", momentId);
    if (deleteError) throw deleteError;

    // Dọn object Storage (best-effort, có log để xử lý lại)
    let storageCleaned = true;
    const storagePath = (m.image_path || "").trim();
    if (storagePath) {
      // Fail-closed: chỉ xóa khi path nằm trong folder của đúng chủ moment
      const expectedPrefix = `${m.user_id}/`;
      if (storagePath.includes("/") && storagePath.startsWith(expectedPrefix)) {
        const { error: storageError } = await service.storage
          .from("moment-images")
          .remove([storagePath]);
        if (storageError) {
          storageCleaned = false;
          console.error(
            `[admin-delete-moment] storage cleanup failed, moment=${momentId} path=${storagePath}:`,
            storageError.message,
          );
        }
      } else {
        storageCleaned = false;
        console.error(
          `[admin-delete-moment] skipped storage cleanup (unexpected path), moment=${momentId} path=${storagePath}`,
        );
      }
    }

    await writeAuditLog(service, auth.user.email, "delete_moment", m.user_id, {
      moment_id: momentId,
      storage_cleaned: storageCleaned,
      had_image_path: !!storagePath,
    });

    return jsonResponse({ ok: true, storage_cleaned: storageCleaned });
  } catch {
    return errorResponse("Xóa moment thất bại", 500);
  }
});
