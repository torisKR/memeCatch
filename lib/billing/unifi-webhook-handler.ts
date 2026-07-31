import {
  isExpectedUnifiPayment,
  mapUnifiStatus,
  parseUnifiWebhookBody,
  unifiEventKey,
  type MembershipStatus,
  type UnifiConfig,
  type UnifiPaymentInfo,
} from "@/lib/billing/unifi.server";

/**
 * Unifi 결제 정산 코어.
 *
 * 웹훅 본문에는 서명이 없다 → 본문의 status는 "확인해 보라"는 신호일 뿐이고,
 * 권한 부여 근거는 오직 payment/info 재조회 결과다. 웹훅 유실에 대비해
 * 클라이언트 startPayment 완료 후 호출하는 verify 경로도 같은 코어를 쓴다.
 */

export type SettlementDeps = {
  config: UnifiConfig;
  getInfo: (config: UnifiConfig, paymentId: string) => Promise<UnifiPaymentInfo | null>;
  finalize: (config: UnifiConfig, paymentId: string) => Promise<void>;
  processEvent: (event: UnifiSettlementEvent) => Promise<unknown>;
};

export type UnifiSettlementEvent = {
  eventKey: string;
  paymentId: string;
  status: MembershipStatus;
  amount: number | null;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type SettlementResult =
  | { kind: "settled"; status: MembershipStatus }
  | { kind: "pending"; providerStatus: string }
  | { kind: "unknown_payment" }
  | { kind: "rejected"; reason: string };

export async function settleUnifiPayment(
  paymentId: string,
  deps: SettlementDeps,
  now: () => number = Date.now,
): Promise<SettlementResult> {
  const info = await deps.getInfo(deps.config, paymentId);
  if (!info) return { kind: "unknown_payment" };

  // 우리가 판 상품·금액·모드가 아니면 어떤 경우에도 권한을 만들지 않는다.
  if (!isExpectedUnifiPayment(info, deps.config)) {
    return { kind: "rejected", reason: "unexpected_payment" };
  }

  const status = mapUnifiStatus(info.status);
  if (!status) return { kind: "pending", providerStatus: info.status };

  // 승인 시각은 제공자 값을 우선하되, 미래 시각·누락은 수신 시각으로 보정한다.
  const nowMs = now();
  const capturedAt =
    info.capturedAt !== null && Number.isFinite(info.capturedAt) && info.capturedAt <= nowMs
      ? info.capturedAt
      : nowMs;

  await deps.processEvent({
    eventKey: unifiEventKey(paymentId, info.status),
    paymentId,
    status,
    amount: info.price === null ? null : Number(info.price),
    occurredAt: new Date(capturedAt).toISOString(),
    payload: {
      provider: "unifi",
      paymentId,
      providerStatus: info.status,
      pgType: info.pgType,
      price: info.price,
      currencyCode: info.currencyCode,
      testMode: info.testMode,
    },
  });

  // 정산 대상으로 넘기려면 finalize가 필요하다(STRIPE는 미호출 시 정산 불가).
  if (info.status === "CONFIRMED") {
    try {
      await deps.finalize(deps.config, paymentId);
    } catch {
      // 권한은 이미 부여됐다. finalize는 CRYPTO의 경우 5분 후 자동 처리되고,
      // STRIPE는 다음 상태 변경 웹훅에서 다시 시도된다.
    }
  }

  return { kind: "settled", status };
}

const MAX_BODY_BYTES = 16 * 1024;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function createUnifiWebhookHandler(deps: SettlementDeps | null) {
  return async function handleUnifiWebhook(request: Request): Promise<Response> {
    if (!deps) return json({ ok: false, error: "webhook_not_configured" }, 503);

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: "payload_too_large" }, 413);
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: "payload_too_large" }, 413);
    }

    const body = parseUnifiWebhookBody(rawBody);
    if (!body) return json({ ok: false, error: "invalid_payload" }, 400);

    try {
      const result = await settleUnifiPayment(body.paymentId, deps);
      switch (result.kind) {
        case "settled":
          return json({ ok: true, status: result.status }, 200);
        case "pending":
          // 결과가 아직 아니다. 재시도는 무의미하므로 200으로 수신만 확인한다.
          return json({ ok: true, ignored: true }, 200);
        default:
          // 우리 결제가 아니다. 재시도해도 달라지지 않는다.
          return json({ ok: true, ignored: true }, 200);
      }
    } catch {
      // 일시적 장애 — Unifi가 1·2·4·8초 간격으로 최대 5회 재시도한다.
      return json({ ok: false, error: "settlement_failed" }, 500);
    }
  };
}
