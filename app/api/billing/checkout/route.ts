import { createLatpeedCheckoutHandler } from "@/lib/billing/latpeed-checkout-handler";
import {
  getCurrentBillingUser,
  registerCurrentBillingIdentity,
} from "@/lib/billing/repository.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handleCheckout = createLatpeedCheckoutHandler({
  getUser: getCurrentBillingUser,
  registerIdentity: registerCurrentBillingIdentity,
  getCheckoutUrl: () => process.env.LATPEED_MEMBERSHIP_URL ?? "",
});

export async function POST(request: Request) {
  return handleCheckout(request);
}
