// Edge Function: admin-audit-log
// Xem nhật ký quản trị. GET ?page=1&limit=30
// Chỉ admin được xem (xác thực ở requireAdmin).

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
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "30", 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error, count } = await service
      .from("admin_audit_log")
      .select("id, admin_email, action, target_user_id, detail, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;

    return jsonResponse({
      logs: (data || []).map((l) => ({
        id: l.id,
        adminEmail: l.admin_email,
        action: l.action,
        targetUserId: l.target_user_id,
        detail: l.detail,
        createdAt: l.created_at,
      })),
      total: count || 0,
      page,
      limit,
    });
  } catch {
    return errorResponse("Không tải được nhật ký", 500);
  }
});
