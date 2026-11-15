import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 웹훅 라우트의 보안 계약 검증 — 특히 귀속 탈취(attribution hijack) 차단.
 *
 * 계약: 권한 귀속(linkId)은 HMAC 인증된 조회 결과 tx.orderId에서만 파생한다.
 * 무서명 body의 orderId는 라우팅 힌트일 뿐이며, 둘이 어긋나면 권한을 만들지 않는다.
 */

const processUnifiPaymentEvent = vi.fn().mockResolvedValue({ matched: true });
const getUnifiPayTransaction = vi.fn();
const hasUnifiPaymentLink = vi.fn();
const rateLimit = vi.fn();

// unifi-pay.server가 "server-only"를 import한다 — 테스트 환경에선 no-op으로 대체.
vi.mock("server-only", () => ({}));

vi.mock("@/lib/billing/repository.server", () => ({
  hasUnifiPaymentLink: (...args: unknown[]) => hasUnifiPaymentLink(...args),
  processUnifiPaymentEvent: (...args: unknown[]) => processUnifiPaymentEvent(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}));

vi.mock("@/lib/billing/unifi-pay.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/unifi-pay.server")>();
  return {
    ...actual,
    getUnifiPayConfig: () => ({
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://pay.example.com",
      storeId: "store-1",
      serviceName: "MemeCatch",
      itemName: "MemeCatch Plus (30 days)",
      itemPrice: 10,
      orderCurrencyCode: "USD",
      callbackBaseUrl: "https://catchmeme.com",
      returnBaseUrl: "https://catchmeme.com",
    }),
    getUnifiPayTransaction: (...args: unknown[]) => getUnifiPayTransaction(...args),
  };
});

import { POST } from "./route";

