/**
 * 유입 경로(attribution) 판별 — 순수 로직.
 *
 * GA4 기본 수집만으로는 한국 소셜 유입의 상당수가 `Direct / (none)`으로 뭉갠다.
 * 스레드·카카오톡·인스타그램 인앱 브라우저가 `document.referrer`를 비워서 보내고,
 * 스레드 링크는 `l.threads.com` 리다이렉터를 거치며 리퍼러가 유실되기 때문이다.
 *
 * 그래서 판별 우선순위를 3단으로 둔다.
 *   1) URL의 UTM 파라미터 — 우리가 직접 태깅한 값이므로 가장 신뢰도가 높다
 *   2) User-Agent 인앱 브라우저 토큰 — 리퍼러가 비어도 앱을 특정할 수 있다
 *   3) document.referrer 도메인 정규화 — 검색/소셜/일반 리퍼럴 분류
 *   4) 전부 실패 시 (direct)/(none)
 *
 * 브라우저 API를 직접 만지지 않고 전부 인자로 받는다(테스트 가능성).
 * 실제 수집·저장·전송은 components/attribution-tracker.tsx가 담당한다.
 */

/** GA4 관례를 따르는 미확인 값 표기. */
export const DIRECT_SOURCE = "(direct)";
export const NONE_MEDIUM = "(none)";

/** GA4 이벤트 파라미터 값 상한(100자)에 맞춘 안전 절단 길이. */
const MAX_PARAM_LENGTH = 100;

export type AttributionMedium =
  | "social"
  | "organic"
  | "referral"
  | "cpc"
  | "email"
  | "affiliate"
  | typeof NONE_MEDIUM
  | (string & {});

export type Attribution = {
  /** 유입원. 예: threads, naver, google, (direct) */
  source: string;
  /** 유입 매체. 예: social, organic, referral, (none) */
  medium: AttributionMedium;
  /** utm_campaign — 태깅했을 때만 존재 */
  campaign?: string;
  /** utm_content — 게시물 단위 구분용 */
  content?: string;
  /** utm_term */
  term?: string;
  /** 리퍼러 호스트(있을 때만). 디버깅·검증용 원본 단서 */
  referrerHost?: string;
  /** 인앱 브라우저 식별자. 웹 브라우저면 undefined */
  inAppBrowser?: string;
  /**
   * 판별 근거. utm | inapp | referrer | click_id | direct
   * GA4에서 "이 수치가 어디서 왔는지"를 되짚을 수 있어야 신뢰할 수 있다.
   */
  resolvedBy: "utm" | "inapp" | "referrer" | "click_id" | "direct";
};

/* ────────────────────────────────────────────────────────────
   1. 인앱 브라우저 판별
   ──────────────────────────────────────────────────────────── */

/**
 * User-Agent 토큰 → (인앱 식별자, GA4 source) 매핑.
 * 순서가 중요하다: 인스타그램 UA에도 FBAN이 섞이는 등 토큰이 겹치므로
 * 더 구체적인 앱을 먼저 검사한다. (Threads > Instagram > Facebook)
 */
const IN_APP_SIGNATURES: ReadonlyArray<{
  /** UA에서 찾을 토큰(소문자 비교) */
  token: string;
  /** 인앱 브라우저 식별자 */
  app: string;
  /** GA4 utm_source에 대응시킬 값 */
  source: string;
}> = [
  // Threads 앱의 내부 코드네임이 Barcelona다. Instagram 토큰보다 먼저 검사해야 한다.
  { token: "barcelona", app: "threads", source: "threads" },
  { token: "instagram", app: "instagram", source: "instagram" },
  { token: "kakaotalk", app: "kakaotalk", source: "kakaotalk" },
  { token: "kakaostory", app: "kakaostory", source: "kakaostory" },
  { token: "naver(inapp", app: "naver_app", source: "naver" },
  { token: "naversearchapp", app: "naver_app", source: "naver" },
  { token: "daumapps", app: "daum_app", source: "daum" },
  { token: "band/", app: "band", source: "band" },
  { token: "line/", app: "line", source: "line" },
  { token: "everytimeapp", app: "everytime", source: "everytime" },
  // TikTok 웹뷰는 BytedanceWebview / musical_ly 로 나타난다.
  { token: "bytedancewebview", app: "tiktok", source: "tiktok" },
  { token: "musical_ly", app: "tiktok", source: "tiktok" },
  { token: "twitter for", app: "twitter", source: "x" },
  { token: "twitterandroid", app: "twitter", source: "x" },
  // Facebook 계열 웹뷰 공통 토큰 — 위 구체 앱들이 모두 빗나간 뒤에만 매칭한다.
  { token: "fban", app: "facebook", source: "facebook" },
  { token: "fb_iab", app: "facebook", source: "facebook" },
  { token: "fbav", app: "facebook", source: "facebook" },
];

