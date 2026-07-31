import { createHash } from "node:crypto";
import { processUnifiPaymentEvent } from "@/lib/billing/repository.server";
import {
  getUnifiPayConfig,
  getUnifiPayTransaction,
  isExpectedUnifiPayTransaction,
  mapUnifiPayStatus,
  parseLinkIdFromOrderId,
  parseUnifiPayWebhookBody,
  toMinorUnits,
} from "@/lib/billing/unifi-pay.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_BODY_BYTES = 16 * 1024;

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

  // 소유자는 체크아웃 시점에 저장한 linkId 바인딩으로만 찾는다.
  const linkId = parseLinkIdFromOrderId(body.orderId);
  if (!linkId) return json({ ok: true, ignored: true }, 200);

  try {
    const tx = await getUnifiPayTransaction(config, body.transactionId);
    // 우리 거래가 아니거나 금액·통화·상점이 다르면 권한을 만들지 않는다.
    if (!tx || !isExpectedUnifiPayTransaction(tx, config)) {
      return json({ ok: true, ignored: true }, 200);
    }

    const status = mapUnifiPayStatus(tx.status);
    // CREATED/PENDING — 아직 결과가 아니다. 재시도는 무의미하므로 200.
    if (!status) return json({ ok: true, pending: tx.status }, 200);

    await processUnifiPaymentEvent({
      // 같은 거래의 같은 상태가 재전송돼도 한 번만 반영되도록 멱등 키를 만든다.
      eventKey: createHash("sha256")
        .update(`unifi-pay:${tx.transactionId}:${tx.status}`)
        .digest("hex"),
      paymentId: linkId,
      status,
      amount: tx.orderAmount === null ? null : toMinorUnits(tx.orderAmount),
      occurredAt: new Date().toISOString(),
      payload: {
        provider: "unifi-pay",
        transactionId: tx.transactionId,
        orderId: body.orderId,
        linkId,
        providerStatus: tx.status,
        orderAmount: tx.orderAmount,
        orderCurrencyCode: tx.orderCurrencyCode,
      },
    });

    return json({ ok: true, status }, 200);
  } catch {
    // 일시적 장애 — 5xx를 주면 Unifi가 재전송한다.
    return json({ ok: false, error: "settlement_failed" }, 500);
  }
}
