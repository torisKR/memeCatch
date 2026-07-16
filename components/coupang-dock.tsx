"use client";

import { useEffect, useState } from "react";

/**
 * 쿠팡 파트너스 상시 하단 고정 배너(닻 광고).
 * - 데스크톱: 화면 맨 아래 고정(680×120 중앙). 모바일: 하단탭(BottomNav, 64px)
 *   바로 위에 고정(360×100) — 탭과 겹치지 않음.
 * - 같은 높이의 스페이서를 문서 흐름 끝에 두어 페이지 최하단 콘텐츠(푸터)가
 *   배너에 가려지지 않게 한다.
 * - 닫기(X): 세션 동안만 숨김(sessionStorage) — 다음 방문 시 다시 노출(상시 원칙).
 * - 필수 고지 문구를 배너 상단에 동봉. iframe은 lazy, referrer는 수익 귀속용.
 * - /admin은 렌더하지 않음(운영 화면).
 */
const DISMISS_KEY = "mc_coupang_dock";
const WIDGET_ID = 1006385;
const TRACKING_CODE = "AF7390846";

export function CoupangDock() {
  // SSR/hydration 불일치 방지: 마운트 후에만 렌더(광고라 첫 페인트 지연 무해)
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 외부 스토어(sessionStorage·matchMedia·location) 마운트 1회 동기화 — effect가 정석
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {}
    setIsAdmin(window.location.pathname.startsWith("/admin"));
    const mq = window.matchMedia("(min-width: 768px)");
    setDesktop(mq.matches);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!ready || dismissed || isAdmin) return null;

  const w = desktop ? 680 : 360;
  const h = desktop ? 120 : 100;
  const src =
    `https://ads-partners.coupang.com/widgets.html?id=${WIDGET_ID}` +
    `&template=carousel&trackingCode=${TRACKING_CODE}&subId=&width=${w}&height=${h}`;
  // 고지줄(약 18px) 포함 도크 전체 높이
  const dockH = h + 20;

  return (
    <>
      {/* 스페이서 — 문서 끝에서 배너 높이만큼 자리 확보(푸터 가림 방지) */}
      <div aria-hidden style={{ height: dockH }} className="md:block" />
      <aside
        aria-label="쿠팡 파트너스 광고"
        className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 backdrop-blur-sm md:bottom-0"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 pt-0.5">
          <p className="truncate text-[10px] leading-4 text-muted">
            광고 · 쿠팡 파트너스 활동으로 일정 수수료를 제공받습니다
          </p>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                window.sessionStorage.setItem(DISMISS_KEY, "1");
              } catch {}
            }}
            aria-label="광고 닫기"
            className="relative -mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-surface-2 hover:text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-1">
          <iframe
            src={src}
            title="쿠팡 파트너스 상품 캐러셀 광고"
            width={w}
            height={h}
            loading="lazy"
            scrolling="no"
            referrerPolicy="unsafe-url"
            className="mx-auto block w-full max-w-[680px] border-0"
            style={{ height: h }}
          />
        </div>
      </aside>
    </>
  );
}
