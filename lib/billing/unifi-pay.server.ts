import "server-only";

import { createHmac } from "node:crypto";

/**
 * Unifi Pay(결제 링크) 서버 연동 — https://pay.unifi.me/api-reference-direct/
 *
 * 지갑 SDK(dapp-portal)와 다른 제품이다. 고객을 호스팅 결제창으로 보내고
 * 결과를 웹훅으로 받는다.
 *
 * 보안상 가장 중요한 사실: **웹훅에는 서명이 없다.** 본문은
 * {transactionId, orderId, status, type} 뿐이라 누구나 위조할 수 있다.
 * 문서도 "웹훅은 최소 정보만 전달하니 결제 상태 확인 API로 조회하라"고 안내한다.
 * 따라서 본문 status는 힌트로만 쓰고, HMAC 인증이 걸린 조회 API 결과만을
 * 권한 부여의 근거로 삼는다.
 *
 * 결제 귀속: 고정 링크는 모든 사용자가 같은 linkId를 공유해 누가 결제했는지
 * 알 수 없다. 그래서 체크아웃마다 링크를 발급하고 linkId ↔ user를 묶는다.
 * 웹훅의 orderId가 `LINK-{linkId}-{임의문자열}` 형식이라 여기서 역추적한다.
 */

const PREVIEW_BASE_URL = "https://app-api-pay.unifi.me";
const REQUEST_TIMEOUT_MS = 10_000;

/** MemeCatch Plus 요금 — $20 USD. Unifi Pay는 USD·JPY만 지원한다(KRW 불가). */
const DEFAULT_ITEM_PRICE = 20;

export type UnifiPayConfig = {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  storeId: string;
  serviceName: string;
  itemName: string;
  itemPrice: number;
  orderCurrencyCode: "USD" | "JPY";
  /** 콘솔 허용 목록에 등록된 도메인. 로컬 테스트는 터널 주소를 쓴다. */
  callbackBaseUrl: string;
  returnBaseUrl: string;
};

export function getUnifiPayConfig(
  env: NodeJS.ProcessEnv = process.env,
): UnifiPayConfig | null {
  const apiKey = env.UNIFI_PAY_API_KEY?.trim() ?? "";
  const apiSecret = env.UNIFI_PAY_API_SECRET?.trim() ?? "";
  const storeId = env.UNIFI_PAY_STORE_ID?.trim() ?? "";
  const callbackBaseUrl = env.UNIFI_PAY_CALLBACK_BASE_URL?.trim() ?? "";
  if (!apiKey || !apiSecret || !storeId || !callbackBaseUrl) return null;

  const rawPrice = env.UNIFI_PAY_ITEM_PRICE?.trim();
  const itemPrice = rawPrice ? Number(rawPrice) : DEFAULT_ITEM_PRICE;
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) return null;

  const currency = (env.UNIFI_PAY_CURRENCY?.trim() || "USD").toUpperCase();
  if (currency !== "USD" && currency !== "JPY") return null;

  return {
    apiKey,
    apiSecret,
    baseUrl: (env.UNIFI_PAY_BASE_URL?.trim() || PREVIEW_BASE_URL).replace(/\/+$/, ""),
    storeId,
    serviceName: env.UNIFI_PAY_SERVICE_NAME?.trim() || "MemeCatch",
    itemName: env.UNIFI_PAY_ITEM_NAME?.trim() || "MemeCatch Plus (30 days)",
    itemPrice,
    orderCurrencyCode: currency,
    callbackBaseUrl: callbackBaseUrl.replace(/\/+$/, ""),
    returnBaseUrl: (env.UNIFI_PAY_RETURN_BASE_URL?.trim() || callbackBaseUrl).replace(
      /\/+$/,
      "",
    ),
  };
}

/**
 * HMAC 서명 — BASE64(HMACSHA256(apiSecret, METHOD + URI + apiKey + timestamp + body)).
 * body는 실제로 전송하는 문자열과 정확히 같아야 한다(공백 없는 JSON).
 */
export function signUnifiPayRequest(input: {
  apiSecret: string;
  method: string;
  uri: string;
  apiKey: string;
  timestamp: string;
  body?: string;
}): string {
  const message = `${input.method}${input.uri}${input.apiKey}${input.timestamp}${input.body ?? ""}`;
  return createHmac("sha256", input.apiSecret).update(message).digest("base64");
}

/** 결제 링크로 생성된 주문의 orderId는 `LINK-{linkId}-{임의문자열}` 형식이다. */
export function parseLinkIdFromOrderId(orderId: string): string | null {
  const match = /^LINK-([A-Za-z0-9_]+)-[A-Za-z0-9_]+$/.exec(orderId.trim());
  return match ? match[1] : null;
}

export type UnifiPayWebhookBody = {
  transactionId: string;
  orderId: string;
  status: string;
  type: string;
};

export function parseUnifiPayWebhookBody(rawBody: string): UnifiPayWebhookBody | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const body = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const transactionId = str(body.transactionId);
  const orderId = str(body.orderId);
  const status = str(body.status);
  if (!transactionId || !orderId || !status) return null;
  return { transactionId, orderId, status, type: str(body.type) || "PURCHASE" };
}

export type MembershipStatus = "active" | "canceled";

/** Unifi Pay 결제 상태 → 구독 상태. 진행 중 상태는 아직 권한을 만들지 않는다. */
export function mapUnifiPayStatus(status: string): MembershipStatus | null {
  switch (status.toUpperCase()) {
    case "CONFIRMED":
      return "active";
    case "FAILED":
    case "CANCELED":
      return "canceled";
    default:
      // CREATED / PENDING — 아직 결과가 아니다.
      return null;
  }
}

