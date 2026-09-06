import { getFairyConfig } from "@/lib/billing/fairy.server";
import { createFairyCheckoutHandler } from "@/lib/billing/fairy-handlers";
import { createFairyIntent } from "@/lib/billing/fairy-repository.server";
import { getCurrentBillingUser } from "@/lib/billing/repository.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return createFairyCheckoutHandler({
    config: getFairyConfig(), getUser: getCurrentBillingUser, createIntent: createFairyIntent,
  })(request);
}
