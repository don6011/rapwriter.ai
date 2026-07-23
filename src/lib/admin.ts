import { cookies } from "next/headers";
import { isAppRole, type AppRole } from "@/lib/access-control";
import { hasSupabaseSessionCookie } from "@/lib/supabase/auth-cookie";
import { createClient } from "@/lib/supabase/server";

export async function getAdminSession() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  if (!hasSupabaseSessionCookie(cookieStore.getAll())) {
    return { user: null, roles: [] as AppRole[], isAdmin: false, error: null };
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const id = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  const email = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null;

  if (claimsError || !id) {
    return { user: null, roles: [] as AppRole[], isAdmin: false, error: claimsError?.message ?? null };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", id);
  const roles = (roleRows ?? []).map((row) => row.role).filter(isAppRole);

  return {
    user: { id, email },
    roles,
    isAdmin: roles.includes("admin"),
    error: roleError?.message ?? null,
  };
}
