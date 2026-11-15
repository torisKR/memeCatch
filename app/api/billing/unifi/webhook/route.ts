import {
  hasUnifiPaymentLink,
  processUnifiPaymentEvent,
} from "@/lib/billing/repository.server";
import {
  getUnifiPayConfig,
  getUnifiPayTransaction,
  isExpectedUnifiPayTransaction,
  parseLinkIdFromOrderId,
  parseUnifiPayWebhookBody,
} from "@/lib/billing/unifi-pay.server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TRANSACTION_ID_LENGTH = 256;
const MAX_ORDER_ID_LENGTH = 512;
const MAX_LINK_ID_LENGTH = 200;
const WEBHOOK_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Unifi Pay 결제 결과 웹훅.
 *
 * 본문에는 서명이 없다(문서 2.4). 따라서 본문의 status는 "확인해 보라"는
 * 신호로만 쓰고, HMAC 인증이 걸린 결제 상태 확인 API(2.3)의 결과만으로
 * 권한을 만든다. 위조된 CONFIRMED 요청으로는 Plus를 얻을 수 없다.
 *
 * 수신 후 반드시 200을 반환해야 한다. 5xx·무응답이면 3초·30초·10분·1시간·
 * 3시간 간격으로 재전송된다.
 */
export async function POST(request: Request) {
  const config = getUnifiPayConfig();
  if (!config) return json({ ok: false, error: "webhook_not_configured" }, 503);

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  const body = parseUnifiPayWebhookBody(rawBody);
  if (!body) return json({ ok: false, error: "invalid_payload" }, 400);
  if (
    body.transactionId.length > MAX_TRANSACTION_ID_LENGTH ||
    body.orderId.length > MAX_ORDER_ID_LENGTH
  ) {
    return json({ ok: false, error: "invalid_identifier" }, 400);
  }

  // body의 orderId는 어떤 거래를 확인할지 고르는 라우팅 힌트일 뿐이다.
  const bodyLinkId = parseLinkIdFromOrderId(body.orderId);
  if (!bodyLinkId) return json({ ok: true, ignored: true }, 200);
  if (bodyLinkId.length > MAX_LINK_ID_LENGTH) {
    return json({ ok: false, error: "invalid_identifier" }, 400);
  }

  try {
    if (!(await hasUnifiPaymentLink(bodyLinkId))) {
      return json({ ok: true, ignored: true, reason: "unknown_payment_link" }, 200);
    }
    const limit = rateLimit(`unifi-webhook:${bodyLinkId}`, WEBHOOK_RATE_LIMIT);
    if (!limit.ok) {
      return Response.json(
        { ok: false, error: "settlement_throttled" },
        {
          status: 503,
          headers: { "cache-control": "no-store", "retry-after": String(limit.retryAfterSec) },
        },
      );
    }
    const tx = await getUnifiPayTransaction(config, body.transactionId);
    // 우리 거래가 아니거나 금액·통화·상점이 다르면 권한을 만들지 않는다.
    if (!tx || !isExpectedUnifiPayTransaction(tx, config)) {
      return json({ ok: true, ignored: true }, 200);
    }

    // 귀속(누구에게 권한을 줄지)은 **HMAC 인증된 조회 결과의 orderId**로만 정한다.
    // 본문 orderId를 그대로 믿으면, 실결제 1건의 transactionId를 아는 공격자가
    // 자기 계정의 linkId를 body에 실어 보내 권한을 가로챌 수 있다(귀속 탈취).
    // 조회 결과에 orderId가 없거나 본문과 어긋나면 권한을 만들지 않는다.
    const linkId = parseLinkIdFromOrderId(tx.orderId);
    if (!linkId || linkId !== bodyLinkId) {
      return json({ ok: true, ignored: true, reason: "order_mismatch" }, 200);
    }

    const providerStatus = tx.status.toUpperCase();
    // CREATED/PENDING — 아직 결과가 아니다. 재시도는 무의미하므로 200.
    if (
      providerStatus !== "CONFIRMED" &&
      providerStatus !== "FAILED" &&
      providerStatus !== "CANCELED"
    ) {
      return json({ ok: true, pending: tx.status }, 200);
    }
    const status = providerStatus === "CONFIRMED" ? "active" : "canceled";

    await processUnifiPaymentEvent({
      providerLinkId: linkId,
      transactionId: tx.transactionId,
      status: providerStatus,
      occurredAt: new Date().toISOString(),
      payload: {
        provider: "unifi-pay",
        transactionId: tx.transactionId,
        orderId: tx.orderId,
        linkId,
        providerStatus: tx.status,
        orderAmount: tx.orderAmount,
        orderCurrencyCode: tx.orderCurrencyCode,
        payCurrencyCode: tx.payCurrencyCode,
      },
    });

    return json({ ok: true, status }, 200);
  } catch {
    // 일시적 장애 — 5xx를 주면 Unifi가 재전송한다.
    return json({ ok: false, error: "settlement_failed" }, 500);
  }
}