async function unifiPayFetch(
  config: UnifiPayConfig,
  method: "GET" | "POST",
  uri: string,
  body?: unknown,
): Promise<Response> {
  const timestamp = String(Date.now());
  // 서명 대상과 전송 본문이 반드시 같은 문자열이어야 한다.
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const signature = signUnifiPayRequest({
    apiSecret: config.apiSecret,
    method,
    uri,
    apiKey: config.apiKey,
    timestamp,
    body: payload,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${config.baseUrl}${uri}`, {
      method,
      body: payload,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "X-API-Key": config.apiKey,
        "X-Timestamp": timestamp,
        "X-Authorization-Hmac": signature,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

const LINK_URI = "/api/seller/v1/payment/link";
/** 링크 유효기간 — 결제창을 열어두고 방치하는 시간을 제한한다. */
const LINK_TTL_MS = 60 * 60 * 1000;

export type CreatedPaymentLink = { linkUrl: string; linkId: string };

/**
 * 사용자 1인·1회 결제용 링크를 발급한다. requestId가 멱등키라 재요청 시
 * 중복 발급이 거부되므로 체크아웃마다 새 값을 만든다.
 */
export async function createUnifiPaymentLink(
  config: UnifiPayConfig,
  input: { requestId: string; callbackPath: string; returnPath: string },
): Promise<CreatedPaymentLink> {
  const response = await unifiPayFetch(config, "POST", LINK_URI, {
    requestId: input.requestId,
    storeId: config.storeId,
    serviceName: config.serviceName,
    itemName: config.itemName,
    itemPrice: config.itemPrice,
    orderCurrencyCode: config.orderCurrencyCode,
    returnUrl: `${config.returnBaseUrl}${input.returnPath}`,
    callbackUrl: `${config.callbackBaseUrl}${input.callbackPath}`,
    expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
  });

  if (!response.ok) throw new Error(`unifi_pay_link_failed_${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("unifi_pay_link_invalid_response");
  const record = data as Record<string, unknown>;
  const linkUrl = typeof record.linkUrl === "string" ? record.linkUrl : "";
  const linkId = typeof record.linkId === "string" ? record.linkId : "";
  if (!linkUrl || !linkId) throw new Error("unifi_pay_link_missing_fields");
  return { linkUrl, linkId };
}

export type UnifiPayTransaction = {
  transactionId: string;
  orderId: string;
  storeId: string;
  status: string;
  orderAmount: number | null;
  orderCurrencyCode: string | null;
};

export async function getUnifiPayTransaction(
  config: UnifiPayConfig,
  transactionId: string,
): Promise<UnifiPayTransaction | null> {
  const uri = `/api/seller/v1/payment/${encodeURIComponent(transactionId)}`;
  const response = await unifiPayFetch(config, "GET", uri);
  if (response.status === 404 || response.status === 406) return null;
  if (!response.ok) throw new Error(`unifi_pay_status_failed_${response.status}`);

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("unifi_pay_status_invalid_response");
  const record = data as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status.toUpperCase() : "";
  if (!status) throw new Error("unifi_pay_status_invalid_response");
  const responseTransactionId =
    typeof record.transactionId === "string" ? record.transactionId.trim() : "";
  const orderId = typeof record.orderId === "string" ? record.orderId.trim() : "";
  const storeId = typeof record.storeId === "string" ? record.storeId.trim() : "";
  const orderAmount =
    typeof record.orderAmount === "number" && Number.isFinite(record.orderAmount)
      ? record.orderAmount
      : null;
  const orderCurrencyCode =
    typeof record.orderCurrencyCode === "string"
      ? record.orderCurrencyCode.trim().toUpperCase()
      : "";
  if (
    !responseTransactionId ||
    responseTransactionId !== transactionId ||
    !orderId ||
    !storeId ||
    orderAmount === null ||
    !orderCurrencyCode
  ) {
    throw new Error("unifi_pay_status_invalid_response");
  }

  return {
    transactionId: responseTransactionId,
    orderId,
    storeId,
    status,
    orderAmount,
    orderCurrencyCode,
  };
}

/**
 * 우리가 판 상품이 맞는지 검증한다. 가맹점·통화·금액이 어긋나면 권한을 만들지
 * 않는다(타 상점 거래 재사용·금액 조작 차단).
 */
export function isExpectedUnifiPayTransaction(
  tx: UnifiPayTransaction,
  config: UnifiPayConfig,
): boolean {
  if (
    !tx.transactionId.trim() ||
    !tx.orderId.trim() ||
    !tx.storeId.trim() ||
    !tx.status.trim() ||
    !tx.orderCurrencyCode?.trim() ||
    tx.orderAmount === null ||
    !Number.isFinite(tx.orderAmount)
  ) {
    return false;
  }
  if (tx.storeId !== config.storeId) return false;
  if (tx.orderCurrencyCode.toUpperCase() !== config.orderCurrencyCode) return false;
  if (Math.abs(tx.orderAmount - config.itemPrice) > 0.001) return false;
  return true;
}

/** 링크 발급 멱등키 — 사용자별로 겹치지 않는 값(영문·숫자·하이픈만 허용). */
export function buildRequestId(userId: string, nowMs: number): string {
  return `MC-${userId.replace(/-/g, "").slice(0, 24)}-${nowMs.toString(36)}`;
}

/** 금액을 정수 최소 단위로 — DB의 amount 컬럼이 integer라 센트로 저장한다. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