/**
 * User-Agent에서 인앱 브라우저를 판별한다.
 * 웹 브라우저이거나 UA가 비면 null.
 */
export function detectInAppBrowser(
  userAgent: string | undefined | null,
): { app: string; source: string } | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const sig of IN_APP_SIGNATURES) {
    if (ua.includes(sig.token)) return { app: sig.app, source: sig.source };
  }
  return null;
}

/* ────────────────────────────────────────────────────────────
   2. 리퍼러 도메인 정규화
   ──────────────────────────────────────────────────────────── */

/** 검색엔진 도메인 조각 → source. 매칭되면 medium=organic. */
const SEARCH_ENGINES: ReadonlyArray<[fragment: string, source: string]> = [
  ["google.", "google"],
  ["naver.", "naver"],
  ["daum.", "daum"],
  ["bing.", "bing"],
  ["yahoo.", "yahoo"],
  ["duckduckgo.", "duckduckgo"],
  ["yandex.", "yandex"],
  ["baidu.", "baidu"],
  ["ecosia.", "ecosia"],
  ["kagi.", "kagi"],
  ["zum.com", "zum"],
  ["nate.com", "nate"],
  ["search.brave.com", "brave"],
  // AI 검색 — GEO 유입을 일반 리퍼럴에 섞지 않고 따로 본다.
  ["chatgpt.com", "chatgpt"],
  ["chat.openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"],
  ["claude.ai", "claude"],
  ["gemini.google.com", "gemini"],
  ["copilot.microsoft.com", "copilot"],
];

/** 소셜 도메인 조각 → source. 매칭되면 medium=social. */
const SOCIAL_DOMAINS: ReadonlyArray<[fragment: string, source: string]> = [
  // 리다이렉터(l.threads.com 등)를 원 서비스로 접어 넣는다.
  ["threads.com", "threads"],
  ["threads.net", "threads"],
  ["instagram.com", "instagram"],
  ["facebook.com", "facebook"],
  ["fb.com", "facebook"],
  ["twitter.com", "x"],
  ["x.com", "x"],
  ["t.co", "x"],
  ["tiktok.com", "tiktok"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["reddit.com", "reddit"],
  ["linkedin.com", "linkedin"],
  ["pinterest.", "pinterest"],
  ["kakao.com", "kakaotalk"],
  ["kakaocdn.net", "kakaotalk"],
  ["band.us", "band"],
  ["line.me", "line"],
  ["discord.com", "discord"],
  ["t.me", "telegram"],
  ["telegram.org", "telegram"],
  ["dcinside.com", "dcinside"],
  ["fmkorea.com", "fmkorea"],
  ["theqoo.net", "theqoo"],
  ["ppomppu.co.kr", "ppomppu"],
  ["ruliweb.com", "ruliweb"],
  ["everytime.kr", "everytime"],
  ["clien.net", "clien"],
  ["inven.co.kr", "inven"],
];

/** URL 문자열에서 호스트만 뽑는다. 파싱 실패 시 null. */
export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    // 선행 www.는 그룹핑을 흐리므로 제거
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * 리퍼러 호스트를 (source, medium)으로 분류한다.
 * 자사 도메인이면 null(내부 이동은 유입이 아니다).
 */
export function classifyReferrerHost(
  referrerHost: string | null,
  selfHost: string | null,
): { source: string; medium: AttributionMedium } | null {
  if (!referrerHost) return null;
  // 자사 도메인 및 그 서브도메인은 유입원이 아니다.
  if (
    selfHost &&
    (referrerHost === selfHost || referrerHost.endsWith(`.${selfHost}`))
  ) {
    return null;
  }

  for (const [fragment, source] of SEARCH_ENGINES) {
    if (referrerHost.includes(fragment)) return { source, medium: "organic" };
  }
  for (const [fragment, source] of SOCIAL_DOMAINS) {
    if (referrerHost.includes(fragment)) return { source, medium: "social" };
  }
  return { source: referrerHost, medium: "referral" };
}

/* ────────────────────────────────────────────────────────────
   3. UTM · 클릭 ID 파싱
   ──────────────────────────────────────────────────────────── */

/** 광고 플랫폼 클릭 ID → (source, medium). UTM이 없을 때의 차선책. */
const CLICK_IDS: ReadonlyArray<[param: string, source: string, medium: string]> = [
  ["gclid", "google", "cpc"],
  ["gbraid", "google", "cpc"],
  ["wbraid", "google", "cpc"],
  ["fbclid", "facebook", "social"],
  ["igshid", "instagram", "social"],
  ["ttclid", "tiktok", "cpc"],
  ["msclkid", "bing", "cpc"],
  ["twclid", "x", "social"],
];

/** 값 정리 — 공백 절단, 소문자화, GA4 파라미터 길이 상한 적용. */
function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_PARAM_LENGTH);
  return trimmed ? trimmed.toLowerCase() : undefined;
}

