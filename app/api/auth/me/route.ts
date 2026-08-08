import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";

export async function GET() {
  const auth = await requireUser();
  if (auth.response || !auth.user) return auth.response;
  const [{ data: userData }, { data: roleRows, error: roleError }] = await Promise.all([
    auth.supabase.auth.getUser(),
    auth.supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
  ]);

  return NextResponse.json(
    {
      authenticated: true,
      user_id: auth.user.id,
      email: auth.user.email,
      email_verified: Boolean(userData.user?.email_confirmed_at),
      roles: (roleRows ?? []).map((row) => row.role),
      account_status: auth.account?.status ?? "active",
      error: roleError?.message ?? null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
