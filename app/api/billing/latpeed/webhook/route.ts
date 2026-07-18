import { createLatpeedWebhookHandler } from "@/lib/billing/latpeed-webhook-handler";
import { processLatpeedMembershipEvent } from "@/lib/billing/repository.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const handleWebhook = createLatpeedWebhookHandler({
  secret: process.env.LATPEED_WEBHOOK_SECRET ?? "",
  expectedProductId: process.env.LATPEED_MEMBERSHIP_PRODUCT_ID || undefined,
  processEvent: processLatpeedMembershipEvent,
});

export async function POST(request: Request) {
  return handleWebhook(request);
}