/**
 * 쿼리스트링에서 UTM 5종을 읽는다.
 * `utm_source`가 없으면 관례적으로 쓰이는 `ref`/`source`도 함께 본다
 * (직접 만든 짧은 공유 링크 대응).
 */
export function parseUtm(search: string | URLSearchParams): {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
} {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;

  const source =
    clean(params.get("utm_source")) ??
    clean(params.get("ref")) ??
    clean(params.get("source"));

  return {
    source,
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
    term: clean(params.get("utm_term")),
  };
}

/** 쿼리스트링에서 광고 클릭 ID를 찾는다. */
function parseClickId(
  search: string | URLSearchParams,
): { source: string; medium: string } | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  for (const [param, source, medium] of CLICK_IDS) {
    if (params.get(param)) return { source, medium };
  }
  return null;
}

/* ────────────────────────────────────────────────────────────
   4. 최종 판별
   ──────────────────────────────────────────────────────────── */

export type ResolveInput = {
  /** 랜딩 URL의 쿼리스트링 (`window.location.search`) */
  search: string;
  /** `document.referrer` */
  referrer: string | null | undefined;
  /** `navigator.userAgent` */
  userAgent: string | null | undefined;
  /** 자사 호스트 (`window.location.hostname`) — 내부 이동 제외용 */
  selfHost: string | null | undefined;
};

/**
 * 유입 경로를 판별한다. 우선순위는 파일 상단 주석 참고.
 *
 * 인앱 브라우저 정보는 UTM으로 판별이 끝난 경우에도 함께 실어 보낸다.
 * "스레드에서 왔다"와 "스레드 인앱 브라우저로 보고 있다"는 다른 질문이고,
 * 후자는 PWA 설치 유도·외부 브라우저 안내 같은 UX 판단에 쓰인다.
 */
export function resolveAttribution(input: ResolveInput): Attribution {
  const { search, referrer, userAgent, selfHost } = input;

  const inApp = detectInAppBrowser(userAgent);
  const referrerHost = hostOf(referrer);
  const utm = parseUtm(search);

  const base = {
    campaign: utm.campaign,
    content: utm.content,
    term: utm.term,
    referrerHost: referrerHost ?? undefined,
    inAppBrowser: inApp?.app,
  };

  // 1) 우리가 직접 태깅한 UTM이 최우선.
  if (utm.source) {
    return {
      ...base,
      source: utm.source,
      // medium 미지정 시 인앱이면 social, 아니면 referral로 보수적 추정
      medium: utm.medium ?? (inApp ? "social" : "referral"),
      resolvedBy: "utm",
    };
  }

  // 2) 광고 클릭 ID.
  const clickId = parseClickId(search);
  if (clickId) {
    return {
      ...base,
      source: clickId.source,
      medium: utm.medium ?? clickId.medium,
      resolvedBy: "click_id",
    };
  }

  // 3) 인앱 브라우저 — 리퍼러가 비어도 앱을 특정할 수 있는 유일한 단서.
  if (inApp) {
    return {
      ...base,
      source: inApp.source,
      medium: utm.medium ?? "social",
      resolvedBy: "inapp",
    };
  }

  // 4) 리퍼러 도메인.
  const normalizedSelf = selfHost
    ? selfHost.toLowerCase().replace(/^www\./, "")
    : null;
  const classified = classifyReferrerHost(referrerHost, normalizedSelf);
  if (classified) {
    return {
      ...base,
      source: classified.source,
      medium: utm.medium ?? classified.medium,
      resolvedBy: "referrer",
    };
  }

  // 5) 단서 없음.
  return {
    ...base,
    source: DIRECT_SOURCE,
    medium: utm.medium ?? NONE_MEDIUM,
    resolvedBy: "direct",
  };
}

