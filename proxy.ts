import { createServerClient } from "@supabase/ssr";
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
import { shortIdFromParam } from "@/lib/labels";
import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";
import { withAllowlistedSearch } from "@/lib/safe-redirect";

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
    return path.startsWith("/admin") || path === "/submit" || path === "/products/new"
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

export type LandingNegotiationInput = {
  pathname: string;
  cookieValue: string | undefined;
  acceptLanguage: string | null;
  userAgent: string | null;
};

/**
 * `/` is the stable Korean canonical. Language preference can customize UI,
 * but it must not hide that document behind an Accept-Language redirect.
 * Explicit `/en`, `/ja`, `/zh` and `/zh-tw` URLs remain the shareable choices.
 */
export function resolveLandingRedirectLocale(
  input: LandingNegotiationInput,
): null {
  void input;
  return null;
}

/**
 * 로케일 헤더 전달과 인증 경로의 세션 갱신을 함께 처리한다.
 * 일반 페이지는 로케일 헤더만 설정하고 Supabase 호출은 인증 경로로 한정한다.
 *
 * 로케일 우선순위: ① 명시적 URL prefix ② 언어 선택 쿠키 ③ Accept-Language ④ ko.
 * URL prefix는 공유·색인 가능한 선택이므로 쿠키에도 동기화한다.
 */
export async function proxy(request: NextRequest) {
  const urlLocale = localeFromPathname(request.nextUrl.pathname);
  // `locale` is the UI preference passed to the app. The response body itself
  // is Korean unless the URL addresses an indexed translated document.
  const requestedExportLocale = request.nextUrl.pathname.endsWith("/export")
    ? request.nextUrl.searchParams.get("locale")
    : null;
  const exportLocale = isSeoContentLocale(requestedExportLocale) ? requestedExportLocale : null;
  const contentLocale = urlLocale ?? exportLocale ?? DEFAULT_LOCALE;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = urlLocale ?? (isLocale(cookieLocale)
    ? cookieLocale
    : localeFromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LOCALE);
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
  const nextResponse = () =>
    applyLocale(NextResponse.next({ request: { headers: requestHeaders } }));
  let response = nextResponse();

  const path = pathWithoutLocalePrefix(request.nextUrl.pathname, urlLocale);
  const authReturnPath = buildAuthReturnPath(path, request.nextUrl.searchParams);
  const needsMemberAuth = path.startsWith("/my")
    || path.startsWith("/premium")
    || path.startsWith("/submit")
    || path === "/community/new"
    || path === "/products/new"
    || path === "/products/mine";
  const needsAuth = needsMemberAuth || path.startsWith("/admin") || path === "/login";
  const detailMatch = path.match(/^\/memes\/([^/]+)$/);
  const detailKey = detailMatch?.[1] === "random" && !urlLocale ? null : detailMatch?.[1];
  const fetchMode = request.headers.get("sec-fetch-mode");
  const needsPercentSlugRewrite = Boolean(detailKey && /^[a-z0-9]{8}-.*%25/i.test(detailKey));
  const documentDetailKey = detailKey && (fetchMode === null || fetchMode === "navigate" || needsPercentSlugRewrite)
    ? detailKey
    : null;
  if (!needsAuth && !documentDetailKey) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

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
      if (!error && data?.length === 0) {
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
          return applyLocale(NextResponse.redirect(url, 307));
        }
      }
    } catch {
      // Fail open: a provider outage must not turn valid public content into a 404.
      console.warn("public_meme_existence_check_failed request_error");
    }
    if (needsPercentSlugRewrite) {
      // Vercel's production dynamic-route launcher can decode a literal `%`
      // twice (observed: `failed to decode param` for a valid `%25` slug).
      // Route internally through a safe ASCII alias. The visible URL and the
      // page's DB-derived canonical stay unchanged; a slugged alias cannot
      // trigger the short-id -> canonical redirect and create a loop.
      const url = request.nextUrl.clone();
      url.pathname = localizePath(
        `/memes/${shortIdFromParam(documentDetailKey)}-encoded-slug`,
        urlLocale ?? "ko",
      );
      return applyLocale(NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      }));
    }
  }

  if (!needsAuth) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && needsMemberAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", authReturnPath);
    return applyLocale(NextResponse.redirect(url, 307));
  }

  if (path.startsWith("/admin")) {
    if (!user) {
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
