import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { producerActionDecisionSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = await parseJson(request, producerActionDecisionSchema);
  if (parsed.response) return parsed.response;

  const actionId = (await params).id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actionId)) {
    return NextResponse.json({ error: "Invalid producer action." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("resolve_producer_action", {
    p_action_id: actionId,
    p_decision: parsed.data.decision,
  });

  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "22023" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
