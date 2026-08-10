"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";

/** 웹훅 재전송 간격(3s~30s 초반부)을 덮는 폴링 창 — 3초 × 20회 = 60초. */
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20;

export type CheckoutReturnCopy = {
  confirming: string;
  confirmed: string;
  timeout: string;
  startOneCut: string;
};

/**
 * 결제 복귀 상태 배너 — `?checkout=return`으로 돌아온 직후에만 나타난다.
 *
 * Unifi Pay 권한은 웹훅으로만 생기므로 복귀 시점엔 아직 반영 전일 수 있다.
 * 이전에는 사용자가 수동 새로고침해야 했다(UX 감사 gap #1). 이 배너가
 * /api/billing/entitlement를 짧게 폴링해 활성 전환을 감지하면 화면을 새로 그린다.
 * 60초 안에 확인되지 않으면(웹훅 장기 지연) 새로고침 안내로 물러난다 —
 * 권한 판정을 클라이언트가 지어내지 않고 서버 판정만 기다린다.
 */
export function CheckoutReturnStatus({
  initiallyPremium,
  locale,
  copy,
}: {
  initiallyPremium: boolean;
  locale: Locale;
  copy: CheckoutReturnCopy;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromCheckout = searchParams.get("checkout") === "return";
  const [phase, setPhase] = useState<"confirming" | "confirmed" | "timeout">(
    initiallyPremium ? "confirmed" : "confirming",
  );
  const triesRef = useRef(0);

  useEffect(() => {
    if (!fromCheckout) return;
    track("plus_checkout_returned", { locale, state: phase });
  }, [fromCheckout, locale, phase]);

  useEffect(() => {
    if (!fromCheckout || phase !== "confirming") return;
    let cancelled = false;
    const timer = setInterval(async () => {
      triesRef.current += 1;
      try {
        const res = await fetch("/api/billing/entitlement", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: { isPremium?: boolean } = await res.json();
        if (cancelled) return;
        if (data.isPremium) {
          setPhase("confirmed");
          clearInterval(timer);
          // 서버 컴포넌트(대시보드)의 권한 상태를 다시 그린다.
          router.refresh();
          return;
        }
      } catch {
        // 일시 오류는 다음 틱에 재시도 — 폴링 자체가 재시도 루프다.
      }
      if (triesRef.current >= POLL_MAX_TRIES) {
        if (!cancelled) setPhase("timeout");
        clearInterval(timer);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fromCheckout, phase, router]);

  if (!fromCheckout) return null;

  return (
    <div
      className={`mx-auto mt-4 flex w-full max-w-5xl flex-col gap-3 rounded-xl border px-4 py-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between ${
        phase === "confirmed"
          ? "border-safety-green/40 bg-safety-green-bg text-safety-green"
          : "border-border bg-surface-2 text-foreground"
      }`}
    >
      <p role="status" aria-live="polite">
        <span aria-hidden className={phase === "confirming" ? "signal-live" : undefined}>
          {phase === "confirmed" ? "●" : phase === "timeout" ? "▲" : "◌"}
        </span>{" "}
        {copy[phase]}
      </p>
      {phase === "confirmed" && (
        <Link
          href="/premium#plus-global-action-inbox-title"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {copy.startOneCut}
        </Link>
      )}
    </div>
  );
}