function webhookRequest(body: Record<string, unknown>) {
  return new Request("https://catchmeme.com/api/billing/unifi/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const CONFIRMED_TX = {
  transactionId: "tx_1",
  orderId: "LINK-goodlink-abc",
  storeId: "store-1",
  status: "CONFIRMED",
  orderAmount: 10,
  orderCurrencyCode: "USD",
  payCurrencyCode: "USDT",
};

beforeEach(() => {
  processUnifiPaymentEvent.mockClear();
  getUnifiPayTransaction.mockReset();
  hasUnifiPaymentLink.mockReset();
  hasUnifiPaymentLink.mockResolvedValue(true);
  rateLimit.mockReset();
  rateLimit.mockReturnValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("unifi webhook attribution", () => {
  it("bounds repeated one-link abuse before calling the provider and requests a retry", async () => {
    rateLimit.mockReturnValue({ ok: false, retryAfterSec: 60 });

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(hasUnifiPaymentLink).toHaveBeenCalledWith("goodlink");
    expect(rateLimit).toHaveBeenCalledWith("unifi-webhook:goodlink", {
      limit: 30,
      windowMs: 60_000,
    });
    expect(getUnifiPayTransaction).not.toHaveBeenCalled();
  });

  it("does not share a global throttle across distinct known payment links", async () => {
    getUnifiPayTransaction.mockImplementation(
      (_config: unknown, transactionId: string) => Promise.resolve({
        ...CONFIRMED_TX,
        transactionId,
        orderId: `LINK-${transactionId}-provider`,
      }),
    );

    for (let index = 0; index < 31; index += 1) {
      const linkId = `tx_${index}`;
      const res = await POST(
        webhookRequest({
          transactionId: linkId,
          orderId: `LINK-${linkId}-body`,
          status: "CONFIRMED",
        }),
      );
      expect(res.status).toBe(200);
    }

    expect(getUnifiPayTransaction).toHaveBeenCalledTimes(31);
    expect(new Set(rateLimit.mock.calls.map(([key]) => key))).toHaveProperty("size", 31);
  });

  it("rejects oversized identifiers before local or provider lookup", async () => {
    const res = await POST(
      webhookRequest({
        transactionId: "t".repeat(257),
        orderId: "LINK-goodlink-abc",
        status: "CONFIRMED",
      }),
    );

    expect(res.status).toBe(400);
    expect(hasUnifiPaymentLink).not.toHaveBeenCalled();
    expect(getUnifiPayTransaction).not.toHaveBeenCalled();
  });

  it("ignores unknown payment links without calling the provider", async () => {
    hasUnifiPaymentLink.mockResolvedValue(false);

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-unknown-abc", status: "CONFIRMED" }),
    );

    expect(await res.json()).toMatchObject({ ignored: true, reason: "unknown_payment_link" });
    expect(getUnifiPayTransaction).not.toHaveBeenCalled();
  });

  it("신규 checkout이 꺼져도 기존 결제 웹훅은 계속 정산한다", async () => {
    vi.stubEnv("UNIFI_PAY_CHECKOUT_ENABLED", "false");
    getUnifiPayTransaction.mockResolvedValue(CONFIRMED_TX);

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "active" });
    expect(processUnifiPaymentEvent).toHaveBeenCalledTimes(1);
  });

  it("정상 결제는 인증 조회의 orderId에서 파생한 linkId로 권한을 만든다", async () => {
    getUnifiPayTransaction.mockResolvedValue(CONFIRMED_TX);

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "active" });
    expect(processUnifiPaymentEvent).toHaveBeenCalledTimes(1);
    expect(processUnifiPaymentEvent.mock.calls[0][0]).toMatchObject({
      providerLinkId: "goodlink",
      transactionId: "tx_1",
      status: "CONFIRMED",
    });
  });

  it("acknowledges a verified redelivery when the settlement RPC reports a duplicate", async () => {
    getUnifiPayTransaction.mockResolvedValue(CONFIRMED_TX);
    processUnifiPaymentEvent.mockResolvedValueOnce({ duplicate: true, matched: true });
    const res = await POST(webhookRequest({
      transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED",
    }));
    expect(res.status).toBe(200);
    expect(processUnifiPaymentEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      providerLinkId: "goodlink", transactionId: "tx_1", status: "CONFIRMED",
    }));
  });

  it("귀속 탈취를 차단한다 — body linkId가 인증 조회의 orderId와 다르면 무시", async () => {
    // 공격: 실결제 tx_1(정당한 링크 goodlink)의 transactionId를 알아낸 뒤,
    // 자기 계정의 linkId(evillink)를 body orderId에 실어 보낸다.
    getUnifiPayTransaction.mockResolvedValue(CONFIRMED_TX);

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-evillink-zzz", status: "CONFIRMED" }),
    );

    expect(res.status).toBe(200); // 재전송 폭주를 막기 위한 200 계약 유지
    expect(await res.json()).toMatchObject({ ignored: true, reason: "order_mismatch" });
    expect(processUnifiPaymentEvent).not.toHaveBeenCalled();
  });

  it("인증 조회 결과의 orderId가 비어 있으면 권한을 만들지 않는다", async () => {
    getUnifiPayTransaction.mockResolvedValue({ ...CONFIRMED_TX, orderId: "" });

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(await res.json()).toMatchObject({ ignored: true });
    expect(processUnifiPaymentEvent).not.toHaveBeenCalled();
  });

  it("금액이 다른 거래는 권한을 만들지 않는다 (기존 계약 회귀 가드)", async () => {
    getUnifiPayTransaction.mockResolvedValue({ ...CONFIRMED_TX, orderAmount: 1 });

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(await res.json()).toMatchObject({ ignored: true });
    expect(processUnifiPaymentEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["store", { storeId: "" }],
    ["currency", { orderCurrencyCode: "" }],
    ["amount", { orderAmount: null }],
  ])("필수 결제 필드가 비어 있으면 권한을 만들지 않는다 — %s", async (_field, patch) => {
    getUnifiPayTransaction.mockResolvedValue({ ...CONFIRMED_TX, ...patch });

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: true });
    expect(processUnifiPaymentEvent).not.toHaveBeenCalled();
  });

  it("provider status lookup failures are retryable 5xx responses", async () => {
    getUnifiPayTransaction.mockRejectedValue(new Error("unifi_pay_status_invalid_response"));

    const res = await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "settlement_failed" });
    expect(processUnifiPaymentEvent).not.toHaveBeenCalled();
  });

  it("검증된 transactionId와 linkId를 원자적 DB 정산에 넘긴다", async () => {
    getUnifiPayTransaction.mockResolvedValue(CONFIRMED_TX);

    await POST(
      webhookRequest({ transactionId: "tx_1", orderId: "LINK-goodlink-abc", status: "CONFIRMED" }),
    );

    expect(processUnifiPaymentEvent.mock.calls[0][0]).toMatchObject({
      providerLinkId: "goodlink",
      transactionId: "tx_1",
    });
  });

  it("감사 payload에는 무서명 body가 아니라 provider orderId를 저장한다", async () => {
    getUnifiPayTransaction.mockResolvedValue(CONFIRMED_TX);

    await POST(
      webhookRequest({
        transactionId: "tx_1",
        orderId: "LINK-goodlink-untrusted",
        status: "CONFIRMED",
      }),
    );

    expect(processUnifiPaymentEvent.mock.calls[0][0]).toMatchObject({
      payload: { orderId: "LINK-goodlink-abc" },
    });
  });
});
