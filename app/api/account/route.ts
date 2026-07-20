import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { createAdminClient } from "@/lib/supabase/admin";

const deleteSchema = z.object({ confirmation: z.literal("DELETE") });

export async function DELETE(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm permanent account deletion." }, { status: 400 });
  }

  const { user, response } = await requireUser();
  if (response || !user) return response;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Account deletion is temporarily unavailable." }, { status: 503 });
  }

  const [{ data: ownAdminRole }, { count: adminCount }, { data: producerBeats }, { data: roughTakes }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
    admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
    admin.from("producer_beats").select("audio_bucket, audio_path, artwork_path").eq("owner_id", user.id),
    admin.from("rough_takes").select("storage_bucket, storage_path").eq("owner_id", user.id),
  ]);

  if (ownAdminRole && (adminCount ?? 0) <= 1) {
    return NextResponse.json({ error: "Grant another admin before deleting the final admin account." }, { status: 409 });
  }

  const storageGroups = new Map<string, string[]>();
  for (const beat of producerBeats ?? []) {
    const bucket = beat.audio_bucket || "producer-beats";
    const paths = [beat.audio_path, beat.artwork_path].filter((path): path is string => Boolean(path));
    storageGroups.set(bucket, [...(storageGroups.get(bucket) ?? []), ...paths]);
  }
  for (const take of roughTakes ?? []) {
    if (!take.storage_path) continue;
    const bucket = take.storage_bucket || "rough-takes";
    storageGroups.set(bucket, [...(storageGroups.get(bucket) ?? []), take.storage_path]);
  }

  for (const [bucket, paths] of storageGroups) {
    if (!paths.length) continue;
    const { error } = await admin.storage.from(bucket).remove([...new Set(paths)]);
    if (error) return NextResponse.json({ error: "Could not remove account media." }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
