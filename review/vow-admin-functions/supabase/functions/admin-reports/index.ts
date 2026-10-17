// Edge Function: admin-reports
// Liệt kê reports toàn hệ thống. GET ?page=1&limit=20&status=all
// Schema reports hiện tại: id, reporter_id, reported_id, reason, created_at
// (chưa có cột status — trả về tất cả, xử lý ở client)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, requireAdmin } from "../_shared/admin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  const auth = await requireAdmin(req, SUPABASE_URL, SUPABASE_ANON_KEY);
  if ("response" in auth) return auth.response;

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(60, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error, count } = await service
      .from("reports")
      .select("id, reporter_id, reported_id, reason, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;

    // Map tên
    const ids = [...new Set([...(data || []).map((r) => r.reporter_id), ...(data || []).map((r) => r.reported_id)])];
    const nameMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await service.from("profiles").select("user_id, name").in("user_id", ids);
      for (const p of profiles || []) nameMap[p.user_id] = p.name;
    }

    const reports = (data || []).map((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      reporterName: nameMap[r.reporter_id] || "Người dùng",
      reportedId: r.reported_id,
      reportedName: nameMap[r.reported_id] || "Người dùng",
      reason: r.reason || "",
      createdAt: r.created_at,
    }));

    return jsonResponse({ reports, total: count || 0, page, limit });
  } catch {
    return errorResponse("Không tải được reports", 500);
  }
});
