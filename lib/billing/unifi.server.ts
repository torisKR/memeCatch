import "server-only";

import { createHash } from "node:crypto";

/**
 * Unifi Apps(dapp-portal) 결제 서버 연동.
 * 문서: https://docs.unifi.me/unifi-apps-sdk (Payment Provider)
 *
 * 보안상 가장 중요한 사실: 상태 변경 웹훅에는 **서명이 없다**. 본문은
 * {paymentId, status}뿐이므로 누구나 위조할 수 있다. 따라서 본문의 status는
 * 힌트로만 쓰고, 항상 payment/info API(클라이언트 자격증명 필요)로 재조회한
 * 결과만을 권한 부여의 근거로 삼는다.
 */

const DEFAULT_BASE_URL = "https://payment.dappportal.io";
const REQUEST_TIMEOUT_MS = 8_000;

/** Plus 멤버십 상품 — 3,900원/30일. DB 게이트(amount)와 같은 값을 유지한다. */
export const UNIFI_PLAN = {
  itemIdentifier: "memecatch-plus-30d",
  name: "MemeCatch Plus (30일)",
  amount: 3_900,
  /** KRW는 최소 단위 = 표시 단위라 그대로 보낸다(10,000 KRW = "10000"). */
  currencyCode: "KRW",
  pgType: "STRIPE",
} as const;

export type UnifiConfig = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  testMode: boolean;
};

export function getUnifiConfig(env: NodeJS.ProcessEnv = process.env): UnifiConfig | null {
  const clientId = env.UNIFI_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.UNIFI_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    baseUrl: (env.UNIFI_PAYMENT_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    // 기본값은 테스트 모드. 운영 전환은 환경변수로 명시적으로만 이뤄진다.
    testMode: env.UNIFI_TEST_MODE !== "false",
  };
}

/**
 * Unifi Pay 호스팅 결제 링크(https://app.unifi.me/pay/links/<id>) 검증.
 *
 * 이 흐름은 위의 Apps SDK(dapp-portal, 지갑 필요)와 다른 제품이다. 결제 링크는
 * Latpeed처럼 사용자를 호스팅 결제창으로 보내기만 하므로 별도 SDK가 없다.
 * 환경변수로 임의 URL이 들어와도 결제창이 아닌 곳으로 사용자를 보내지 않도록
 * 호스트와 경로 형태를 고정한다(오픈 리다이렉트 방지).
 */
export function isAllowedUnifiPayLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "app.unifi.me" &&
      /^\/pay\/links\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** Unifi 결제 상태 → 우리 구독 상태. 진행 중 상태는 아직 권한을 만들지 않는다. */
export type UnifiPaymentStatus =
  | "CREATED"
  | "STARTED"
  | "REGISTERED_ON_PG"
  | "CAPTURED"
  | "CONFIRMED"
  | "CONFIRM_FAILED"
  | "FINALIZED"
  | "CANCELED"
  | "REFUNDED"
  | "CHARGEBACK";

export type MembershipStatus = "active" | "canceled";

export function mapUnifiStatus(status: string): MembershipStatus | null {
  switch (status.toUpperCase()) {
    case "CONFIRMED":
    case "FINALIZED":
      return "active";
    case "CANCELED":
    case "CONFIRM_FAILED":
    case "REFUNDED":
    case "CHARGEBACK":
      return "canceled";
    default:
      // CREATED/STARTED/REGISTERED_ON_PG/CAPTURED — 아직 결과가 아니다.
      return null;
  }
}

export type UnifiWebhookBody = {
  paymentId: string;
  status: string;
};

export function parseUnifiWebhookBody(rawBody: string): UnifiWebhookBody | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const body = parsed as Record<string, unknown>;
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!paymentId || !status) return null;
  return { paymentId, status };
}

/** 웹훅은 재시도되므로 (결제ID + 권위 상태) 조합으로 멱등 키를 만든다. */
export function unifiEventKey(paymentId: string, status: string): string {
  return createHash("sha256").update(`unifi:${paymentId}:${status.toUpperCase()}`).digest("hex");
}

export type UnifiPaymentInfo = {
  id: string;
  status: UnifiPaymentStatus;
  pgType: string;
  price: string | null;
  currencyCode: string | null;
  capturedAt: number | null;
  testMode: boolean;
  items: { itemIdentifier?: string; price?: string; currencyCode?: string }[];
};

