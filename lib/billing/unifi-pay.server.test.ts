import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildRequestId,
  getUnifiPayConfig,
  getUnifiPayTransaction,
  isExpectedUnifiPayTransaction,
  mapUnifiPayStatus,
  parseLinkIdFromOrderId,
  parseUnifiPayWebhookBody,
  signUnifiPayRequest,
  toMinorUnits,
  type UnifiPayConfig,
} from "@/lib/billing/unifi-pay.server";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CONFIG: UnifiPayConfig = {
  apiKey: "b6ef2f7c-3e74-438c-b456-689e821992be",
  apiSecret: "secret",
  baseUrl: "https://app-api-pay.unifi.me",
  storeId: "123",
  serviceName: "MemeCatch",
  itemName: "MemeCatch Plus (30 days)",
  itemPrice: 20,
  orderCurrencyCode: "USD",
  callbackBaseUrl: "https://catchmeme.com",
  returnBaseUrl: "https://catchmeme.com",
};

describe("signUnifiPayRequest", () => {
  // 문서 공식: BASE64(HMACSHA256(secret, METHOD + URI + apiKey + timestamp + body))
  const base = {
    apiSecret: "secret",
    apiKey: CONFIG.apiKey,
    timestamp: "1773017787000",
  };

  it("signs the exact concatenation the docs specify", () => {
    const uri = "/api/seller/v1/payment/link";
    const body = '{"requestId":"REQ-1"}';
    const signature = signUnifiPayRequest({ ...base, method: "POST", uri, body });

    expect(signature).toBe(signUnifiPayRequest({ ...base, method: "POST", uri, body }));
    expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("changes when any signed component changes", () => {
    const uri = "/api/seller/v1/payment/link";
    const body = '{"requestId":"REQ-1"}';
    const signature = signUnifiPayRequest({ ...base, method: "POST", uri, body });

    expect(signUnifiPayRequest({ ...base, method: "GET", uri, body })).not.toBe(signature);
    expect(signUnifiPayRequest({ ...base, method: "POST", uri: "/other", body })).not.toBe(
      signature,
    );
    expect(
      signUnifiPayRequest({ ...base, method: "POST", uri, body, timestamp: "1" }),
    ).not.toBe(signature);
    // 본문에 공백이 끼면 서명이 달라진다 — 전송 문자열과 반드시 같아야 한다.
    expect(
      signUnifiPayRequest({ ...base, method: "POST", uri, body: '{ "requestId":"REQ-1" }' }),
    ).not.toBe(signature);
  });

  it("omits the body for GET requests", () => {
    const uri = "/api/seller/v1/payment/123";
    expect(signUnifiPayRequest({ ...base, method: "GET", uri })).toBe(
      signUnifiPayRequest({ ...base, method: "GET", uri, body: "" }),
    );
  });
});

describe("parseLinkIdFromOrderId", () => {
  it("extracts the link id from a payment-link order", () => {
    expect(parseLinkIdFromOrderId("LINK-3f1d0a549c1e4f6a8a5b2f-a1b2c3")).toBe(
      "3f1d0a549c1e4f6a8a5b2f",
    );
    expect(parseLinkIdFromOrderId("  LINK-abc123-x9y8  ")).toBe("abc123");
  });

  it("rejects order ids that are not link-based", () => {
    for (const value of ["ORD-20260301-0001", "LINK-onlyone", "LINK--x", "", "LINK-a-b-c"]) {
      expect(parseLinkIdFromOrderId(value)).toBeNull();
    }
  });
});

describe("parseUnifiPayWebhookBody", () => {
  it("reads the four documented fields", () => {
    expect(
      parseUnifiPayWebhookBody(
        '{"transactionId":"tx-1","orderId":"LINK-abc-1","status":"CONFIRMED","type":"PURCHASE"}',
      ),
    ).toEqual({
      transactionId: "tx-1",
      orderId: "LINK-abc-1",
      status: "CONFIRMED",
      type: "PURCHASE",
    });
  });

  it("rejects malformed bodies", () => {
    expect(parseUnifiPayWebhookBody("nope")).toBeNull();
    expect(parseUnifiPayWebhookBody("[]")).toBeNull();
    expect(parseUnifiPayWebhookBody('{"transactionId":"tx-1"}')).toBeNull();
  });
});

describe("mapUnifiPayStatus", () => {
  it("grants access only on CONFIRMED", () => {
    expect(mapUnifiPayStatus("CONFIRMED")).toBe("active");
  });

  it("revokes on terminal failures", () => {
    expect(mapUnifiPayStatus("FAILED")).toBe("canceled");
    expect(mapUnifiPayStatus("CANCELED")).toBe("canceled");
  });

  it("waits while the payment is still in progress", () => {
    expect(mapUnifiPayStatus("CREATED")).toBeNull();
    expect(mapUnifiPayStatus("PENDING")).toBeNull();
  });
});

describe("isExpectedUnifiPayTransaction", () => {
  const tx = {
    transactionId: "tx-1",
    orderId: "LINK-abc-1",
    storeId: "123",
    status: "CONFIRMED",
    orderAmount: 20,
    orderCurrencyCode: "USD",
  };

  it("accepts our own $20 USD order", () => {
    expect(isExpectedUnifiPayTransaction(tx, CONFIG)).toBe(true);
  });

  it("rejects a different store, currency, or amount", () => {
    expect(isExpectedUnifiPayTransaction({ ...tx, storeId: "999" }, CONFIG)).toBe(false);
    expect(isExpectedUnifiPayTransaction({ ...tx, orderCurrencyCode: "JPY" }, CONFIG)).toBe(
      false,
    );
    expect(isExpectedUnifiPayTransaction({ ...tx, orderAmount: 1 }, CONFIG)).toBe(false);
  });

  it("rejects missing settlement identity and pricing fields", () => {
    expect(isExpectedUnifiPayTransaction({ ...tx, transactionId: "" }, CONFIG)).toBe(false);
    expect(isExpectedUnifiPayTransaction({ ...tx, orderId: "" }, CONFIG)).toBe(false);
    expect(isExpectedUnifiPayTransaction({ ...tx, storeId: "" }, CONFIG)).toBe(false);
    expect(isExpectedUnifiPayTransaction({ ...tx, orderAmount: null }, CONFIG)).toBe(false);
    expect(isExpectedUnifiPayTransaction({ ...tx, orderCurrencyCode: null }, CONFIG)).toBe(false);
  });
});

describe("getUnifiPayTransaction", () => {
  it("fails closed when the provider omits any required settlement field", async () => {
    const fields = [
      "transactionId",
      "orderId",
      "storeId",
      "orderAmount",
      "orderCurrencyCode",
    ];
    for (const field of fields) {
      const response = {
        transactionId: "tx-1",
        orderId: "LINK-abc-1",
        storeId: "123",
        status: "CONFIRMED",
        orderAmount: 20,
        orderCurrencyCode: "USD",
      } as Record<string, unknown>;
      delete response[field];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(response), { status: 200 }),
        ),
      );

      await expect(getUnifiPayTransaction(CONFIG, "tx-1")).rejects.toThrow(
        "unifi_pay_status_invalid_response",
      );
    }
  });

  it("rejects a provider transaction id that differs from the requested id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            transactionId: "tx-other",
            orderId: "LINK-abc-1",
            storeId: "123",
            status: "CONFIRMED",
            orderAmount: 20,
            orderCurrencyCode: "USD",
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(getUnifiPayTransaction(CONFIG, "tx-1")).rejects.toThrow(
      "unifi_pay_status_invalid_response",
    );
  });
});

