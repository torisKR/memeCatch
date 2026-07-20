"use client";

import { useEffect } from "react";
import { usePremium } from "@/lib/hooks/use-premium";

/**
 * Plus 구독자에게 "광고 없는 경험"을 제공한다.
 *
 * 전 사이트 ISR 레이아웃을 dynamic으로 강등시키지 않으려면 서버에서 프리미엄을 판별할 수
 * 없으므로, 클라이언트에서만 판별해 <html data-premium="1">을 토글한다.
 * - AdSense Auto Ads가 주입한 요소 → globals.css가 이 속성으로 숨김
 * - 쿠팡 배너(CoupangDock) → 컴포넌트 자체가 프리미엄이면 렌더하지 않음
 */
export function PremiumAdControl() {
  const isPremium = usePremium();

  useEffect(() => {
    const el = document.documentElement;
    if (isPremium) el.setAttribute("data-premium", "1");
    else el.removeAttribute("data-premium");
  }, [isPremium]);

  return null;
}
