import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { supportCategoryLabel, ticketAllowsCustomerReply, ticketCreateSchema } from "./support.ts";

const migration = readFileSync(new URL("../../supabase/migrations/20260803190000_production_support_center.sql", import.meta.url), "utf8");

describe("Support Center", () => {
  test("validates a complete customer ticket without accepting priority", () => {
    const result = ticketCreateSchema.parse({ category: "technical_problem", subject: "Beat player stops", description: "The player stops after I seek past the first verse.", priority: "urgent" });
    expect(result.category).toBe("technical_problem");
    expect("priority" in result).toBe(false);
  });

  test("allows replies only while a customer response is useful", () => {
    expect(ticketAllowsCustomerReply("waiting_on_customer")).toBe(true);
    expect(ticketAllowsCustomerReply("resolved")).toBe(false);
    expect(ticketAllowsCustomerReply("closed")).toBe(false);
  });

  test("uses stable category labels", () => {
    expect(supportCategoryLabel("beat_purchase_license")).toBe("Beat Purchase / License");
  });

  test("keeps internal notes staff-only and attachments private", () => {
    expect(migration).toContain('support_internal_notes_staff_only');
    expect(migration).toContain("values ('support-attachments', 'support-attachments', false");
    expect(migration).not.toContain("support_internal_notes_customer");
  });
});
