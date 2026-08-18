"use client";

/**
 * GA4 이벤트 헬퍼 — CEO 플랜 Wave 1 이벤트 7종 + 레인 확장의 단일 진입점.
 * gtag 미로드(GA_ID 미설정·차단기) 시 조용히 무시.
 * 이벤트명: next_meme_click | related_click | random_meme | context_nav
 *          | today_meme_click | resume_click | share_click | donate_click
 *          | weekly_click(레인 D: /weekly 카드 클릭) | my_recent_click(레인 C: MY 최근 본 밈 클릭)
 *          | timeline_click(레인 A: /timeline 카드 클릭) | search_suggest_click(레인 B: 검색 자동완성 클릭)
 *          | quiz_start(mode) | quiz_complete(score) | quiz_share — 밈력고사(/quiz) 퍼널
 *          | global_daily_start(locale) | global_daily_complete(locale, score)
 *          | briefing_click(to) — 홈 주간 브리핑("이번 주 이것만") 내 링크 클릭
 *          | traffic_source — 세션 1회, 유입 경로 판별 결과(components/attribution-tracker.tsx)
 *          | search_submit(query, result_count) — 검색 결과가 실제로 렌더된 시점 1회
 *          | search_no_result(query) — 결과 0건 (search_submit과 함께 발사)
 *          | search_result_click(query, to) — 결과 카드 클릭
 *            ↳ 검색 성공률 = (result_click + suggest_click) / submit
 *          | meme_source_opened(short_id, platform) — 상세의 근거 목록(SourceEvidence)
 *            출처 링크 클릭. HG-006 B안 — 개인정보 무포함(문서 ID·정규화 플랫폼명만)
 *          | correction_report_started(short_id, from) — 상세의 정정 제보 CTA 진입.
 *            from=trust_note(근거 0건) | doc_status(얇은 문서). HG-006 B안
 *          | translation_priority_requested(locale, result)
 *          | translation_ready_opened(locale)
 *          | use_kit_copied(format)
 *          | meme_view(meme_id) | follow_click(meme_id) | copy(format)
 *          | paywall_view | checkout_start | payment_confirmed(locale) | renewal(locale, surface)
 *          | plus_pricing_view(locale, surface)
 *          | plus_checkout_started(locale, surface)
 *          | plus_checkout_returned(locale, state)
 *          | plus_one_cut_ready(locale, count, entry_source?)
 *          | plus_one_cut_prepared(locale, count, entry_source?)
 *          | plus_receipt_saved(locale, channel, artifact_kind, already_recorded, entry_source?)
 *          | plus_weekly_brief_opened(brief_id, item_count)
 *          | plus_weekly_brief_clicked(brief_id, position, source)
 */
type GtagEvent =
  | "next_meme_click"
  | "related_click"
  | "random_meme"
  | "context_nav"
  | "today_meme_click"
  | "resume_click"
  | "share_click"
  | "donate_click"
  | "weekly_click"
  | "my_recent_click"
  | "timeline_click"
  | "search_suggest_click"
  | "affiliate_click"
  | "affiliate_product_click"
  | "generation_news_click"
  | "quiz_start"
  | "quiz_complete"
  | "quiz_share"
  | "global_daily_start"
  | "global_daily_complete"
  | "briefing_click"
  | "traffic_source"
  | "search_submit"
  | "search_result_click"
  | "search_no_result"
  | "meme_source_opened"
  | "correction_report_started"
  | "translation_priority_requested"
  | "translation_ready_opened"
  | "use_kit_copied"
  | "meme_view"
  | "follow_click"
  | "copy"
  | "paywall_view"
  | "checkout_start"
  | "payment_confirmed"
  | "renewal"
  | "plus_pricing_view"
  | "plus_checkout_started"
  | "plus_checkout_returned"
  | "plus_one_cut_ready"
  | "plus_one_cut_prepared"
  | "plus_receipt_saved"
  | "plus_weekly_brief_opened"
  | "plus_weekly_brief_clicked";

const DURABLE_GROWTH_EVENTS = new Set<GtagEvent>([
  "meme_view",
  "follow_click",
  "copy",
  "paywall_view",
  "share_click",
  "quiz_start",
  "quiz_complete",
  "traffic_source",
  "plus_weekly_brief_opened",
  "plus_weekly_brief_clicked",
]);

