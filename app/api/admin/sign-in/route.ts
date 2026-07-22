import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function adminRedirect(request: Request, error?: string) {
  const url = new URL("/admin", request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries((await request.formData()).entries());
  const isFormPost = !contentType.includes("application/json");
  const parsed = signInSchema.safeParse(body);

  if (!parsed.success) {
    if (isFormPost) return adminRedirect(request, "Enter a valid admin email and password.");
    return NextResponse.json({ error: "Enter a valid admin email and password." }, { status: 400 });
  }

  const rateLimit = await enforceRateLimit(request, {
    scope: "admin-sign-in",
    limit: 8,
    windowSeconds: 5 * 60,
  });
  if (rateLimit) return rateLimit;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password,
    });

    if (error) {
      const message = "Email or password is incorrect.";
      if (isFormPost) return adminRedirect(request, message);
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      await supabase.auth.signOut();
      if (isFormPost) return adminRedirect(request, "Admin access roles are unavailable.");
      return NextResponse.json({ error: "Admin access roles are unavailable." }, { status: 503 });
    }

    if (!role) {
      await supabase.auth.signOut();
      if (isFormPost) return adminRedirect(request, "This account does not have the admin role.");
      return NextResponse.json({ error: "This account does not have the admin role." }, { status: 403 });
    }

    if (isFormPost) return adminRedirect(request);
    return NextResponse.json({ ok: true, email: data.user.email });
  } catch {
    const message = "Admin sign-in is temporarily unavailable.";
    if (isFormPost) return adminRedirect(request, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
