import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
