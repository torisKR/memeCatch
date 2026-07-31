import {
  createUnifiPayment,
  getUnifiConfig,
  UNIFI_PLAN,
} from "@/lib/billing/unifi.server";
import {
  createUnifiPaymentIntent,
  getCurrentBillingUser,
} from "@/lib/billing/repository.server";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Kaia/EVM 주소 형식. Unifi는 최대 42자만 허용한다. */
const WALLET_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Unifi 결제 생성 — 클라이언트가 walletProvider로 얻은 지갑 주소를 보내면
 * 서버가 clientSecret으로 결제를 만들고 payment_id ↔ user_id를 고정한다.
 * 클라이언트는 받은 paymentId로 SDK의 startPayment를 호출한다.
 */
export async function POST(request: Request) {
  const config = getUnifiConfig();
  if (!config) return json({ ok: false, error: "unifi_not_configured" }, 503);

  const user = await getCurrentBillingUser();
  if (!user) return json({ ok: false, error: "login_required" }, 401);

  let walletAddress = "";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const value = (body as Record<string, unknown>).walletAddress;
      walletAddress = typeof value === "string" ? value.trim() : "";
    }
  } catch {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
  if (!WALLET_ADDRESS.test(walletAddress)) {
    return json({ ok: false, error: "invalid_wallet_address" }, 400);
  }

  try {
    const paymentId = await createUnifiPayment(config, {
      buyerDappPortalAddress: walletAddress,
      // 콜백은 반드시 443 포트의 등록된 콜백 도메인이어야 한다.
      callbackUrl: `${SITE_URL}/api/billing/unifi/webhook`,
      unlockUrl: null,
    });

    // 결제창을 열기 전에 소유자를 확정한다. 여기서 실패하면 결제를 시작하지 않는다.
    await createUnifiPaymentIntent({
      paymentId,
      itemIdentifier: UNIFI_PLAN.itemIdentifier,
      amount: UNIFI_PLAN.amount,
      currency: UNIFI_PLAN.currencyCode,
      testMode: config.testMode,
    });

    return json({ ok: true, paymentId }, 200);
  } catch {
    return json({ ok: false, error: "checkout_failed" }, 502);
  }
}
