import {
  buildRequestId,
  createUnifiPaymentLink,
  getUnifiPayConfig,
} from "@/lib/billing/unifi-pay.server";
import { isLocale, type Locale } from "@/lib/i18n";
import { localizedStaticPath } from "@/lib/i18n-routing";
import {
  attachUnifiPaymentLink,
  createBillingOrder,
  failBillingOrder,
  getCurrentBillingUser,
} from "@/lib/billing/repository.server";
import { growthSessionIdFromRequest } from "@/lib/growth/events.server";
import { hasTrustedOrigin } from "@/lib/origin";
import { releaseShaFromEnv } from "@/lib/release-sha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

function isCheckoutEnabled() {
  return process.env.UNIFI_PAY_CHECKOUT_ENABLED?.trim() === "true";
}

type CheckoutStage = "create_order" | "create_link" | "attach_link";
type CheckoutFailureCode =
  | "order_create_failed"
  | "provider_link_failed"
  | "provider_http_error"
  | "provider_invalid_response"
  | "provider_missing_fields"
  | "provider_timeout"
  | "link_attach_failed";

function checkoutFailureCode(error: unknown, stage: CheckoutStage): CheckoutFailureCode {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "provider_timeout";
    if (/^unifi_pay_link_failed_\d{3}$/.test(error.message)) return "provider_http_error";
    if (error.message === "unifi_pay_link_invalid_response") return "provider_invalid_response";
    if (error.message === "unifi_pay_link_missing_fields") return "provider_missing_fields";
  }
  if (stage === "create_order") return "order_create_failed";
  if (stage === "attach_link") return "link_attach_failed";
  return "provider_link_failed";
}

/**
 * 구독 결제 시작 — Unifi Pay 전용($10 USD).
 *
 * 고정 링크를 쓰지 않는 이유: 모든 사용자가 같은 linkId를 공유하면 웹훅이
 * 도착해도 누가 결제했는지 알 수 없다. 체크아웃마다 링크를 발급해
 * linkId ↔ user를 묶어두고, 웹훅의 orderId(LINK-{linkId}-...)로 역추적한다.
 */
async function beginCheckout(request: Request, requestedLocale: FormDataEntryValue | string | null) {
  if (!isCheckoutEnabled()) {
    return Response.json(
      { ok: false, error: "checkout_disabled" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let pricingPath = "/pricing";
  let locale: Locale = "ko";
  if (typeof requestedLocale === "string" && isLocale(requestedLocale)) {
    locale = requestedLocale;
    pricingPath = localizedStaticPath("/pricing", requestedLocale);
  }

  const user = await getCurrentBillingUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pricingPath);
    return Response.redirect(login, 303);
  }

  const config = getUnifiPayConfig();
  if (!config) {
    return Response.json(
      { ok: false, error: "checkout_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const requestId = buildRequestId(user.id, Date.now());
  let stage: CheckoutStage = "create_order";
  try {
    await createBillingOrder(user.id, requestId, growthSessionIdFromRequest(request));
    stage = "create_link";
    const returnPath = `${localizedStaticPath("/premium", locale)}?checkout=return`;
    const { linkUrl, linkId } = await createUnifiPaymentLink(config, {
      requestId,
      callbackPath: "/api/billing/unifi/webhook",
      returnPath,
    });
    stage = "attach_link";
    await attachUnifiPaymentLink(user.id, requestId, linkId);

    return Response.redirect(linkUrl, 303);
  } catch (error) {
    await failBillingOrder(user.id, requestId).catch(() => undefined);
    console.error({
      code: checkoutFailureCode(error, stage),
      requestId,
      releaseSha: releaseShaFromEnv() || "unknown",
    });
    return Response.json(
      { ok: false, error: "checkout_failed" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return Response.json(
      { ok: false, error: "invalid_origin" },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  let requestedLocale: FormDataEntryValue | null = null;
  try {
    const formData = await request.formData();
    requestedLocale = formData.get("locale");
  } catch {
  }
  return beginCheckout(request, requestedLocale);
}
