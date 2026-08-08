import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasAnyRole, isAppRole, type AppRole } from "@/lib/access-control";
import { hasSupabaseSessionCookie } from "@/lib/supabase/auth-cookie";
import { createClient } from "@/lib/supabase/server";

const privateResponseHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function privateJson(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: privateResponseHeaders });
}

export async function requireUser() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  if (!hasSupabaseSessionCookie(cookieStore.getAll())) {
    return { supabase, user: null, response: privateJson({ error: "Unauthorized" }, 401) };
  }

  const { data, error } = await supabase.auth.getClaims();
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;

  if (error || !id) {
    return { supabase, user: null, response: privateJson({ error: "Unauthorized" }, 401) };
  }

  const user = { id, email };
  const { data: control, error: controlError } = await supabase
    .from("account_controls")
    .select("status, reason, expires_at")
    .eq("owner_id", id)
    .maybeSingle();

  if (controlError) {
    return {
      supabase,
      user: null,
      response: privateJson({ error: "Account access is temporarily unavailable." }, 503),
    };
  }

  const restrictionActive = control?.status === "blocked"
    || (control?.status === "suspended" && (!control.expires_at || Date.parse(control.expires_at) > Date.now()));
  if (restrictionActive) {
    const label = control.status === "blocked" ? "blocked" : "suspended";
    return {
      supabase,
      user: null,
      response: privateJson(
        {
          error: `This account is ${label}. ${control.reason ?? "Contact RapWriter support for assistance."}`,
          code: `account_${label}`,
          reason: control.reason,
          expires_at: control.expires_at,
        },
        403,
      ),
    };
  }

  return { supabase, user, account: control ?? { status: "active", reason: null, expires_at: null }, response: null };
}

export async function requireRole(role: AppRole) {
  return requireAnyRole([role]);
}

export async function requireAnyRole(requiredRoles: readonly AppRole[]) {
  const auth = await requireUser();
  if (auth.response || !auth.user) return { ...auth, roles: [] as AppRole[] };

  const { data, error } = await auth.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);

  if (error) {
    return {
      ...auth,
      roles: [] as AppRole[],
      response: privateJson({ error: "Access roles are unavailable." }, 503),
    };
  }

  const roles = (data ?? []).map((row) => row.role).filter(isAppRole);
  if (!hasAnyRole(roles, requiredRoles)) {
    const staffAccess = requiredRoles.includes("moderator") && requiredRoles.includes("admin");
    return {
      ...auth,
      roles,
      response: privateJson(
        { error: staffAccess ? "Control Room access required." : `${requiredRoles[0] === "admin" ? "Admin" : "Producer"} access required.` },
        403,
      ),
    };
  }

  return { ...auth, roles, response: null };
}