/* ────────────────────────────────────────────────────────────
   5. 최초·세션 유입 결정
   ──────────────────────────────────────────────────────────── */

/** 저장된 유입 기록 — 판별 결과 + 기록 시각. */
export type StoredAttribution = Attribution & { ts: number };

/** GA4 기본 세션 타임아웃과 맞춘다 — 두 도구의 세션 수가 어긋나지 않게. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type DecideTouchesInput = {
  /** 이번 랜딩에서 판별한 결과 */
  current: Attribution;
  /** localStorage에 있던 최초 유입 (없으면 null) */
  storedFirst: StoredAttribution | null;
  /** sessionStorage에 있던 세션 유입 (없으면 null) */
  storedSession: StoredAttribution | null;
  /** 현재 시각 (테스트 주입용) */
  now: number;
};

/**
 * 저장된 기록과 이번 랜딩을 합쳐 최초·세션 유입을 결정한다.
 *
 * 규칙 두 가지가 핵심이다.
 *  - 최초 유입은 한 번 기록하면 절대 덮어쓰지 않는다.
 *  - 세션이 살아 있는데 이번 랜딩에 새 단서가 없으면 기존 세션 유입원을 유지한다.
 *    (사이트 안에서 새로고침했다고 threads → (direct)로 바뀌면 안 된다)
 */
export function decideTouches(input: DecideTouchesInput): {
  firstTouch: StoredAttribution;
  sessionTouch: StoredAttribution;
  /** 새 세션인가 — traffic_source 이벤트 발사 여부를 가른다 */
  sessionExpired: boolean;
  /** 최초 유입을 새로 기록해야 하는가 */
  isNewUser: boolean;
} {
  const { current, storedFirst, storedSession, now } = input;

  const isNewUser = !storedFirst;
  const firstTouch: StoredAttribution = storedFirst ?? { ...current, ts: now };

  const sessionExpired =
    !storedSession || now - storedSession.ts > SESSION_TIMEOUT_MS;

  // 이번 랜딩에 실제 단서(UTM·클릭ID·인앱·리퍼러)가 있었는가
  const hasFreshSignal = current.resolvedBy !== "direct";

  const sessionTouch: StoredAttribution =
    sessionExpired || hasFreshSignal
      ? { ...current, ts: now }
      : { ...storedSession, ts: now };

  return { firstTouch, sessionTouch, sessionExpired, isNewUser };
}

/**
 * GA4 이벤트 파라미터로 평탄화한다.
 * `prefix`로 first_/session_ 네임스페이스를 나눠 하나의 이벤트에 함께 실을 수 있다.
 * undefined 값은 GA4에서 잡음이 되므로 제거한다.
 */
export function toGtagParams(
  attribution: Attribution,
  prefix = "",
): Record<string, string> {
  const raw: Record<string, string | undefined> = {
    [`${prefix}source`]: attribution.source,
    [`${prefix}medium`]: attribution.medium,
    [`${prefix}campaign`]: attribution.campaign,
    [`${prefix}content`]: attribution.content,
    [`${prefix}term`]: attribution.term,
    [`${prefix}referrer_host`]: attribution.referrerHost,
    [`${prefix}in_app_browser`]: attribution.inAppBrowser,
    [`${prefix}resolved_by`]: attribution.resolvedBy,
  };

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value) out[key] = value.slice(0, MAX_PARAM_LENGTH);
  }
  return out;
}
