import {
  buildRequestId,
  createUnifiPaymentLink,
  getUnifiPayConfig,
} from "@/lib/billing/unifi-pay.server";
import { isLocale } from "@/lib/i18n";
import { localizedStaticPath } from "@/lib/i18n-routing";
import {
  attachUnifiPaymentLink,
  createBillingOrder,
  failBillingOrder,
  getCurrentBillingUser,
} from "@/lib/billing/repository.server";
import { growthSessionIdFromRequest } from "@/lib/growth/events.server";
import { readBoundedFormData, RequestBodyTooLargeError } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * 구독 결제 시작 — Unifi Pay 전용($10 USD).
 *
 * 고정 링크를 쓰지 않는 이유: 모든 사용자가 같은 linkId를 공유하면 웹훅이
 * 도착해도 누가 결제했는지 알 수 없다. 체크아웃마다 링크를 발급해
 * linkId ↔ user를 묶어두고, 웹훅의 orderId(LINK-{linkId}-...)로 역추적한다.
 */
async function beginCheckout(request: Request, requestedLocale: FormDataEntryValue | string | null) {
  let pricingPath = "/pricing";
  let locale: string | null = null;
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
  try {
    await createBillingOrder(requestId, growthSessionIdFromRequest(request));
    const returnPath = `${locale ? `/${locale}` : ""}/premium?checkout=return`;
    const { linkUrl, linkId } = await createUnifiPaymentLink(config, {
      requestId,
      callbackPath: "/api/billing/unifi/webhook",
      returnPath,
    });
    await attachUnifiPaymentLink(requestId, linkId);

    return Response.redirect(linkUrl, 303);
  } catch {
    try {
      await failBillingOrder(requestId);
    } catch {
      return Response.json(
        { ok: false, error: "checkout_cleanup_failed" },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      { ok: false, error: "checkout_failed" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  let requestedLocale: FormDataEntryValue | null = null;
  try {
    const formData = await readBoundedFormData(request, 4 * 1024);
    requestedLocale = formData.get("locale");
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }
  }
  return beginCheckout(request, requestedLocale);
}
