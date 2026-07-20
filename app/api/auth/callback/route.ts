import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const appOrigin = configuredAppUrl ? new URL(configuredAppUrl).origin : requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const redirectUrl = new URL("/", appOrigin);
      redirectUrl.searchParams.set("auth_error", error.message);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL(next, appOrigin));
}
