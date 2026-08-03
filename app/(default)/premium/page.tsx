import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MyFeed } from "@/components/my-feed";
import { CheckoutReturnStatus } from "@/components/premium/checkout-return-status";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { PremiumDashboardContent } from "@/components/premium/premium-dashboard-content";
import {
  getPremiumEntitlement,
  listOwnUnifiPaymentHistory,
  registerCurrentBillingIdentity,
} from "@/lib/billing/repository.server";
import { getRequestLocale } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type MemeCategory } from "@/lib/labels";

export const metadata: Metadata = {
  title: "MY PLUS",
  description: "MemeCatch Plus 맞춤 트렌드 레이더와 멤버십 상태를 확인하세요.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PremiumPage() {
  const [initialEntitlement, locale] = await Promise.all([
    getPremiumEntitlement(),
    getRequestLocale(),
  ]);
  let entitlement = initialEntitlement;

  if (!entitlement.signedIn) redirect("/login?next=/premium");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/premium");

  // Latpeed에서 상품을 직접 구매해 웹훅이 먼저 도착한 경우에도, 같은
  // 로그인 이메일의 미매칭 결제를 이 계정에 안전하게 연결한다.
  if (!entitlement.isPremium) {
    try {
      await registerCurrentBillingIdentity();
      entitlement = await getPremiumEntitlement();
    } catch {
      // 기존 권한 조회 결과로 화면을 계속 렌더한다. 사용자는 새로고침으로
      // 재시도할 수 있고, 서명된 결제 이벤트 없이는 권한이 생기지 않는다.
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("interests")
    .eq("id", user.id)
    .maybeSingle();
  const interests = (profile?.interests ?? []).filter(
    (category): category is MemeCategory => category in CATEGORIES,
  );

  const history = await listOwnUnifiPaymentHistory();
  const copy = PREMIUM_COPY[locale];

  return (
    <>
      {/* 결제 복귀 폴링 — ?checkout=return일 때만 나타난다. useSearchParams라 Suspense 필요 */}
      <Suspense fallback={null}>
        <CheckoutReturnStatus
          initiallyPremium={entitlement.isPremium}
          copy={{
            confirming: copy.dashboard.checkoutConfirming,
            confirmed: copy.dashboard.checkoutConfirmed,
            timeout: copy.dashboard.checkoutTimeout,
          }}
        />
      </Suspense>
      <PremiumDashboardContent
        isPremium={entitlement.isPremium}
        status={entitlement.status}
        currentPeriodEnd={entitlement.currentPeriodEnd}
        feed={entitlement.isPremium ? <MyFeed interests={interests} locale={locale} /> : null}
        history={history}
      />
    </>
  );
}
