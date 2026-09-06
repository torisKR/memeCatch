import { isLocale } from "@/lib/i18n";
import { localizedStaticPath } from "@/lib/i18n-routing";
import { readBoundedText, RequestBodyTooLargeError } from "@/lib/request-body";
import {
  fairyDonationUrl, parseFairyPayment, verifyFairySignature,
  type FairyConfig, type FairyPayment,
} from "@/lib/billing/fairy.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function createFairyWebhookHandler({ config, processPayment, now = Date.now }: {
  config: FairyConfig | null;
  processPayment: (payment: FairyPayment) => Promise<unknown>;
  now?: () => number;
}) {
  return async (request: Request): Promise<Response> => {
    if (!config) return json({ ok: false, error: "fairy_not_configured" }, 503);
    let rawBody: string;
    try {
      rawBody = await readBoundedText(request, 16 * 1024);
    } catch (error) {
      return json({ ok: false, error: error instanceof RequestBodyTooLargeError ? "payload_too_large" : "invalid_payload" },
        error instanceof RequestBodyTooLargeError ? 413 : 400);
    }
    if (!verifyFairySignature(rawBody, request.headers.get("x-fairy-signature") ?? "", config.secret)) {
      return json({ ok: false, error: "invalid_signature" }, 401);
    }
    const parsed = parseFairyPayment(rawBody);
    if (!parsed?.success) return json({ ok: false, error: "invalid_payload" }, 400);
    const { data, timestamp } = parsed.data;
    if (data.projectName !== config.projectSlug) return json({ ok: false, error: "unexpected_project" }, 403);
    if (Date.parse(timestamp) > now() + 5 * 60_000) return json({ ok: false, error: "invalid_timestamp" }, 400);
    if (data.source === "test") return json({ ok: true, ignored: "test_event" });
    if (!data.payload?.memecatchIntent) return json({ ok: true, ignored: "donation_without_plus_intent" });
    try {
      await processPayment({
        paymentId: data.paymentId, projectSlug: data.projectName,
        intentId: data.payload.memecatchIntent, amount: data.amount, occurredAt: timestamp,
      });
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: "payment_processing_failed" }, 503);
    }
  };
}

export function createFairyCheckoutHandler({ config, getUser, createIntent }: {
  config: FairyConfig | null;
  getUser: () => Promise<{ id: string } | null>;
  createIntent: (userId: string, config: FairyConfig) => Promise<string>;
}) {
  return async (request: Request): Promise<Response> => {
    if (!config) return json({ ok: false, error: "fairy_not_configured" }, 503);
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return json({ ok: false, error: "invalid_origin" }, 403);
    }
    let fields: URLSearchParams;
    try {
      fields = new URLSearchParams(await readBoundedText(request, 1024));
    } catch {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
    const locale = fields.get("locale");
    const pricingPath = locale && isLocale(locale) ? localizedStaticPath("/pricing", locale) : "/pricing";
    try {
      const user = await getUser();
      if (!user) {
        const login = new URL("/login", request.url);
        login.searchParams.set("next", pricingPath);
        return Response.redirect(login, 303);
      }
      const intentId = await createIntent(user.id, config);
      return Response.redirect(fairyDonationUrl(config.projectSlug, intentId), 303);
    } catch {
      return json({ ok: false, error: "fairy_checkout_failed" }, 503);
    }
  };
}
