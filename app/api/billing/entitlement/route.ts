import { getPremiumEntitlement } from "@/lib/billing/repository.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 세션 사용자의 Plus 권한 요약 — 결제 복귀 화면의 웹훅 지연 폴링용.
 *
 * Unifi Pay는 웹훅으로만 권한이 생기고(재전송 3s~3h), 결제창에서 돌아온 직후에는
 * 아직 반영 전일 수 있다. 복귀 화면이 이 엔드포인트를 짧게 폴링해 활성 전환을
 * 감지한다. 권한 판정 자체는 기존 getPremiumEntitlement 하나를 재사용한다.
 */
export async function GET() {
  const entitlement = await getPremiumEntitlement();
  return Response.json(
    {
      signedIn: entitlement.signedIn,
      isPremium: entitlement.isPremium,
      currentPeriodEnd: entitlement.currentPeriodEnd,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
