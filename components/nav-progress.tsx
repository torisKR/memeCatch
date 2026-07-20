"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// 전역 내비게이션 진행 표시줄.
// App Router는 서버 렌더가 끝나야 loading.tsx를 보여주므로, 그 이전 구간
// (클릭 → RSC 페이로드 도착)에는 화면에 아무 반응이 없다. 이 컴포넌트가
// 링크 클릭/router 이동을 즉시 감지해 상단에 얇은 진행 바를 띄워 준다.
//
// - 시작 감지: 앵커 클릭 캡처 + history.pushState/popstate 패치
// - 완료 감지: pathname/searchParams 변경 (실제 라우트 커밋)
// - flash 방지: 120ms 안에 끝나는 캐시 내비게이션에는 바를 아예 띄우지 않음
// - reduced-motion: 진행 표시는 유지(정보성), 장식성 글로우만 제거

const APPEAR_DELAY = 120; // 이 시간보다 빨리 끝나면 바를 표시하지 않음
const DONE_HOLD = 240; // 100%에서 사라지기까지 유지 시간
const TRICKLE_INTERVAL = 300;

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(0);

  const activeRef = useRef(false);
  const appearRef = useRef<number | null>(null);
  const trickleRef = useRef<number | null>(null);
  const doneRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (appearRef.current) {
      clearTimeout(appearRef.current);
      appearRef.current = null;
    }
    if (trickleRef.current) {
      clearTimeout(trickleRef.current);
      trickleRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    if (doneRef.current) {
      clearTimeout(doneRef.current);
      doneRef.current = null;
    }
    clearTimers();

    // 즉시 표시하지 않고 잠깐 기다린다 → 캐시 이동(즉시 완료)엔 flash 없음
    appearRef.current = window.setTimeout(() => {
      appearRef.current = null;
      setValue(8);
      setVisible(true);

      const tick = () => {
        setValue((v) => {
          // 90%를 향해 점점 느리게 차오름 (실제 완료 전까지 도달하지 않음)
          const next = v + (90 - v) * 0.12;
          return next > 89.5 ? 89.5 : next;
        });
        trickleRef.current = window.setTimeout(tick, TRICKLE_INTERVAL);
      };
      trickleRef.current = window.setTimeout(tick, TRICKLE_INTERVAL);
    }, APPEAR_DELAY);
  }, [clearTimers]);

  const done = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;

    // 아직 표시 전이었다면(초고속 이동) 조용히 리셋
    if (appearRef.current) {
      clearTimers();
      setVisible(false);
      setValue(0);
      return;
    }

    clearTimers();
    setValue(100);
    doneRef.current = window.setTimeout(() => {
      doneRef.current = null;
      setVisible(false);
      // 페이드 아웃 후 값 초기화 (다음 시작 때 0에서 출발)
      window.setTimeout(() => setValue(0), 200);
    }, DONE_HOLD);
  }, [clearTimers]);

  // ── 내비게이션 시작 감지 ──────────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel") === "external"
      ) {
        return;
      }

      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // 완전히 동일한 URL(해시 이동 등)은 라우트 변화가 없음
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
        start();
      } catch {
        /* 잘못된 href는 무시 */
      }
    };

    document.addEventListener("click", onClick, true);

    // router.push / 프로그램적 이동 → pushState 패치로 감지
    const origPush = window.history.pushState;
    window.history.pushState = function pushStatePatched(
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const url = args[2];
      if (url != null) {
        try {
          const next = new URL(String(url), window.location.href);
          if (
            next.pathname !== window.location.pathname ||
            next.search !== window.location.search
          ) {
            start();
          }
        } catch {
          start();
        }
      }
      return origPush.apply(this, args);
    };

    const onPop = () => start();
    window.addEventListener("popstate", onPop);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.history.pushState = origPush;
      window.removeEventListener("popstate", onPop);
    };
  }, [start]);

  // ── 라우트 커밋되면 완료 ──────────────────────────────
  useEffect(() => {
    done();
    // pathname/searchParams가 바뀌는 순간이 곧 새 라우트 커밋 시점
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      clearTimers();
      if (doneRef.current) clearTimeout(doneRef.current);
    };
  }, [clearTimers]);

  if (!visible && value === 0) return null;

  return (
    <div
      aria-hidden
      className="nav-progress"
      data-visible={visible ? "true" : "false"}
    >
      <div
        className="nav-progress__bar"
        style={{ width: `${value}%` }}
      >
        <span className="nav-progress__glow" />
      </div>
    </div>
  );
}
