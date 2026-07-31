import { settleUnifiPayment } from "@/lib/billing/unifi-webhook-handler";
import {
  isOwnUnifiPayment,
  processUnifiPaymentEvent,
} from "@/lib/billing/repository.server";
import {
  finalizeUnifiPayment,
  getUnifiConfig,
  getUnifiPaymentInfo,
} from "@/lib/billing/unifi.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * 웹훅 유실 대비 확인 경로. 클라이언트의 startPayment Promise가 resolve된 직후
 * 호출한다. 본인 결제인지 확인한 뒤 웹훅과 동일한 코어로 정산하므로,
 * 사용자가 결제 후 권한을 기다리는 상황이 생기지 않는다(멱등).
 */
export async function POST(request: Request) {
  const config = getUnifiConfig();
  if (!config) return json({ ok: false, error: "unifi_not_configured" }, 503);

  let paymentId = "";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const value = (body as Record<string, unknown>).paymentId;
      paymentId = typeof value === "string" ? value.trim() : "";
    }
  } catch {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
  if (!paymentId) return json({ ok: false, error: "invalid_payload" }, 400);

  // 남의 결제 ID로 자기 권한을 만들 수 없도록 소유권을 먼저 확인한다.
  if (!(await isOwnUnifiPayment(paymentId))) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  try {
    const result = await settleUnifiPayment(paymentId, {
      config,
      getInfo: getUnifiPaymentInfo,
      finalize: finalizeUnifiPayment,
      processEvent: processUnifiPaymentEvent,
    });
    if (result.kind === "settled") return json({ ok: true, status: result.status }, 200);
    if (result.kind === "pending") {
      return json({ ok: true, status: "pending", providerStatus: result.providerStatus }, 200);
    }
    return json({ ok: false, error: "not_settled" }, 409);
  } catch {
    return json({ ok: false, error: "settlement_failed" }, 502);
  }
}
