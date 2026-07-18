import "server-only";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { selectPremiumSubscription } from "@/lib/billing/entitlements";
import type { LatpeedMembershipEvent } from "@/lib/billing/latpeed.server";

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
