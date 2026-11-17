import { createRequestDb } from "@/lib/db/request-db";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  documentLocaleFromPathname,
  getDocumentLanguage,
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
import { isCuratedCoreShortId } from "@/lib/curated-meme-ids";
import { shortIdFromParam } from "@/lib/labels";
import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";
import { withAllowlistedSearch } from "@/lib/safe-redirect";
import { retiredProductDocument } from "@/lib/retired-product-document";
import { retiredProductDecision } from "@/lib/retired-products";
import { isIndexableLocalizedDocument } from "@/lib/localized-document-eligibility";

const PUBLIC_MEME_STATUSES = ["approved", "limited"] as const;
const MEME_LOOKUP_TIMEOUT_MS = 1_500;
const PUBLIC_MEME_CANONICAL_SELECT =
  "id, short_id, slug, updated_at, meme_translations(locale, status, localized_slug, source_updated_at)" as const;
const PUBLIC_LOCALIZED_MEME_DOCUMENT_SELECT =
  "id, short_id, slug, updated_at, description, origin, usage_note, caution, usage_examples, meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status), meme_tags_map(tag_id), meme_translations(locale, status, localized_slug, title, summary, description, origin, source_updated_at)" as const;

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

type PublicLocalizedMemeDocumentRow = Omit<PublicMemeCanonicalRow, "meme_translations"> & {
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  usage_examples: unknown;
  meme_sources: Array<{
    source_url: string | null;
    hidden_from_public: boolean | null;
  }>;
  meme_contents: Array<{
    availability: string | null;
    moderation_status: string | null;
  }>;
  meme_tags_map: Array<{ tag_id: string }>;
  meme_translations: Array<{
    locale: string;
    status: string;
    localized_slug: string | null;
    title: string;
    summary: string;
    description: string;
    origin: string;
    source_updated_at: string;
  }>;
};

function localizedDocumentSlug(
  meme: PublicLocalizedMemeDocumentRow,
  locale: SeoContentLocale,
): string | null {
  const translation = meme.meme_translations.find(
    (candidate) => candidate.locale === locale,
  );
  if (!translation) return null;
  if (!isIndexableLocalizedDocument({
    baseUpdatedAt: meme.updated_at,
    original: meme,
    translation: {
      status: translation.status,
      sourceUpdatedAt: translation.source_updated_at,
      title: translation.title,
      summary: translation.summary,
      description: translation.description,
      origin: translation.origin,
    },
  })) return null;
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
  return path.startsWith("/admin") || path === "/submit"
    ? withAllowlistedSearch(path, searchParams)
    : path;
}

export type LandingNegotiationInput = {
  pathname: string;
  cookieValue: string | undefined;
  acceptLanguage?: string | null;
  userAgent?: string | null;
};

/**
 * `/` follows an explicit SEO locale cookie only. Accept-Language, crawler
 * UAs, and a missing cookie stay on the Korean home. The cookie itself is
 * written only by the language selector (`persistLocale`).
 */
export function resolveLandingRedirectLocale({
  pathname,
  cookieValue,
}: LandingNegotiationInput): SeoContentLocale | null {
  if (pathname !== "/") return null;
  return isSeoContentLocale(cookieValue) ? cookieValue : null;
}

/**
 * 로케일 헤더 전달과 인증 경로의 세션 갱신을 함께 처리한다.
 * 일반 페이지는 로케일 헤더만 설정하고 DB·세션 조회는 인증 경로로 한정한다.
 *
 * 로케일 우선순위: ① URL prefix ② ko. 쿠키·Accept-Language·prefetch는
 * 문서를 바꾸지 않는다. memecatch_locale은 언어 선택기만 기록한다.
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
    // A preference redirect must not refresh the cookie. Prefetch and RSC
    // requests used to persist the last localized hop.
    return NextResponse.redirect(url, 302);
  }

  const urlLocale = localeFromPathname(request.nextUrl.pathname);
  // The response body is Korean unless the URL addresses a translated document.
  // The locale cookie is not a document locale: prefetching /zh/explore must
  // not restyle the next unprefixed page.
  const requestedExportLocale = request.nextUrl.pathname.endsWith("/export")
    ? request.nextUrl.searchParams.get("locale")
    : null;
  const exportLocale = isSeoContentLocale(requestedExportLocale) ? requestedExportLocale : null;
  const contentLocale = documentLocaleFromPathname(request.nextUrl.pathname) ?? exportLocale ?? DEFAULT_LOCALE;
  const locale = urlLocale ?? DEFAULT_LOCALE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  const applyLocale = (response: NextResponse) => {
    response.headers.set("Content-Language", getDocumentLanguage(contentLocale));
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
        return applyLocale(
          await retiredProductDocument(retired.locale, {
            routeLocale: retired.routeLocale,
          }),
        );
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
  const needsAuth = path.startsWith("/my") || path.startsWith("/submit") || path.startsWith("/admin") || path === "/login";
  const detailMatch = path.match(/^\/memes\/([^/]+)$/);
  const detailKey = detailMatch?.[1] === "random" && !urlLocale ? null : detailMatch?.[1];
  const fetchMode = request.headers.get("sec-fetch-mode");
  const documentDetailKey = detailKey && (fetchMode === null || fetchMode === "navigate")
    ? detailKey
    : null;
  if (!needsAuth && !documentDetailKey) return response;

  const db = await createRequestDb(request);

  if (documentDetailKey) {
    try {
      const { data, error } = await db
        .from("memes")
        .select(urlLocale ? PUBLIC_LOCALIZED_MEME_DOCUMENT_SELECT : PUBLIC_MEME_CANONICAL_SELECT)
        .eq("short_id", shortIdFromParam(documentDetailKey))
        .in("moderation_status", [...PUBLIC_MEME_STATUSES])
        .limit(1)
        .abortSignal(AbortSignal.timeout(MEME_LOOKUP_TIMEOUT_MS)) as {
          data: (PublicMemeCanonicalRow | PublicLocalizedMemeDocumentRow)[] | null;
          error: { message: string } | null;
        };
      if (error) {
        console.warn("public_meme_existence_check_failed query_error");
      }
      const requestedShortId = shortIdFromParam(documentDetailKey);
      const rewriteMissingDocument = () => {
        const url = request.nextUrl.clone();
        url.pathname = "/__missing_public_meme__";
        return applyLocale(NextResponse.rewrite(url, {
          status: 404,
          request: { headers: requestHeaders },
        }));
      };
      if (
        !error &&
        data?.length === 0 &&
        (urlLocale !== null || !isCuratedCoreShortId(requestedShortId))
      ) {
        return rewriteMissingDocument();
      }
      const meme = !error ? data?.[0] : null;
      const canonicalSlug = meme
        ? urlLocale
          ? localizedDocumentSlug(meme as PublicLocalizedMemeDocumentRow, urlLocale)
          : meme.slug
        : null;
      if (meme && urlLocale && !canonicalSlug) {
        return rewriteMissingDocument();
      }
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
    const result = await db.auth.getUser();
    user = result.data.user;
    authFailed = Boolean(result.error);
  } catch {
    authFailed = true;
  }
  const gated = path.startsWith("/my") || path.startsWith("/submit");

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
    const { data: isOperator, error: operatorError } = await db.rpc("is_operator");
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
