import "server-only";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { selectPremiumSubscription } from "@/lib/billing/entitlements";
import type { LatpeedMembershipEvent } from "@/lib/billing/latpeed.server";
export type UnifiSettlementEvent = {
  providerLinkId: string;
  transactionId: string;
  status: "CONFIRMED" | "FAILED" | "CANCELED";
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type PremiumEntitlement = {
  signedIn: boolean;
  isPremium: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
};

export async function getCurrentBillingUser(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    if (isAuthSessionMissingError(error)) return null;
    throw error;
  }
  return user ? { id: user.id } : null;
}

export async function registerCurrentBillingIdentity(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_billing_identity");
  if (error) throw error;
}

export async function processLatpeedMembershipEvent(
  event: LatpeedMembershipEvent,
): Promise<unknown> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("process_latpeed_membership_event", {
    p_amount: event.amount,
    p_email: event.email,
    p_event_key: event.eventKey,
    p_event_type: event.eventType,
    p_occurred_at: event.occurredAt,
    p_order_id: event.orderId,
    p_payload: event.payload as Json,
    p_product_id: event.productId,
    p_status: event.status,
  });
  if (error) throw error;
  return data;
}

export async function createBillingOrder(
  requestId: string,
  growthSessionId: string | null = null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_billing_order", {
    p_request_id: requestId,
    p_growth_session_id: growthSessionId,
  });
  if (error) throw error;
}

export async function attachUnifiPaymentLink(
  requestId: string,
  providerLinkId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attach_unifi_payment_link", {
    p_provider_link_id: providerLinkId,
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function failBillingOrder(requestId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fail_billing_order", { p_request_id: requestId });
  if (error) throw error;
}

export async function hasPendingUnifiPaymentLink(providerLinkId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const { data, error } = await createAdminClient()
    .from("billing_orders")
    .select("id")
    .eq("provider_link_id", providerLinkId)
    .eq("status", "PENDING")
    .gte("created_at", cutoff)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function processUnifiPaymentEvent(
  event: UnifiSettlementEvent,
): Promise<unknown> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("process_unifi_order_event", {
    p_provider_link_id: event.providerLinkId,
    p_transaction_id: event.transactionId,
    p_status: event.status,
    p_occurred_at: event.occurredAt,
    p_payload: event.payload as Json,
  });
  if (error) throw error;
  return data;
}

/** 사용자 본인 결제 이력 — 실제 웹훅 이벤트만(미결제 intent 제외). */
export type UnifiPaymentHistoryItem = {
  orderId: string;
  status: string;
  amount: number | null;
  occurredAt: string;
};

export async function listOwnUnifiPaymentHistory(
  limit = 12,
): Promise<UnifiPaymentHistoryItem[]> {
  const user = await getCurrentBillingUser();
  if (!user) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_webhook_events")
    .select("order_id, status, amount, occurred_at, received_at")
    .eq("provider", "unifi")
    .eq("matched_user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    orderId: row.order_id ?? "",
    status: row.status ?? "",
    amount: row.amount,
    occurredAt: row.occurred_at ?? row.received_at,
  }));
}

export async function getPremiumEntitlement(): Promise<PremiumEntitlement> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError && !isAuthSessionMissingError(authError)) throw authError;
  if (!user) {
    return {
      signedIn: false,
      isPremium: false,
      status: null,
      currentPeriodEnd: null,
    };
  }

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("status, current_period_end, last_event_at")
    .eq("user_id", user.id)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .order("last_event_at", { ascending: false });
  if (error) throw error;

  const subscription = selectPremiumSubscription(data ?? []);

  return {
    signedIn: true,
    isPremium: subscription !== null,
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.current_period_end ?? null,
  };
}
