import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  localeFromAcceptLanguage,
  localeFromCountry,
} from "@/lib/i18n";

/**
 * 전역 언어 감지와 인증 경로의 세션 갱신을 함께 처리한다.
 * 일반 페이지는 로케일 헤더·쿠키만 설정하고 Supabase 호출은 인증 경로로 한정한다.
 */
export async function proxy(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : localeFromCountry(
        request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry")
      ) ?? localeFromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LOCALE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  function preserveLocaleCookie<T extends NextResponse>(nextResponse: T): T {
    if (!isLocale(cookieLocale)) nextResponse.cookies.set(LOCALE_COOKIE, locale, {
      path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
    });
    return nextResponse;
  }
  let response = preserveLocaleCookie(NextResponse.next({ request: { headers: requestHeaders } }));

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
          preserveLocaleCookie(response);
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
    return preserveLocaleCookie(NextResponse.redirect(url));
  }

  if (path.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return preserveLocaleCookie(NextResponse.redirect(url));
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
      return preserveLocaleCookie(NextResponse.redirect(url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|webmanifest)$).*)"],
};
