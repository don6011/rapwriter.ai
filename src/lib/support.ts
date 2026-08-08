import { z } from "zod";

export const supportCategories = [
  ["account_login", "Account & Login"],
  ["membership_billing", "Membership & Billing"],
  ["beat_purchase_license", "Beat Purchase / License"],
  ["producer_hq", "Producer HQ"],
  ["marketplace_purchase", "Marketplace Purchase"],
  ["ai_ghostwriter", "AI / Ghostwriter"],
  ["technical_problem", "Technical Problem"],
  ["report_content_user", "Report Content/User"],
  ["other", "Other"],
] as const;

export const supportCategoryIds = supportCategories.map(([id]) => id) as [string, ...string[]];
export const supportStatuses = ["open", "in_progress", "waiting_on_customer", "resolved", "closed"] as const;
export const supportPriorities = ["low", "normal", "high", "urgent"] as const;

export const ticketCreateSchema = z.object({
  category: z.enum(supportCategoryIds),
  subject: z.string().trim().min(4).max(140),
  description: z.string().trim().min(20).max(6000),
  related_order_id: z.string().uuid().nullable().optional(),
  related_entitlement_id: z.string().uuid().nullable().optional(),
  related_beat_id: z.string().uuid().nullable().optional(),
  related_license_id: z.string().uuid().nullable().optional(),
  platform: z.string().trim().min(2).max(40).default("web"),
  app_version: z.string().trim().max(80).nullable().optional(),
});

export const ticketReplySchema = z.object({ body: z.string().trim().min(1).max(6000) });
export const supportStaffActionSchema = z.object({
  action: z.enum(["reply", "assign", "status", "priority", "internal_note"]),
  body: z.string().trim().max(6000).optional(),
  status: z.enum(supportStatuses).optional(),
  priority: z.enum(supportPriorities).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
}).superRefine((value, context) => {
  if ((value.action === "reply" || value.action === "internal_note") && !value.body) context.addIssue({ code: "custom", message: "A message is required." });
  if (value.action === "status" && !value.status) context.addIssue({ code: "custom", message: "Choose a status." });
  if (value.action === "priority" && !value.priority) context.addIssue({ code: "custom", message: "Choose a priority." });
});

export const supportFaqs = [
  { id: "reset-password", categories: ["account_login"], title: "Reset or recover your password", body: "Use Forgot Password on sign in. The recovery link must be opened in the same browser where you want to continue." },
  { id: "membership-access", categories: ["membership_billing"], title: "Membership access after purchase", body: "Open Profile and refresh Your Memberships. Access follows the signed-in RapWriter account used at checkout." },
  { id: "beat-license", categories: ["beat_purchase_license", "marketplace_purchase"], title: "Find a purchased beat license", body: "Open Locker, choose the beat, then open its license record. Completed purchases remain attached to your account." },
  { id: "producer-review", categories: ["producer_hq"], title: "Producer review and payouts", body: "Producer profiles and beats can be submitted while payout verification is pending. Licensing opens after approval and payout activation." },
  { id: "ghostwriter-help", categories: ["ai_ghostwriter"], title: "Ghostwriter is not responding", body: "Keep your draft open, check your membership access, and retry once. Your lyrics remain saved independently from the suggestion request." },
  { id: "technical-refresh", categories: ["technical_problem"], title: "Refresh without losing your lyrics", body: "Wait for Saved, then refresh. RapWriter restores the latest persisted session and last edited section." },
] as const;

export function supportCategoryLabel(id: string) {
  return supportCategories.find(([value]) => value === id)?.[1] ?? "Other";
}

export function ticketAllowsCustomerReply(status: string) {
  return ["open", "in_progress", "waiting_on_customer"].includes(status);
}
