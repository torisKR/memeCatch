import { getFairyConfig } from "@/lib/billing/fairy.server";
import { createFairyWebhookHandler } from "@/lib/billing/fairy-handlers";
import { processFairyPayment } from "@/lib/billing/fairy-repository.server";

export const runtime = "nodejs";
export const maxDuration = 5;

export async function POST(request: Request) {
  return createFairyWebhookHandler({ config: getFairyConfig(), processPayment: processFairyPayment })(request);
}
