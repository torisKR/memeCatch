"use client";

import { useEffect } from "react";
import {
  setCampaign,
  setUserProperties,
  track,
  whenGtagReady,
} from "@/lib/analytics";
import {
  type StoredAttribution,
  DIRECT_SOURCE,
  decideTouches,
  resolveAttribution,
  toGtagParams,
} from "@/lib/attribution";

/**
 * 유입 경로 수집기 — 루트 레이아웃에 1회 마운트.
 *
 * 하는 일 세 가지.
 *  1) 최초 유입(first touch)을 localStorage에 영구 보관 → "이 사용자를 처음 데려온 채널"
 *  2) 세션 유입(session touch)을 sessionStorage에 보관 → "이번 방문의 채널"
 *  3) GA4에 세 갈래로 전송
 *     - setCampaign: 기본 "트래픽 획득" 보고서 복원 (Direct로 뭉개지던 세션 되살리기)
 *     - setUserProperties: 최초 유입 기준 사용자 세그먼트
 *     - traffic_source 이벤트: 판별 근거까지 담은 원본 기록(검증용)
 *
 * 이 컴포넌트는 하드 로드 시에만 실행된다(SPA 내부 이동은 마운트가 유지됨).
 * 랜딩 시점의 URL·리퍼러를 봐야 하므로 이게 맞는 동작이다.
 */

const FIRST_TOUCH_KEY = "mc:attr:first";
const SESSION_TOUCH_KEY = "mc:attr:session";

/**
 * 스토리지 접근은 전부 실패할 수 있다.
 * 사파리 프라이빗 모드·쿠키 차단·용량 초과 어디서든 예외가 난다.
 * 분석 코드가 페이지를 깨뜨리는 일은 없어야 하므로 조용히 무시한다.
 */
function readStored(
  storage: Storage | undefined,
  key: string,
): StoredAttribution | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution;
    // 최소한의 형태 검증 — 손상된 값으로 보고서를 오염시키지 않는다.
    return parsed && typeof parsed.source === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(
  storage: Storage | undefined,
  key: string,
  value: StoredAttribution,
) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 수집 정확도만 떨어뜨릴 뿐, 동작은 계속되어야 한다 */
  }
}

export function AttributionTracker() {
  useEffect(() => {
    // ── 1. 현재 랜딩의 유입 경로 판별 ──────────────────────
    const current = resolveAttribution({
      search: window.location.search,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      selfHost: window.location.hostname,
    });

    const now = Date.now();
    const localStore = typeof localStorage === "undefined" ? undefined : localStorage;
    const sessionStore =
      typeof sessionStorage === "undefined" ? undefined : sessionStorage;

    // ── 2. 저장된 기록과 합쳐 최초·세션 유입 결정 (규칙은 lib/attribution.ts) ──
    const { firstTouch, sessionTouch, sessionExpired, isNewUser } = decideTouches({
      current,
      storedFirst: readStored(localStore, FIRST_TOUCH_KEY),
      storedSession: readStored(sessionStore, SESSION_TOUCH_KEY),
      now,
    });

    // ── 3. 되돌려 저장 ─────────────────────────────────────
    if (isNewUser) writeStored(localStore, FIRST_TOUCH_KEY, firstTouch);
    writeStored(sessionStore, SESSION_TOUCH_KEY, sessionTouch);

    // ── 4. GA4 전송 ────────────────────────────────────────
    // 저장(위)은 GA 차단 환경에서도 남겨야 하므로 동기로 끝내고,
    // 전송만 gtag 준비 이후로 미룬다.
    const landingPage = window.location.pathname.slice(0, 100);

    return whenGtagReady(() => {
      // 4-1) 내장 캠페인 필드 — 표준 보고서의 Direct 오분류를 되살린다.
      //      (direct)일 때는 주입하지 않는다. 진짜 직접 유입까지 덮어쓰면 왜곡이다.
      if (sessionTouch.source !== DIRECT_SOURCE) {
        setCampaign({
          source: sessionTouch.source,
          medium: sessionTouch.medium,
          name: sessionTouch.campaign,
          content: sessionTouch.content,
          term: sessionTouch.term,
        });
      }

      // 4-2) 최초 유입 기준 사용자 속성 — 이후 모든 이벤트에 자동 부착된다.
      setUserProperties(toGtagParams(firstTouch, "first_"));

      // 4-3) 원본 기록 — 세션당 1회.
      //      판별 근거(resolved_by)를 함께 남겨야 수치를 나중에 검증할 수 있다.
      if (sessionExpired) {
        track("traffic_source", {
          ...toGtagParams(sessionTouch),
          ...toGtagParams(firstTouch, "first_"),
          landing_page: landingPage,
          // 첫 방문인지 재방문인지 — 재방문 채널 분석의 출발점
          is_returning: isNewUser ? "false" : "true",
        });
      }
    });
  }, []);

  return null;
}
