import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260803210000_production_ai_infrastructure.sql"), "utf8");
const gateway = readFileSync(resolve(process.cwd(), "src/lib/server/ai-gateway.ts"), "utf8");
const route = readFileSync(resolve(process.cwd(), "app/api/producer-actions/route.ts"), "utf8");

describe("production AI infrastructure contract", () => {
  test("keeps provider credentials and generation server-side", () => {
    expect(gateway).toContain("process.env.OPENAI_API_KEY");
    expect(gateway).toContain("store: false");
    expect(gateway).toContain("safety_identifier");
    expect(gateway).not.toContain("NEXT_PUBLIC_OPENAI");
  });

  test("enforces auth, same-origin mutation, rate limiting, and idempotency", () => {
    expect(route).toContain("requireUser()");
    expect(route).toContain("hasValidRequestOrigin(request)");
    expect(route).toContain("enforceRateLimit");
    expect(route).toContain("request_id");
    expect(migration).toContain("unique(owner_id, request_id)");
  });

  test("keeps lyrics out of the usage ledger and applies private RLS", () => {
    const ledgerBlock = migration.slice(migration.indexOf("create table if not exists public.ai_usage_ledger"), migration.indexOf("create table if not exists public.ai_request_results"));
    expect(ledgerBlock).not.toMatch(/lyrics|prompt_content|section_content|response_payload/);
    expect(migration).toContain("ai_usage_ledger_owner_read");
    expect(migration).toContain("ai_studio_dna_owner_read");
    expect(migration).toContain("revoke insert, update, delete");
  });

  test("supports kill switches, prompt versions, bounded Studio DNA, and cost logging", () => {
    expect(migration).toContain("enabled boolean not null default true");
    expect(migration).toContain("ai_prompt_versions_one_active_idx");
    expect(migration).toContain("pg_column_size(traits) <= 32768");
    expect(migration).toContain("estimated_cost_micros");
  });
});
