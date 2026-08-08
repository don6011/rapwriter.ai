import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type CommerceItemType = "product_entitlement" | "beat_license" | "producer_service";
export type CommerceOrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilled"
  | "canceled"
  | "refund_pending"
  | "refunded"
  | "disputed";

export type CommerceOffer = {
  itemType: CommerceItemType;
  catalogProductId: string;
  title: string;
  description: string;
  unitAmountCents: number;
  currency?: string;
  sellerOwnerId?: string | null;
  sellerProfileId?: string | null;
  beatId?: string | null;
  licenseName?: string | null;
  licenseTerms?: Record<string, unknown>;
  productSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CommerceOrder = {
  id: string;
  order_number: string;
  buyer_id: string | null;
  seller_owner_id: string | null;
  seller_profile_id: string | null;
  status: CommerceOrderStatus;
  provider: "stripe" | "manual";
  provider_checkout_id: string | null;
  provider_payment_id: string | null;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  platform_fee_cents: number;
  seller_earnings_cents: number;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  refunded_at: string | null;
};

export function checkoutIdempotencyKey(userId: string, itemIdentity: string, suppliedKey?: string | null) {
  const clean = suppliedKey?.trim();
  if (clean && /^[a-zA-Z0-9:_-]{8,120}$/.test(clean)) return clean;
  const minute = Math.floor(Date.now() / 60_000);
  return createHash("sha256").update(`${userId}:${itemIdentity}:${minute}`).digest("hex");
}

export async function createPendingOrder(buyerId: string, idempotencyKey: string, offer: CommerceOffer) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_commerce_order", {
    p_buyer_id: buyerId,
    p_idempotency_key: idempotencyKey,
    p_item_type: offer.itemType,
    p_catalog_product_id: offer.catalogProductId,
    p_title: offer.title,
    p_description: offer.description,
    p_unit_amount_cents: offer.unitAmountCents,
    p_currency: offer.currency ?? "usd",
    p_seller_owner_id: offer.sellerOwnerId ?? null,
    p_seller_profile_id: offer.sellerProfileId ?? null,
    p_beat_id: offer.beatId ?? null,
    p_license_name: offer.licenseName ?? null,
    p_license_terms: offer.licenseTerms ?? {},
    p_product_snapshot: offer.productSnapshot,
    p_metadata: offer.metadata ?? {},
  });
  if (error) throw new Error(error.message);
  return rpcRow<CommerceOrder>(data);
}

export async function attachProviderCheckout(orderId: string, checkoutId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("commerce_orders")
    .update({ provider_checkout_id: checkoutId })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CommerceOrder;
}

export async function fulfillCommerceOrder(input: {
  orderId: string;
  providerCheckoutId: string;
  providerPaymentId: string;
  amountCents: number;
  currency: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fulfill_commerce_order", {
    p_order_id: input.orderId,
    p_provider_checkout_id: input.providerCheckoutId,
    p_provider_payment_id: input.providerPaymentId,
    p_amount_cents: input.amountCents,
    p_currency: input.currency,
  });
  if (error) throw new Error(error.message);
  return rpcRow<CommerceOrder>(data);
}

export async function transitionCommerceOrder(input: {
  orderId: string;
  status: CommerceOrderStatus;
  reason: string;
  actorId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("transition_commerce_order", {
    p_order_id: input.orderId,
    p_new_status: input.status,
    p_reason: input.reason,
    p_actor_id: input.actorId ?? null,
    p_details: input.details ?? {},
  });
  if (error) throw new Error(error.message);
  return rpcRow<CommerceOrder>(data);
}

export async function buyerOwnsCatalogProduct(buyerId: string, productId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("product_entitlements")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", buyerId)
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export function manualCommerceIdempotencyKey() {
  return randomUUID();
}

function rpcRow<T>(value: unknown): T {
  if (Array.isArray(value)) {
    if (!value[0]) throw new Error("Commerce operation returned no order.");
    return value[0] as T;
  }
  if (!value || typeof value !== "object") throw new Error("Commerce operation returned no order.");
  return value as T;
}
