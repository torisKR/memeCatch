import {
  buildRequestId,
  createUnifiPaymentLink,
  getUnifiPayConfig,
  toMinorUnits,
} from "@/lib/billing/unifi-pay.server";
import {
  createUnifiPaymentIntent,
  getCurrentBillingUser,
} from "@/lib/billing/repository.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * 구독 결제 시작 — Unifi Pay 전용($20 USD).
 *
 * 고정 링크를 쓰지 않는 이유: 모든 사용자가 같은 linkId를 공유하면 웹훅이
 * 도착해도 누가 결제했는지 알 수 없다. 체크아웃마다 링크를 발급해
 * linkId ↔ user를 묶어두고, 웹훅의 orderId(LINK-{linkId}-...)로 역추적한다.
 */
export async function POST(request: Request) {
  const user = await getCurrentBillingUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/pricing");
    return Response.redirect(login, 303);
  }

  const config = getUnifiPayConfig();
  if (!config) {
    return Response.json(
      { ok: false, error: "checkout_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const { linkUrl, linkId } = await createUnifiPaymentLink(config, {
      requestId: buildRequestId(user.id, Date.now()),
      callbackPath: "/api/billing/unifi/webhook",
      returnPath: "/premium?checkout=return",
    });

    // 결제창으로 보내기 전에 소유자를 확정한다. 실패하면 결제를 시작하지 않는다.
    await createUnifiPaymentIntent({
      paymentId: linkId,
      itemIdentifier: config.itemName,
      amount: toMinorUnits(config.itemPrice),
      currency: config.orderCurrencyCode,
      // 운영 베이스 URL(api-pay)이 아니면 Preview(Kairos 테스트넷) 결제다.
      testMode: !config.baseUrl.includes("//api-pay."),
    });

    return Response.redirect(linkUrl, 303);
  } catch {
    return Response.json(
      { ok: false, error: "checkout_failed" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
