import { cookies } from "next/headers";
import { isAppRole, isStaff as hasStaffAccess, type AppRole } from "@/lib/access-control";
import { hasSupabaseSessionCookie } from "@/lib/supabase/auth-cookie";
import { createClient } from "@/lib/supabase/server";

export async function getAdminSession() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  if (!hasSupabaseSessionCookie(cookieStore.getAll())) {
    return { user: null, roles: [] as AppRole[], isAdmin: false, isModerator: false, isStaff: false, isRestricted: false, restriction: null, error: null };
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const id = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  const email = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null;

  if (claimsError || !id) {
    return { user: null, roles: [] as AppRole[], isAdmin: false, isModerator: false, isStaff: false, isRestricted: false, restriction: null, error: claimsError?.message ?? null };
  }

  const [{ data: roleRows, error: roleError }, { data: restriction, error: restrictionError }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase.from("account_controls").select("status, reason, expires_at").eq("owner_id", id).maybeSingle(),
  ]);
  const roles = (roleRows ?? []).map((row) => row.role).filter(isAppRole);
  const isRestricted = restriction?.status === "blocked"
    || (restriction?.status === "suspended" && (!restriction.expires_at || Date.parse(restriction.expires_at) > Date.now()));

  return {
    user: { id, email },
    roles,
    isAdmin: roles.includes("admin"),
    isModerator: roles.includes("moderator"),
    isStaff: hasStaffAccess(roles),
    isRestricted,
    restriction: restriction ?? null,
    error: roleError?.message ?? restrictionError?.message ?? null,
  };
}
