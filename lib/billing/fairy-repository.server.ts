import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FairyConfig, FairyPayment } from "@/lib/billing/fairy.server";

export async function createFairyIntent(userId: string, config: FairyConfig): Promise<string> {
  const { data, error } = await createAdminClient().rpc("create_fairy_billing_intent", {
    p_user_id: userId, p_project_slug: config.projectSlug, p_min_amount: config.minimumAmount,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("missing_fairy_intent");
  return data;
}

export async function processFairyPayment(payment: FairyPayment): Promise<unknown> {
  const { data, error } = await createAdminClient().rpc("process_fairy_payment", {
    p_payment_id: payment.paymentId, p_project_slug: payment.projectSlug,
    p_intent_id: payment.intentId, p_amount: payment.amount, p_occurred_at: payment.occurredAt,
  });
  if (error) throw error;
  return data;
}
