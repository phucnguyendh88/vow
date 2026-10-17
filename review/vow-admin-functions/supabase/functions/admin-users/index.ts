// Edge Function: admin-users
// Liệt kê users với thông tin auth (email, provider, anonymous).
// GET ?search=&type=all|email|anonymous|oauth&page=1&limit=20

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
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const type = url.searchParams.get("type") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Lấy profiles (phân trang ở DB)
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data: profiles, error: pErr, count } = await service
      .from("profiles")
      .select("user_id, name, age, church, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (pErr) throw pErr;

    // Lấy thông tin auth cho các user_id này (qua Admin API)
    // listUsers hỗ trợ phân trang, nhưng ở đây chỉ cần lookup theo id
    const userIds = (profiles || []).map((p) => p.user_id);
    const authMap: Record<string, { email?: string; provider?: string; anonymous: boolean; created_at?: string }> = {};
    // Gọi listUsers theo batch (tối đa 1000/page của API)
    let apiPage = 1;
    const found = new Set<string>();
    while (found.size < userIds.length && apiPage <= 10) {
      const { data, error } = await service.auth.admin.listUsers({ page: apiPage, perPage: 1000 });
      if (error) break;
      for (const u of data?.users || []) {
        // Map auth user -> profile qua user_metadata hoặc so khớp id
        // profiles.user_id là text, có thể là auth user id
        if (userIds.includes(u.id)) {
          const identities = u.identities || [];
          const provider = identities.length > 0 ? identities[0].provider : (u.is_anonymous ? "anonymous" : "email");
          authMap[u.id] = {
            email: u.email || undefined,
            provider,
            anonymous: !!u.is_anonymous,
            created_at: u.created_at,
          };
          found.add(u.id);
        }
      }
      if (!data?.users || data.users.length < 1000) break;
      apiPage++;
    }

    let users = (profiles || []).map((p) => {
      const a = authMap[p.user_id];
      return {
        id: p.user_id,
        name: p.name,
        age: p.age,
        church: p.church || "",
        createdAt: p.created_at,
        email: a?.email,
        provider: a?.provider || "unknown",
        anonymous: a?.anonymous ?? false,
      };
    });

    // Lọc theo search (name hoặc user_id)
    if (search) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.id.toLowerCase().includes(search) ||
          (u.email || "").toLowerCase().includes(search),
      );
    }
    // Lọc theo loại
    if (type === "anonymous") users = users.filter((u) => u.anonymous);
    else if (type === "email") users = users.filter((u) => !u.anonymous && u.provider === "email");
    else if (type === "oauth") users = users.filter((u) => !u.anonymous && u.provider !== "email");

    return jsonResponse({ users, total: count || 0, page, limit });
  } catch (e) {
    return errorResponse("Không tải được danh sách người dùng", 500);
  }
});