async function unifiFetch(
  config: UnifiConfig,
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<Response> {
  const { auth = true, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${config.baseUrl}${path}`, {
      ...rest,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(auth
          ? { "X-Client-Id": config.clientId, "X-Client-Secret": config.clientSecret }
          : {}),
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export type CreatePaymentInput = {
  buyerDappPortalAddress: string;
  callbackUrl: string;
  unlockUrl?: string | null;
};

/**
 * 결제 생성. 문서가 응답 형태를 두 곳에서 다르게 적어(`{id}` / `{payment_id}`)
 * 둘 다 받아들인다.
 */
export async function createUnifiPayment(
  config: UnifiConfig,
  input: CreatePaymentInput,
): Promise<string> {
  const price = String(UNIFI_PLAN.amount);
  const response = await unifiFetch(config, "/api/payment-v1/payment/create", {
    method: "POST",
    body: JSON.stringify({
      buyerDappPortalAddress: input.buyerDappPortalAddress,
      pgType: UNIFI_PLAN.pgType,
      currencyCode: UNIFI_PLAN.currencyCode,
      price,
      paymentStatusChangeCallbackUrl: input.callbackUrl,
      lockUrl: null,
      unlockUrl: input.unlockUrl ?? null,
      items: [
        {
          itemIdentifier: UNIFI_PLAN.itemIdentifier,
          name: UNIFI_PLAN.name,
          price,
          currencyCode: UNIFI_PLAN.currencyCode,
        },
      ],
      testMode: config.testMode,
    }),
  });

  if (!response.ok) {
    throw new Error(`unifi_create_failed_${response.status}`);
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("unifi_create_invalid_response");
  const record = data as Record<string, unknown>;
  const paymentId =
    (typeof record.payment_id === "string" && record.payment_id) ||
    (typeof record.id === "string" && record.id) ||
    "";
  if (!paymentId) throw new Error("unifi_create_missing_payment_id");
  return paymentId;
}

export async function getUnifiPaymentInfo(
  config: UnifiConfig,
  paymentId: string,
): Promise<UnifiPaymentInfo | null> {
  const response = await unifiFetch(
    config,
    `/api/payment-v1/payment/info?id=${encodeURIComponent(paymentId)}`,
    { method: "GET" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`unifi_info_failed_${response.status}`);

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("unifi_info_invalid_response");
  const record = data as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status.toUpperCase() : "";
  if (!status) throw new Error("unifi_info_invalid_response");

  return {
    id: typeof record.id === "string" ? record.id : paymentId,
    status: status as UnifiPaymentStatus,
    pgType: typeof record.pgType === "string" ? record.pgType : "",
    price: typeof record.price === "string" ? record.price : null,
    currencyCode: typeof record.currencyCode === "string" ? record.currencyCode : null,
    capturedAt: typeof record.capturedAt === "number" ? record.capturedAt : null,
    testMode: record.testMode === true,
    items: Array.isArray(record.items) ? (record.items as UnifiPaymentInfo["items"]) : [],
  };
}

/** 정산을 위해 CONFIRMED 결제는 반드시 finalize 해야 한다(STRIPE 필수). */
export async function finalizeUnifiPayment(
  config: UnifiConfig,
  paymentId: string,
): Promise<void> {
  const response = await unifiFetch(config, "/api/payment-v1/payment/finalize", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ id: paymentId }),
  });
  // 이미 FINALIZED면 403(invalid payment status)이 온다 — 재시도 상황에서 정상이다.
  if (!response.ok && response.status !== 403) {
    throw new Error(`unifi_finalize_failed_${response.status}`);
  }
}

/**
 * 우리가 판매한 상품이 맞는지 검증한다. 금액·통화·상품식별자·테스트모드가
 * 모두 일치해야 권한을 만든다(가격 조작·타 상품 결제 재사용 차단).
 */
export function isExpectedUnifiPayment(info: UnifiPaymentInfo, config: UnifiConfig): boolean {
  if (info.testMode !== config.testMode) return false;
  if (info.currencyCode && info.currencyCode !== UNIFI_PLAN.currencyCode) return false;
  if (info.price !== null && Number(info.price) !== UNIFI_PLAN.amount) return false;
  return info.items.some((item) => item.itemIdentifier === UNIFI_PLAN.itemIdentifier);
}
