import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/i18n";
import { proxy, resolveLandingRedirectLocale } from "@/proxy";

function publicRequest(
  pathname: string,
  {
    cookie,
    acceptLanguage,
    userAgent,
  }: { cookie?: string; acceptLanguage?: string; userAgent?: string } = {},
) {
  return new NextRequest(`https://catchmeme.test${pathname}`, {
    headers: {
      ...(cookie ? { cookie: `${LOCALE_COOKIE}=${cookie}` } : {}),
      ...(acceptLanguage ? { "accept-language": acceptLanguage } : {}),
      ...(userAgent ? { "user-agent": userAgent } : {}),
    },
  });
}

function forwardedLocale(response: Response): string | null {
  return response.headers.get(`x-middleware-request-${LOCALE_HEADER}`);
}

describe("proxy locale contract", () => {
  it("gives an explicit locale path priority over cookie and Accept-Language", async () => {
    const response = await proxy(
      publicRequest("/en/explore?sort=latest", {
        cookie: "ko",
        acceptLanguage: "ja-JP,ja;q=0.9",
      }),
    );

    expect(response.headers.get("content-language")).toBe("en");
    expect(forwardedLocale(response)).toBe("en");
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
  });

  it("keeps unprefixed response content Korean while forwarding Accept-Language as UI preference", async () => {
    const response = await proxy(
      publicRequest("/explore", { acceptLanguage: "ja-JP,ko-KR;q=0.8" }),
    );

    expect(response.headers.get("content-language")).toBe("ko");
    expect(forwardedLocale(response)).toBe("ja");
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });

  it("keeps a valid cookie ahead of Accept-Language without mislabelling Korean content", async () => {
    const response = await proxy(
      publicRequest("/explore", {
        cookie: "zh-tw",
        acceptLanguage: "en-US,en;q=0.9",
      }),
    );

    expect(response.headers.get("content-language")).toBe("ko");
    expect(forwardedLocale(response)).toBe("zh-tw");
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });

  it("uses a document language tag while storing the URL locale key", async () => {
    const response = await proxy(publicRequest("/zh-tw/explore", { cookie: "en" }));

    expect(response.headers.get("content-language")).toBe("zh-Hant");
    expect(forwardedLocale(response)).toBe("zh-tw");
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("zh-tw");
  });
});

// 순수 협상 함수 단위 테스트 — 글로벌 피벗: 첫 방문 비한국어 브라우저는 "/en"(또는
// 지원 로케일)으로 보내고, ko 선호·기존 쿠키·봇 UA·비루트 경로는 리다이렉트하지 않는다.
describe("resolveLandingRedirectLocale", () => {
  it("does not redirect a Korean-preferring browser away from the root", () => {
    // Arrange
    const input = {
      pathname: "/",
      cookieValue: undefined,
      acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.5",
      userAgent: "Mozilla/5.0",
    };

    // Act
    const result = resolveLandingRedirectLocale(input);

    // Assert
    expect(result).toBeNull();
  });

  it("redirects a first-time English-preferring browser to en", () => {
    // Arrange
    const input = {
      pathname: "/",
      cookieValue: undefined,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "Mozilla/5.0",
    };

    // Act
    const result = resolveLandingRedirectLocale(input);

    // Assert
    expect(result).toBe("en");
  });

  it.each([
    ["ja-JP,ja;q=0.9", "ja"],
    ["zh-CN,zh;q=0.9", "zh"],
    ["zh-TW,zh-Hant;q=0.9", "zh-tw"],
  ] as const)("routes a %s preference straight to its supported SEO locale (%s)", (acceptLanguage, expected) => {
    // Arrange
    const input = { pathname: "/", cookieValue: undefined, acceptLanguage, userAgent: "Mozilla/5.0" };

    // Act
    const result = resolveLandingRedirectLocale(input);

    // Assert
    expect(result).toBe(expected);
  });

  it("falls back to en for a preferred language without a dedicated SEO route", () => {
    // Arrange
    const input = {
      pathname: "/",
      cookieValue: undefined,
      acceptLanguage: "fr-FR,fr;q=0.9",
      userAgent: "Mozilla/5.0",
    };

    // Act
    const result = resolveLandingRedirectLocale(input);

    // Assert
    expect(result).toBe("en");
  });

  it("does not redirect once a locale cookie already exists, even if it is ko (cookie priority)", () => {
    // Arrange — mirrors a returning visitor who picked ko from the language selector
    const input = {
      pathname: "/",
      cookieValue: "ko",
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "Mozilla/5.0",
    };

    // Act
    const result = resolveLandingRedirectLocale(input);

    // Assert
    expect(result).toBeNull();
  });

  it("does not redirect recognized crawler user agents", () => {
    // Arrange
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; SomeOtherCrawler/1.0)",
    ];

    // Act
    const results = bots.map((userAgent) =>
      resolveLandingRedirectLocale({
        pathname: "/",
        cookieValue: undefined,
        acceptLanguage: "en-US,en;q=0.9",
        userAgent,
      }),
    );

    // Assert
    expect(results).toEqual(bots.map(() => null));
  });

  it("does not redirect paths other than the exact root", () => {
    // Arrange
    const input = {
      pathname: "/explore",
      cookieValue: undefined,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "Mozilla/5.0",
    };

    // Act
    const result = resolveLandingRedirectLocale(input);

    // Assert
    expect(result).toBeNull();
  });
});

describe("proxy landing redirect", () => {
  it("302-redirects a first-time non-Korean browser from / to /en with cookie and Vary set", async () => {
    // Arrange
    const request = publicRequest("/", { acceptLanguage: "en-US,en;q=0.9" });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/en");
    expect(response.headers.get("vary")).toBe("Accept-Language");
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
  });

  it("does not redirect a Korean-preferring browser landing on /", async () => {
    // Arrange
    const request = publicRequest("/", { acceptLanguage: "ko-KR,ko;q=0.9" });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect a returning visitor who already carries a locale cookie", async () => {
    // Arrange
    const request = publicRequest("/", { cookie: "ko", acceptLanguage: "en-US,en;q=0.9" });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect Googlebot even without a locale cookie", async () => {
    // Arrange
    const request = publicRequest("/", {
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.headers.get("location")).toBeNull();
  });
});
