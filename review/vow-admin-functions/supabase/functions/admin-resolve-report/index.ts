// Edge Function: admin-resolve-report
// Xử lý report: dismiss (bỏ qua) hoặc delete_reported_moments (xóa moments của reported user).
// Schema reports hiện tại chưa có cột status → "resolve" = xóa report khỏi danh sách
// (giữ nguyên yêu cầu không xóa bằng chứng: chỉ xóa khi admin chọn xóa nội dung vi phạm).
// POST { report_id: string, action: "dismiss" | "delete_moments" }

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

  let body: { report_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body không hợp lệ", 400);
  }
  const reportId = (body.report_id || "").trim();
  const action = body.action;
  if (!reportId) return errorResponse("Thiếu report_id", 400);
  if (action !== "dismiss" && action !== "delete_moments") {
    return errorResponse("Action không hợp lệ", 400);
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const { data: report } = await service
      .from("reports")
      .select("id, reporter_id, reported_id, reason")
      .eq("id", reportId)
      .maybeSingle();
    if (!report) return errorResponse("Không tìm thấy report", 404);

    if (action === "delete_moments") {
      // Xóa toàn bộ moments của reported user (nội dung vi phạm)
      await service.from("moments").delete().eq("user_id", report.reported_id);
    }

    // Xóa report khỏi hàng đợi (đã xử lý)
    const { error } = await service.from("reports").delete().eq("id", reportId);
    if (error) throw error;

    await writeAuditLog(service, auth.user.email, "resolve_report", report.reported_id, {
      report_id: reportId,
      action,
      reason: report.reason,
    });

    return jsonResponse({ ok: true, action });
  } catch {
    return errorResponse("Xử lý report thất bại", 500);
  }
});
