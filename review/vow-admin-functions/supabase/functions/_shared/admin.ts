// Shared admin auth helper for VOW Edge Functions.
// Verifies JWT from Supabase Auth, checks admin email server-side.

const ADMIN_EMAIL = "phucnguyendh88@gmail.com";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status: number) {
  // Không lộ stack trace hay thông tin nhạy cảm
  return jsonResponse({ error: message }, status);
}

/**
 * Xác thực admin từ JWT. Trả về { user } nếu hợp lệ, ngược lại trả về Response lỗi.
 * Không tin email/role do client tự gửi — chỉ dùng JWT đã verify.
 */
export async function requireAdmin(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ user: { id: string; email: string } } | { response: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { response: errorResponse("Thiếu token xác thực", 401) };
  }
  const token = authHeader.slice(7);

  // Verify JWT bằng Supabase Auth API (dùng anon key, không cần service_role)
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const client = createClient(supabaseUrl, anonKey);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.email) {
    return { response: errorResponse("Token không hợp lệ", 401) };
  }
  const email = data.user.email.trim().toLowerCase();
  if (email !== ADMIN_EMAIL) {
    return { response: errorResponse("Không có quyền quản trị", 403) };
  }
  return { user: { id: data.user.id, email: data.user.email } };
}

/** Ghi audit log (dùng service_role client). Không throw nếu fail. */
export async function writeAuditLog(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  adminEmail: string,
  action: string,
  targetUserId: string | null,
  // deno-lint-ignore no-explicit-any
  detail: Record<string, any>,
) {
  try {
    await serviceClient.from("admin_audit_log").insert({
      admin_email: adminEmail,
      action,
      target_user_id: targetUserId,
      detail,
    });
  } catch {
    // Không làm fail thao tác chính vì log lỗi
  }
}
