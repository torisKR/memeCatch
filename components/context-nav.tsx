"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { COLLECTIONS } from "@/lib/collections";
import { track } from "@/lib/analytics";

/**
 * 맥락 유지 네비 (Wave 1) — 컬렉션에서 진입한 상세 페이지 상단에
 * "← 2020년대 밈 (7/24) →" 이전·다음 이동을 제공.
 * 데이터는 컬렉션 페이지가 링크에 인코딩(?ctx=&prev=&next=&i=&total=) —
 * 최신 searchParams가 필요한 내비만 클라이언트에서 파싱한다.
 */
function ContextNavInner() {
  const sp = useSearchParams();
  const ctx = sp.get("ctx");
  if (!ctx) return null;
  const col = COLLECTIONS.find((c) => c.slug === ctx);
  if (!col) return null;

  const prev = sp.get("prev");
  const next = sp.get("next");
  const i = sp.get("i");
  const total = sp.get("total");
  // 인코딩된 경로만 허용 — 외부 URL 주입 차단
  const safe = (p: string | null) =>
    p && p.startsWith("/memes/") ? p : null;
  const prevHref = safe(prev);
  const nextHref = safe(next);
  if (!prevHref && !nextHref) return null;

  // 진행 바 — i/total을 정적 width%로 환산(트랜지션 없음 → CLS 없음). 파싱 실패 시 미표시.
  const iNum = i ? Number(i) : NaN;
  const totalNum = total ? Number(total) : NaN;
  const hasProgress =
    Number.isFinite(iNum) && Number.isFinite(totalNum) && totalNum > 0;
  const progressPct = hasProgress
    ? Math.min(100, Math.max(0, (iNum / totalNum) * 100))
    : 0;

  return (
    <nav
      aria-label={`${col.title} 이어보기`}
      className="relative flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          onClick={() => track("context_nav", { dir: "prev", ctx })}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span> 이전
        </Link>
      ) : (
        <span />
      )}
      <Link
        href={`/collections/${col.slug}`}
        className="min-w-0 truncate text-center font-medium text-muted transition-colors hover:text-foreground"
      >
        {col.title}
        {i && total && (
          <span className="ml-1 tabular-nums text-xs">
            ({i}/{total})
          </span>
        )}
      </Link>
      {nextHref ? (
        <Link
          href={nextHref}
          onClick={() => track("context_nav", { dir: "next", ctx })}
          className="hover-glow-flame inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-accent transition-colors hover:text-foreground"
        >
          다음 <span aria-hidden>→</span>
        </Link>
      ) : (
        <span />
      )}
      {hasProgress && (
        <span
          aria-hidden
          className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-signal-cyan-soft"
        >
          <span
            className="block h-full rounded-full bg-signal-cyan"
            style={{ width: `${progressPct}%` }}
          />
        </span>
      )}
    </nav>
  );
}

export function ContextNav() {
  // searchParams 의존 클라이언트 하위 트리를 별도 Suspense 경계로 격리한다.
  return (
    <Suspense fallback={null}>
      <ContextNavInner />
    </Suspense>
  );
}
