import { createLatpeedCheckoutHandler } from "@/lib/billing/latpeed-checkout-handler";
import {
  getCurrentBillingUser,
  registerCurrentBillingIdentity,
} from "@/lib/billing/repository.server";
import { isAllowedUnifiPayLinkUrl } from "@/lib/billing/unifi.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 결제 제공자 전환 — UNIFI_PAY_LINK_URL이 설정되면 Unifi Pay 결제 링크로,
 * 아니면 기존 Latpeed 링크로 보낸다. 두 방식 모두 호스팅 결제창으로의
 * 리다이렉트라 흐름은 같고, 링크 호스트 검증만 제공자에 맞게 바꾼다.
 */
const UNIFI_PAY_LINK_URL = process.env.UNIFI_PAY_LINK_URL?.trim() ?? "";
const USE_UNIFI_PAY = UNIFI_PAY_LINK_URL !== "";

const handleCheckout = createLatpeedCheckoutHandler({
  getUser: getCurrentBillingUser,
  registerIdentity: registerCurrentBillingIdentity,
  getCheckoutUrl: () =>
    USE_UNIFI_PAY ? UNIFI_PAY_LINK_URL : (process.env.LATPEED_MEMBERSHIP_URL ?? ""),
  isAllowedUrl: USE_UNIFI_PAY ? isAllowedUnifiPayLinkUrl : undefined,
});

export async function POST(request: Request) {
  return handleCheckout(request);
}