function sendDurableGrowthEvent(event: GtagEvent, params: Record<string, string | number>) {
  if (typeof window === "undefined" || !DURABLE_GROWTH_EVENTS.has(event)) return;
  try {
    const key = "memecatch:growth-session:v1";
    const stored = window.sessionStorage.getItem(key);
    const sessionId = stored || crypto.randomUUID();
    if (!stored) window.sessionStorage.setItem(key, sessionId);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `mc_growth_session=${sessionId}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
    const payload = JSON.stringify({
      eventName: event,
      path: window.location.pathname,
      params,
    });
    const body = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/analytics/events", body)) return;
    void fetch("/api/analytics/events", {
      method: "POST",
      body: payload,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => undefined);
  } catch {
  }
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: GtagEvent, params?: Record<string, string | number>) {
  const eventParams = params ?? {};
  try {
    window.gtag?.("event", event, eventParams);
  } catch {
    /* 분석 실패가 UX를 깨면 안 됨 */
  }
  sendDurableGrowthEvent(event, eventParams);
}

/**
 * gtag 준비 대기.
 *
 * @next/third-parties의 초기화 스크립트는 afterInteractive 전략이라
 * 하이드레이션 직후 주입된다. 즉 컴포넌트의 useEffect가 window.gtag보다
 * 먼저 실행될 수 있고, 그때 보낸 이벤트는 조용히 사라진다.
 * 랜딩 1회성 측정(유입 경로)은 놓치면 복구할 방법이 없으므로 기다린다.
 *
 * 반환값은 정리(cleanup) 함수 — 언마운트 시 호출해 폴링을 멈춘다.
 * GA_ID 미설정·광고 차단기 환경에서는 끝내 준비되지 않으며, 그때는
 * 콜백을 실행하지 않고 조용히 포기한다(기존 track()과 같은 태도).
 */
export function whenGtagReady(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.gtag) {
    callback();
    return () => {};
  }

  const INTERVAL_MS = 150;
  const MAX_ATTEMPTS = 40; // 약 6초
  let attempts = 0;

  const timer = window.setInterval(() => {
    attempts += 1;
    if (window.gtag) {
      window.clearInterval(timer);
      callback();
    } else if (attempts >= MAX_ATTEMPTS) {
      window.clearInterval(timer);
    }
  }, INTERVAL_MS);

  return () => window.clearInterval(timer);
}

/**
 * 사용자 속성 설정 — 이후 모든 이벤트에 자동으로 붙는다.
 * 최초 유입 경로처럼 "이 사용자를 설명하는 값"에만 쓴다.
 * GA4 관리화면에서 맞춤 정의(사용자 범위)로 등록해야 보고서에 노출된다.
 */
export function setUserProperties(props: Record<string, string>) {
  try {
    window.gtag?.("set", "user_properties", props);
  } catch {
    /* 분석 실패가 UX를 깨면 안 됨 */
  }
}

/**
 * GA4 내장 캠페인 필드 주입.
 *
 * 맞춤 이벤트 파라미터와 달리 이 필드들은 GA4의 기본 "트래픽 획득" 보고서와
 * 기본 채널 그룹에 직접 반영된다. 인앱 브라우저·리다이렉터 때문에 리퍼러가
 * 유실돼 Direct로 뭉개지던 세션을 표준 보고서 수준에서 되살리는 통로다.
 *
 * 주의: 이 호출 이후에 전송되는 이벤트에만 적용된다.
 */
export function setCampaign(campaign: {
  source: string;
  medium: string;
  name?: string;
  content?: string;
  term?: string;
}) {
  try {
    window.gtag?.("set", {
      campaign_source: campaign.source,
      campaign_medium: campaign.medium,
      ...(campaign.name ? { campaign_name: campaign.name } : {}),
      ...(campaign.content ? { campaign_content: campaign.content } : {}),
      ...(campaign.term ? { campaign_term: campaign.term } : {}),
    });
  } catch {
    /* 분석 실패가 UX를 깨면 안 됨 */
  }
}
