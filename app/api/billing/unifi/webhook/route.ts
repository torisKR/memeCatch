import { createUnifiWebhookHandler } from "@/lib/billing/unifi-webhook-handler";
import { processUnifiPaymentEvent } from "@/lib/billing/repository.server";
import {
  finalizeUnifiPayment,
  getUnifiConfig,
  getUnifiPaymentInfo,
} from "@/lib/billing/unifi.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Unifi 결제 상태 변경 웹훅.
 * 본문에 서명이 없으므로 본문 status는 신뢰하지 않고, payment/info 재조회
 * 결과만으로 권한을 만든다(핸들러 내부). CONFIRMED면 finalize까지 수행한다.
 */
const config = getUnifiConfig();

const handleWebhook = createUnifiWebhookHandler(
  config
    ? {
        config,
        getInfo: getUnifiPaymentInfo,
        finalize: finalizeUnifiPayment,
        processEvent: processUnifiPaymentEvent,
      }
    : null,
);

export async function POST(request: Request) {
  return handleWebhook(request);
}
