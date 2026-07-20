import { NextResponse } from "next/server";
import { z } from "zod";

export async function parseJson<T extends z.ZodTypeAny>(request: Request, schema: T) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }

  return { data: parsed.data as z.infer<T>, response: null };
}
