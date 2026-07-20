import { NextResponse } from "next/server";
import { isAppRole, type AppRole } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;

  if (error || !id) {
    return { supabase, user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = { id, email };
  return { supabase, user, response: null };
}

export async function requireRole(role: AppRole) {
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
      response: NextResponse.json({ error: "Access roles are unavailable." }, { status: 503 }),
    };
  }

  const roles = (data ?? []).map((row) => row.role).filter(isAppRole);
  if (!roles.includes(role)) {
    return {
      ...auth,
      roles,
      response: NextResponse.json({ error: `${role === "admin" ? "Admin" : "Producer"} access required.` }, { status: 403 }),
    };
  }

  return { ...auth, roles, response: null };
}
