"use client";

import { useEffect, useState } from "react";
import { usePremium } from "@/lib/hooks/use-premium";

/**
 * 쿠팡 파트너스 상시 하단 고정 배너(닻 광고).
 * - 데스크톱: 화면 맨 아래 고정(680×120 중앙). 모바일: 하단탭(BottomNav, 64px)
 *   바로 위에 고정(360×100) — 탭과 겹치지 않음.
 * - 도크 실높이만큼 스페이서(placeholder)를 문서 흐름에 두어 본문 하단(상세
 *   임베드·랭킹 카드 등)이 배너에 가려지지 않게 한다. 실측 도크 높이(iframe +
 *   고지줄 26px[닫기 버튼 24px + 상단 패딩 2px] + iframe 하단 패딩 4px + 상단
 *   보더 1px) = 모바일 131px / 데스크톱 151px — CSS 반응형 클래스로 고정해
 *   JS 상태(desktop/ready) 없이도 최초 렌더부터 정확한 높이로 존재(CLS 없음).
 * - 광고 박스(<aside>) 자체는 sessionStorage·matchMedia 등 클라이언트 전용
 *   신호가 필요해 마운트 후에만 렌더하지만, 스페이서는 그 신호와 무관하게
 *   dismissed/isAdmin/isPremium 기본값(false)이 SSR과 동일하므로 안전하다.
 * - 닫기(X): 세션 동안만 숨김(sessionStorage) — 다음 방문 시 다시 노출(상시 원칙).
 * - 필수 고지 문구를 배너 상단에 동봉. iframe은 lazy, referrer는 수익 귀속용.
 * - /admin은 렌더하지 않음(운영 화면).
 */
const DISMISS_KEY = "mc_coupang_dock";
const WIDGET_ID = 1006385;
const TRACKING_CODE = "AF7390846";

export function CoupangDock() {
  // SSR/hydration 불일치 방지: 광고 박스는 마운트 후에만 렌더(광고라 첫 페인트
  // 지연 무해). 스페이서는 아래에서 ready와 무관하게 그린다.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const isPremium = usePremium();

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

  // Plus 구독자·운영자·닫음 상태는 도크(광고+스페이서)를 함께 숨긴다. 마운트
  // 전엔 dismissed/isAdmin이 항상 false이므로 이 판단은 SSR과 동일하다.
  if (dismissed || isAdmin || isPremium) return null;

  const w = desktop ? 680 : 360;
  const h = desktop ? 120 : 100;
  const src =
    `https://ads-partners.coupang.com/widgets.html?id=${WIDGET_ID}` +
    `&template=carousel&trackingCode=${TRACKING_CODE}&subId=&width=${w}&height=${h}`;

  return (
    <>
      {/* 스페이서 — 도크 실높이만큼 자리 확보(본문·푸터 가림 방지, CLS 없음) */}
      <div aria-hidden className="h-[131px] md:h-[151px]" />
      {ready && (
        <aside
          aria-label="쿠팡 파트너스 광고"
          // 불투명 배경 — 반투명(blur)이면 뒤 페이지 콘텐츠가 광고 영역에 유령처럼 비침
          className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface md:bottom-0"
        >
          {/* 고지·닫기를 배너 폭(680)에 정렬 — 좌끝/우끝/중앙 3분열 방지 */}
          <div className="mx-auto flex w-full max-w-[680px] items-center justify-between gap-2 px-4 pt-0.5 md:px-0">
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
      )}
    </>
  );
}
