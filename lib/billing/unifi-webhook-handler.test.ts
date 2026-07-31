import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createUnifiWebhookHandler,
  settleUnifiPayment,
  type SettlementDeps,
} from "@/lib/billing/unifi-webhook-handler";
import {
  mapUnifiStatus,
  parseUnifiWebhookBody,
  UNIFI_PLAN,
  type UnifiConfig,
  type UnifiPaymentInfo,
} from "@/lib/billing/unifi.server";

const CONFIG: UnifiConfig = {
  clientId: "cid",
  clientSecret: "secret",
  baseUrl: "https://payment.example",
  testMode: false,
};

function info(overrides: Partial<UnifiPaymentInfo> = {}): UnifiPaymentInfo {
  return {
    id: "pay_test_1",
    status: "CONFIRMED",
    pgType: "STRIPE",
    price: String(UNIFI_PLAN.amount),
    currencyCode: UNIFI_PLAN.currencyCode,
    capturedAt: Date.parse("2026-07-31T00:00:00.000Z"),
    testMode: false,
    items: [{ itemIdentifier: UNIFI_PLAN.itemIdentifier }],
    ...overrides,
  };
}

function deps(overrides: Partial<SettlementDeps> = {}): SettlementDeps {
  return {
    config: CONFIG,
    getInfo: vi.fn(async () => info()),
    finalize: vi.fn(async () => {}),
    processEvent: vi.fn(async () => ({})),
    ...overrides,
  };
}

describe("mapUnifiStatus", () => {
  it("grants access only for confirmed and finalized payments", () => {
    expect(mapUnifiStatus("CONFIRMED")).toBe("active");
    expect(mapUnifiStatus("FINALIZED")).toBe("active");
  });

  it("revokes access for canceled, refunded, and chargeback payments", () => {
    for (const status of ["CANCELED", "REFUNDED", "CHARGEBACK", "CONFIRM_FAILED"]) {
      expect(mapUnifiStatus(status)).toBe("canceled");
    }
  });

  it("returns null while the payment is still in progress", () => {
    for (const status of ["CREATED", "STARTED", "REGISTERED_ON_PG", "CAPTURED"]) {
      expect(mapUnifiStatus(status)).toBeNull();
    }
  });
});

describe("parseUnifiWebhookBody", () => {
  it("returns null when the body is not a payment status event", () => {
    expect(parseUnifiWebhookBody("not json")).toBeNull();
    expect(parseUnifiWebhookBody("[]")).toBeNull();
    expect(parseUnifiWebhookBody('{"paymentId":"a"}')).toBeNull();
    expect(parseUnifiWebhookBody('{"status":"CONFIRMED"}')).toBeNull();
  });

  it("extracts the payment id and status", () => {
    expect(parseUnifiWebhookBody('{"paymentId":" p1 ","status":"CONFIRMED"}')).toEqual({
      paymentId: "p1",
      status: "CONFIRMED",
    });
  });
});

describe("settleUnifiPayment", () => {
  it("ignores the unsigned webhook status and trusts the payment info API", async () => {
    // 위조된 CONFIRMED 웹훅이 와도 조회 결과가 진행 중이면 권한을 만들지 않는다.
    const d = deps({ getInfo: vi.fn(async () => info({ status: "STARTED" })) });

    const result = await settleUnifiPayment("pay_test_1", d);

    expect(result).toEqual({ kind: "pending", providerStatus: "STARTED" });
    expect(d.processEvent).not.toHaveBeenCalled();
  });

  it("rejects a payment whose price does not match the plan", async () => {
    const d = deps({ getInfo: vi.fn(async () => info({ price: "100" })) });

    const result = await settleUnifiPayment("pay_test_1", d);

    expect(result).toEqual({ kind: "rejected", reason: "unexpected_payment" });
    expect(d.processEvent).not.toHaveBeenCalled();
  });

  it("rejects a test-mode payment while running in production mode", async () => {
    const d = deps({ getInfo: vi.fn(async () => info({ testMode: true })) });

    const result = await settleUnifiPayment("pay_test_1", d);

    expect(result).toEqual({ kind: "rejected", reason: "unexpected_payment" });
  });

  it("rejects a payment for a different item", async () => {
    const d = deps({
      getInfo: vi.fn(async () => info({ items: [{ itemIdentifier: "other-product" }] })),
    });

    const result = await settleUnifiPayment("pay_test_1", d);

    expect(result).toEqual({ kind: "rejected", reason: "unexpected_payment" });
  });

  it("records an active membership and finalizes a confirmed payment", async () => {
    const d = deps();

    const result = await settleUnifiPayment("pay_test_1", d);

    expect(result).toEqual({ kind: "settled", status: "active" });
    expect(d.finalize).toHaveBeenCalledWith(CONFIG, "pay_test_1");
    expect(d.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay_test_1",
        status: "active",
        amount: UNIFI_PLAN.amount,
        occurredAt: "2026-07-31T00:00:00.000Z",
      }),
    );
  });

  it("falls back to the receive time when the provider reports a future capture", async () => {
    const now = Date.parse("2026-07-31T00:00:00.000Z");
    const d = deps({
      getInfo: vi.fn(async () => info({ capturedAt: now + 60 * 60 * 1000 })),
    });

    await settleUnifiPayment("pay_test_1", d, () => now);

    expect(d.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: "2026-07-31T00:00:00.000Z" }),
    );
  });

  it("keeps the membership when finalize fails", async () => {
    const d = deps({
      finalize: vi.fn(async () => {
        throw new Error("finalize_down");
      }),
    });

    await expect(settleUnifiPayment("pay_test_1", d)).resolves.toEqual({
      kind: "settled",
      status: "active",
    });
    expect(d.processEvent).toHaveBeenCalled();
  });

  it("revokes the membership on refund", async () => {
    const d = deps({ getInfo: vi.fn(async () => info({ status: "REFUNDED" })) });

    const result = await settleUnifiPayment("pay_test_1", d);

    expect(result).toEqual({ kind: "settled", status: "canceled" });
    // finalize는 CONFIRMED에서만 호출한다.
    expect(d.finalize).not.toHaveBeenCalled();
  });
});

describe("createUnifiWebhookHandler", () => {
  function post(body: string) {
    return new Request("https://catchmeme.com/api/billing/unifi/webhook", {
      method: "POST",
      body,
    });
  }

  it("reports 503 until the credentials are configured", async () => {
    const response = await createUnifiWebhookHandler(null)(post("{}"));
    expect(response.status).toBe(503);
  });

  it("rejects a malformed body", async () => {
    const response = await createUnifiWebhookHandler(deps())(post("nope"));
    expect(response.status).toBe(400);
  });

  it("acknowledges an unknown payment so the provider stops retrying", async () => {
    const d = deps({ getInfo: vi.fn(async () => null) });

    const response = await createUnifiWebhookHandler(d)(
      post('{"paymentId":"pay_unknown","status":"CONFIRMED"}'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(d.processEvent).not.toHaveBeenCalled();
  });

  it("returns 500 on a transient failure so the provider retries", async () => {
    const d = deps({
      processEvent: vi.fn(async () => {
        throw new Error("db_down");
      }),
    });

    const response = await createUnifiWebhookHandler(d)(
      post('{"paymentId":"pay_test_1","status":"CONFIRMED"}'),
    );

    expect(response.status).toBe(500);
  });

  it("settles a confirmed payment", async () => {
    const d = deps();

    const response = await createUnifiWebhookHandler(d)(
      post('{"paymentId":"pay_test_1","status":"CONFIRMED"}'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "active" });
  });
});
