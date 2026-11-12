import { createRequestDb } from "@/lib/db/request-db";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  getDocumentLanguage,
  isLocale,
  localeFromAcceptLanguage,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
} from "@/lib/i18n";
import {
  isSeoContentLocale,
  localizePath,
  parseLocalePath,
  stripLocalePath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import {
  buildPlusActionPremiumPath,
  buildPlusDailySignalPremiumPath,
  isSafePlusDailySignalFocusId,
  parsePlusActionPremiumSource,
  parsePlusDailySignalLocale,
} from "@/lib/plus-daily-signal-routing";
import {
  buildPlusOutcomeReplayPath,
  parsePlusOutcomeReplayRequest,
} from "@/lib/plus-outcome-replay-routing";
import { isCuratedCoreShortId } from "@/lib/curated-meme-ids";
import { shortIdFromParam } from "@/lib/labels";
import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";
import { withAllowlistedSearch } from "@/lib/safe-redirect";
import { retiredProductDocument } from "@/lib/retired-product-document";
import { retiredProductDecision } from "@/lib/retired-products";

const PUBLIC_MEME_STATUSES = ["approved", "limited"] as const;
const MEME_LOOKUP_TIMEOUT_MS = 1_500;
const PUBLIC_MEME_CANONICAL_SELECT =
  "id, short_id, slug, updated_at, meme_translations(locale, status, localized_slug, source_updated_at)" as const;

type PublicMemeCanonicalRow = {
  id: string;
  short_id: string;
  slug: string;
  updated_at: string;
  meme_translations: Array<{
    locale: string;
    status: string;
    localized_slug: string | null;
    source_updated_at: string;
  }>;
};

function sameStoredRevision(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function canonicalSlugForDocument(
  meme: PublicMemeCanonicalRow,
  locale: SeoContentLocale | null,
): string | null {
  if (!locale) return meme.slug;

  const translation = meme.meme_translations.find(
    (candidate) =>
      candidate.locale === locale &&
      candidate.status === "reviewed" &&
      sameStoredRevision(candidate.source_updated_at, meme.updated_at),
  );
  if (!translation) return null;
  return translation.localized_slug?.trim() || meme.slug;
}

function localeFromPathname(pathname: string): SeoContentLocale | null {
  const parsed = parseLocalePath(pathname);
  return parsed.hadLocalePrefix && isSeoContentLocale(parsed.locale) ? parsed.locale : null;
}

function pathWithoutLocalePrefix(pathname: string, locale: Locale | null): string {
  return locale ? stripLocalePath(pathname) : pathname;
}

function buildAuthReturnPath(path: string, searchParams: URLSearchParams): string {
  if (path !== "/premium") {
    return path.startsWith("/admin") || path === "/submit"
      ? withAllowlistedSearch(path, searchParams)
      : path;
  }

  const focus = searchParams.getAll("focus");
  const source = searchParams.getAll("from");
  const actionSource = source.length === 1 ? parsePlusActionPremiumSource(source[0]) : undefined;
  if (
    focus.length === 1 &&
    isSafePlusDailySignalFocusId(focus[0]) &&
    actionSource
  ) {
    const localeValues = searchParams.getAll("locale");
    if (localeValues.length > 1) return path;
    const locale =
      localeValues.length === 1 ? parsePlusDailySignalLocale(localeValues[0]) : undefined;
    return actionSource === "daily_signal"
      ? buildPlusDailySignalPremiumPath(focus[0], locale)
      : buildPlusActionPremiumPath(focus[0], locale, actionSource);
  }

  const replay = searchParams.getAll("replay");
  const replayLocale = searchParams.getAll("replay_locale");
  const replaySource = searchParams.getAll("from");
  const replayRequest = parsePlusOutcomeReplayRequest({
    shortId: replay,
    locale: replayLocale,
    source: replaySource.length === 1 ? replaySource[0] : replaySource,
    focus: searchParams.has("focus") ? searchParams.getAll("focus") : undefined,
    dailySignalLocale: searchParams.has("locale") ? searchParams.getAll("locale") : undefined,
  });
  if (replayRequest) {
    return buildPlusOutcomeReplayPath(replayRequest.shortId, replayRequest.locale) ?? path;
  }

  const checkout = searchParams.getAll("checkout");
  return checkout.length === 1 && checkout[0] === "return"
    ? `${path}?checkout=return`
    : path;
}

// ponytail: substring UA sniff, not a maintained bot-UA list — swap for a
// vetted crawler-detection package if false positives/negatives show up.
const BOT_UA_PATTERN = /bot|crawl|spider|slurp/i;

export type LandingNegotiationInput = {
  pathname: string;
  cookieValue: string | undefined;
  acceptLanguage: string | null;
  userAgent: string | null;
};

/**
 * 글로벌 피벗: 첫 방문(로케일 쿠키 없음) 루트 경로("/") 전용 언어 협상.
 * ko 계열 선호·기존 쿠키·봇 UA는 그대로 두고, 그 외 방문자는 지원 SEO
 * 로케일(en/ja/zh/zh-tw) 우선순위면 해당 로케일로, 그 외 비-ko 선호는 en으로
 * 보낸다. 순수 함수로 분리해 proxy 밖에서 단위 테스트한다.
 */
export function resolveLandingRedirectLocale({
  pathname,
  cookieValue,
  acceptLanguage,
  userAgent,
}: LandingNegotiationInput): SeoContentLocale | null {
  if (pathname !== "/") return null;
  if (cookieValue) return null;
  if (userAgent && BOT_UA_PATTERN.test(userAgent)) return null;

  const preferred = localeFromAcceptLanguage(acceptLanguage);
  if (preferred === "ko") return null;
  return isSeoContentLocale(preferred) ? preferred : "en";
}

/**
 * 로케일 헤더 전달과 인증 경로의 세션 갱신을 함께 처리한다.
 * 일반 페이지는 로케일 헤더만 설정하고 Supabase 호출은 인증 경로로 한정한다.
 *
 * 로케일 우선순위: ① 명시적 URL prefix ② 언어 선택 쿠키 ③ Accept-Language ④ ko.
 * URL prefix는 공유·색인 가능한 선택이므로 쿠키에도 동기화한다.
 */
export async function proxy(request: NextRequest) {
  const landingLocale = resolveLandingRedirectLocale({
    pathname: request.nextUrl.pathname,
    cookieValue: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
    userAgent: request.headers.get("user-agent"),
  });
  if (landingLocale) {
    const url = request.nextUrl.clone();
    url.pathname = localizePath("/", landingLocale);
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Vary", "Accept-Language");
    response.cookies.set(LOCALE_COOKIE, landingLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  const urlLocale = localeFromPathname(request.nextUrl.pathname);
  // `locale` is the UI preference passed to the app. The response body itself
  // is Korean unless the URL addresses an indexed translated document.
  const requestedExportLocale = request.nextUrl.pathname.endsWith("/export")
    ? request.nextUrl.searchParams.get("locale")
    : null;
  const exportLocale = isSeoContentLocale(requestedExportLocale) ? requestedExportLocale : null;
  const contentLocale = urlLocale ?? exportLocale ?? DEFAULT_LOCALE;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  // 접두사 없는 주소는 한국어 문서다. Accept-Language로 UI를 바꾸면
  // 서버는 영어 메뉴를 그리고, 클라이언트 스냅샷이 다시 한국어로 되돌린다.
  const locale = urlLocale ?? (isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  const applyLocale = (response: NextResponse) => {
    response.headers.set("Content-Language", getDocumentLanguage(contentLocale));
    if (urlLocale && cookieLocale !== urlLocale) {
      response.cookies.set(LOCALE_COOKIE, urlLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return response;
  };
  const retired = retiredProductDecision(request.nextUrl.pathname);
  if (retired) {
    switch (retired.type) {
      case "redirect": {
        // Same-origin absolute URL. Next relativizes Location before it is sent,
        // so the client sees `/en` or `/` and never the bind host. A cloned
        // nextUrl would keep a trailing slash from `/en/products/`.
        const url = new URL(retired.location, request.nextUrl.origin);
        return applyLocale(NextResponse.redirect(url, 308));
      }
      case "gone": {
        return applyLocale(await retiredProductDocument(retired.locale));
      }
      case "missing": {
        return applyLocale(new NextResponse(null, { status: 404 }));
      }
      default: {
        const unreachable: never = retired;
        return unreachable;
      }
    }
  }

  const nextResponse = () =>
    applyLocale(NextResponse.next({ request: { headers: requestHeaders } }));
  const response = nextResponse();

  const path = pathWithoutLocalePrefix(request.nextUrl.pathname, urlLocale);
  const authReturnPath = buildAuthReturnPath(path, request.nextUrl.searchParams);
  const needsAuth = path.startsWith("/my") || path.startsWith("/premium") || path.startsWith("/submit") || path.startsWith("/admin") || path === "/login";
  const detailMatch = path.match(/^\/memes\/([^/]+)$/);
  const detailKey = detailMatch?.[1] === "random" && !urlLocale ? null : detailMatch?.[1];
  const fetchMode = request.headers.get("sec-fetch-mode");
  const documentDetailKey = detailKey && (fetchMode === null || fetchMode === "navigate")
    ? detailKey
    : null;
  if (!needsAuth && !documentDetailKey) return response;

  const supabase = await createRequestDb(request);

  if (documentDetailKey) {
    try {
      const { data, error } = await supabase
        .from("memes")
        .select(PUBLIC_MEME_CANONICAL_SELECT)
        .eq("short_id", shortIdFromParam(documentDetailKey))
        .in("moderation_status", [...PUBLIC_MEME_STATUSES])
        .limit(1)
        .abortSignal(AbortSignal.timeout(MEME_LOOKUP_TIMEOUT_MS)) as {
          data: PublicMemeCanonicalRow[] | null;
          error: { message: string } | null;
        };
      if (error) {
        console.warn("public_meme_existence_check_failed query_error");
      }
      const requestedShortId = shortIdFromParam(documentDetailKey);
      if (!error && data?.length === 0 && !isCuratedCoreShortId(requestedShortId)) {
        const url = request.nextUrl.clone();
        url.pathname = "/__missing_public_meme__";
        return applyLocale(NextResponse.rewrite(url, {
          status: 404,
          request: { headers: requestHeaders },
        }));
      }
      const meme = !error ? data?.[0] : null;
      const canonicalSlug = meme ? canonicalSlugForDocument(meme, urlLocale) : null;
      if (meme && canonicalSlug) {
        const destination = canonicalMemeRedirectPath(documentDetailKey, {
          shortId: meme.short_id,
          slug: canonicalSlug,
          locale: urlLocale ?? "ko",
        }, "encoded");
        if (destination) {
          const url = request.nextUrl.clone();
          url.pathname = destination;
          return applyLocale(NextResponse.redirect(url, 308));
        }
      }
    } catch {
      // Fail open: a provider outage must not turn valid public content into a 404.
      console.warn("public_meme_existence_check_failed request_error");
    }
  }

  if (!needsAuth) return response;

  let user: { id: string } | null = null;
  let authFailed = false;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authFailed = Boolean(result.error);
  } catch {
    authFailed = true;
  }
  const gated = path.startsWith("/my") || path.startsWith("/premium") || path.startsWith("/submit");

  if ((authFailed || !user) && gated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", authReturnPath);
    return applyLocale(NextResponse.redirect(url));
  }

  if (path.startsWith("/admin")) {
    if (authFailed || !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", authReturnPath);
      return applyLocale(NextResponse.redirect(url));
    }
    // 서버측 운영자 검증 (D-1: 클라이언트 라우팅 숨김은 보안이 아님)
    const { data: isOperator, error: operatorError } = await supabase.rpc("is_operator");
    if (operatorError || isOperator !== true) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return applyLocale(NextResponse.redirect(url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|webmanifest)$).*)"],
};
