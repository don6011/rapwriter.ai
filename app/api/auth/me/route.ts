import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const [{ data: userData }, { data: roleRows, error: roleError }] = userId
    ? await Promise.all([
        supabase.auth.getUser(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ])
    : [{ data: { user: null } }, { data: [], error: null }];

  return NextResponse.json(
    {
      authenticated: Boolean(userId),
      user_id: userId,
      email,
      email_verified: Boolean(userData.user?.email_confirmed_at),
      roles: (roleRows ?? []).map((row) => row.role),
      error: error?.message ?? roleError?.message ?? null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
