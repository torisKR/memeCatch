import "server-only";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { selectPremiumSubscription } from "@/lib/billing/entitlements";
import type { LatpeedMembershipEvent } from "@/lib/billing/latpeed.server";
import type { UnifiSettlementEvent } from "@/lib/billing/unifi-webhook-handler";

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

/**
 * Unifi 결제 의도 기록 — 로그인 사용자 컨텍스트로 호출해 payment_id ↔ user_id를
 * 결제 생성 시점에 고정한다. 이후 웹훅은 이 바인딩으로만 소유자를 찾는다.
 */
export async function createUnifiPaymentIntent(input: {
  paymentId: string;
  itemIdentifier: string;
  amount: number;
  currency: string;
  testMode: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_unifi_payment_intent", {
    p_payment_id: input.paymentId,
    p_item_identifier: input.itemIdentifier,
    p_amount: input.amount,
    p_currency: input.currency,
    p_test_mode: input.testMode,
  });
  if (error) throw error;
}

export async function processUnifiPaymentEvent(
  event: UnifiSettlementEvent,
): Promise<unknown> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("process_unifi_payment_event", {
    p_event_key: event.eventKey,
    p_payment_id: event.paymentId,
    p_status: event.status,
    p_amount: event.amount,
    p_occurred_at: event.occurredAt,
    p_payload: event.payload as Json,
  });
  if (error) throw error;
  return data;
}

/** verify 경로 전용 — 이 결제가 정말 이 사용자의 것인지 확인한다. */
export async function isOwnUnifiPayment(paymentId: string): Promise<boolean> {
  const user = await getCurrentBillingUser();
  if (!user) return false;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_unifi_payments")
    .select("user_id")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id === user.id;
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
