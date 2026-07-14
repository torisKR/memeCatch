import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/i18n";

/**
 * 로케일 헤더 전달과 인증 경로의 세션 갱신을 함께 처리한다.
 * 일반 페이지는 로케일 헤더만 설정하고 Supabase 호출은 인증 경로로 한정한다.
 *
 * 로케일은 사용자가 언어 선택기로 명시적으로 저장한 쿠키(memecatch_locale)가
 * 있을 때만 신뢰해 전달하고, 없으면 항상 ko를 사용한다.
 * IP 국가·Accept-Language 기반 자동 전환은 의도적으로 제거했다 — 본문(홈 히어로·
 * 밈 상세·탐색 등) 번역 커버리지가 확보되기 전까지는 크롬(헤더·푸터)만 번역된
 * "미완성 번역 사이트" 인상을 주므로, 언어 전환은 opt-in(명시 선택)만 허용한다.
 * 쿠키 저장도 proxy가 아니라 클라이언트 persistLocale(lib/i18n-client.ts)이
 * 사용자가 직접 언어를 고를 때만 수행한다.
 */
export async function proxy(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith("/my") || path.startsWith("/submit") || path.startsWith("/admin") || path === "/login";
  if (!needsAuth) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (path.startsWith("/my") || path.startsWith("/submit"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    // 서버측 운영자 검증 (D-1: 클라이언트 라우팅 숨김은 보안이 아님)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "operator") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|webmanifest)$).*)"],
};
