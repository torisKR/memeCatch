import { createLatpeedWebhookHandler } from "@/lib/billing/latpeed-webhook-handler";
import { processLatpeedMembershipEvent } from "@/lib/billing/repository.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const expectedProductId = process.env.LATPEED_MEMBERSHIP_PRODUCT_ID?.trim() ?? "";
const handleWebhook = createLatpeedWebhookHandler({
  secret: process.env.LATPEED_WEBHOOK_SECRET ?? "",
  expectedProductId,
  processEvent: processLatpeedMembershipEvent,
});

export async function POST(request: Request) {
  if (!expectedProductId) {
    return Response.json(
      { ok: false, error: "webhook_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return handleWebhook(request);
}
