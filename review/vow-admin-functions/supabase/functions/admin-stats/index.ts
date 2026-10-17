// Edge Function: admin-stats
// Thống kê tổng quan: users, users mới 7/30 ngày, moments, messages, matches.

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
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

    const [u, u7, u30, mo, ms, mt] = await Promise.all([
      service.from("profiles").select("id", { count: "exact", head: true }),
      service.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d7),
      service.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d30),
      service.from("moments").select("id", { count: "exact", head: true }),
      service.from("messages").select("id", { count: "exact", head: true }),
      service.from("dating_matches").select("id", { count: "exact", head: true }),
    ]);

    // Tăng trưởng 12 tuần gần nhất (đếm profiles theo tuần)
    const growth: { week: string; users: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 3600 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
      const { count } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
      growth.push({
        week: `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`,
        users: count || 0,
      });
    }

    return jsonResponse({
      users: u.count || 0,
      users7d: u7.count || 0,
      users30d: u30.count || 0,
      moments: mo.count || 0,
      messages: ms.count || 0,
      matches: mt.count || 0,
      // DAU/WAU: chưa có bảng sự kiện hoạt động → ghi rõ giới hạn
      dau: null,
      wau: null,
      dau_note: "Chưa có dữ liệu sự kiện hoạt động để tính DAU/WAU.",
      growth,
    });
  } catch {
    return errorResponse("Không tải được thống kê", 500);
  }
});
