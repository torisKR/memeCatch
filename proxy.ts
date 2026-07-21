import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/i18n";

/**
 * 로케일 헤더 전달과 인증 경로의 세션 갱신을 함께 처리한다.
 * 일반 페이지는 로케일 헤더만 설정하고 Supabase 호출은 인증 경로로 한정한다.
 *
 * 로케일 우선순위: ① 언어 선택기로 저장한 쿠키(memecatch_locale)
 * ② 브라우저 Accept-Language(첫 방문 자동 감지) ③ ko.
 * 쿠키 저장은 클라이언트(persistLocale·LocaleAutoDetect)가 수행한다 —
 * proxy는 헤더 전달만 담당해 캐시/ISR에 영향을 주지 않는다.
 */
export async function proxy(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : localeFromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LOCALE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith("/my") || path.startsWith("/premium") || path.startsWith("/submit") || path.startsWith("/admin") || path === "/login";
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

  if (!user && (path.startsWith("/my") || path.startsWith("/premium") || path.startsWith("/submit"))) {
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