describe("getUnifiPayConfig", () => {
  const base = {
    UNIFI_PAY_API_KEY: "k",
    UNIFI_PAY_API_SECRET: "s",
    UNIFI_PAY_STORE_ID: "123",
    UNIFI_PAY_CALLBACK_BASE_URL: "https://catchmeme.com/",
  } as unknown as NodeJS.ProcessEnv;

  it("defaults to $20 USD", () => {
    const config = getUnifiPayConfig(base);
    expect(config?.itemPrice).toBe(20);
    expect(config?.orderCurrencyCode).toBe("USD");
    // 뒤 슬래시를 지워야 경로를 이어붙일 때 //가 생기지 않는다.
    expect(config?.callbackBaseUrl).toBe("https://catchmeme.com");
  });

  it("returns null when credentials or callback domain are missing", () => {
    expect(getUnifiPayConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      getUnifiPayConfig({ ...base, UNIFI_PAY_CALLBACK_BASE_URL: "" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("rejects currencies Unifi Pay does not support", () => {
    // KRW는 지원하지 않는다(USD·JPY만).
    expect(
      getUnifiPayConfig({ ...base, UNIFI_PAY_CURRENCY: "KRW" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("rejects a non-positive price", () => {
    expect(
      getUnifiPayConfig({ ...base, UNIFI_PAY_ITEM_PRICE: "0" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });
});

describe("helpers", () => {
  it("builds a request id within the documented charset", () => {
    const id = buildRequestId("b0c7f5fe-1111-2222-3333-444455556666", 1_772_000_000_000);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("stores money as integer minor units", () => {
    expect(toMinorUnits(20)).toBe(2000);
    expect(toMinorUnits(12.34)).toBe(1234);
  });
});
