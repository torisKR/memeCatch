"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { selectPremiumSubscription } from "@/lib/billing/entitlements";

// auth-menu.tsx와 동일 키 — 직전 로그인에서 저장한 힌트를 재사용해 깜빡임 없이 즉시 반영
const PLUS_HINT_KEY = "mc_auth_plus";

/**
 * 클라이언트에서 현재 사용자의 Plus(프리미엄) 여부를 반환한다.
 *
 * 헤더·레이아웃은 전 사이트 ISR이라 서버에서 세션을 읽을 수 없다(읽으면 dynamic 강등 →
 * 상세 500). 그래서 프리미엄 판별은 반드시 클라이언트에서만 한다.
 * - localStorage 힌트(mc_auth_plus)로 즉시 낙관적 반영 → 광고 깜빡임 방지
 * - billing_subscriptions self-read RLS(본인 행만 반환)로 최종 확정
 */
export function usePremium(): boolean {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let alive = true;

    // 낙관적 초기 반영 — 직전 세션에서 저장한 힌트를 동기로 읽는다.
    try {
      if (window.localStorage.getItem(PLUS_HINT_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsPremium(true);
      }
    } catch {
      // 저장소 접근 실패(시크릿 모드 등)는 무시 — 아래 네트워크 조회로 확정된다
    }

    const supabase = createClient();

    const confirm = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setIsPremium(false);
        try {
          window.localStorage.setItem(PLUS_HINT_KEY, "0");
        } catch {}
        return;
      }
      // billing_subscriptions는 self-read RLS로 본인 행만 반환된다.
      const { data: subs } = await supabase
        .from("billing_subscriptions")
        .select("status, current_period_end, last_event_at");
      if (!alive) return;
      const premium = selectPremiumSubscription(subs ?? []) !== null;
      setIsPremium(premium);
      try {
        window.localStorage.setItem(PLUS_HINT_KEY, premium ? "1" : "0");
      } catch {}
    };

    void confirm();

    // 로그인/로그아웃 변화 반영
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void confirm();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return isPremium;
}
