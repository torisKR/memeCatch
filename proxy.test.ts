import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/i18n";
import { proxy, resolveLandingRedirectLocale } from "@/proxy";

const supabaseMocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  in: vi.fn(),
  limit: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  }),
}));

beforeEach(() => {
  supabaseMocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
  supabaseMocks.rpc.mockReset().mockResolvedValue({ data: false, error: null });
  supabaseMocks.abortSignal.mockReset().mockResolvedValue({ data: [{ id: "meme-1" }], error: null });
  const query = {
    select: supabaseMocks.select,
    eq: supabaseMocks.eq,
    in: supabaseMocks.in,
    limit: supabaseMocks.limit,
    abortSignal: supabaseMocks.abortSignal,
  };
  supabaseMocks.select.mockReset().mockReturnValue(query);
  supabaseMocks.eq.mockReset().mockReturnValue(query);
  supabaseMocks.in.mockReset().mockReturnValue(query);
  supabaseMocks.limit.mockReset().mockReturnValue(query);
  supabaseMocks.from.mockReset().mockReturnValue(query);
});

describe("proxy operator authorization", () => {
  it("removes private dashboard filters when a non-operator is redirected to the public site", async () => {
    supabaseMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "member-1" } } });
    const response = await proxy(publicRequest("/admin/activity?userId=81000000-0000-4000-8000-000000000003&subscribersOnly=1"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/");
    expect(destination.search).toBe("");
  });

  it("redirects an authenticated non-operator without reading profiles.role", async () => {
    supabaseMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "member-1" } } });

    const response = await proxy(publicRequest("/admin"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("is_operator");
    expect(supabaseMocks.from).not.toHaveBeenCalledWith("profiles");
  });

  it("allows an authenticated operator through the RPC authorization boundary", async () => {
    supabaseMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "operator-1" } } });
    supabaseMocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    const response = await proxy(publicRequest("/admin"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("is_operator");
  });
});

function publicRequest(
  pathname: string,
  {
    cookie,
    acceptLanguage,
    fetchMode,
    userAgent,
  }: { cookie?: string; acceptLanguage?: string; fetchMode?: string; userAgent?: string } = {},
) {
  return new NextRequest(`https://catchmeme.test${pathname}`, {
    headers: {
      ...(cookie ? { cookie: `${LOCALE_COOKIE}=${cookie}` } : {}),
      ...(acceptLanguage ? { "accept-language": acceptLanguage } : {}),
      ...(fetchMode ? { "sec-fetch-mode": fetchMode } : {}),
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

  it("uses the export query locale for a localized card response", async () => {
    const response = await proxy(publicRequest("/memes/m1/export?locale=en", { cookie: "ko" }));

    expect(response.headers.get("content-language")).toBe("en");
    expect(forwardedLocale(response)).toBe("ko");
  });
});

describe("proxy public meme existence check", () => {
  it.each([
    ["/memes/missing-meme", "ko"],
    ["/en/memes/missing-meme", "en"],
    ["/en/memes/random", "en"],
  ])("rewrites a confirmed missing exact detail %s to a branded 404", async (path, language) => {
    supabaseMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(publicRequest(path));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/__missing_public_meme__");
    expect(response.headers.get("content-language")).toBe(language);
    expect(supabaseMocks.from).toHaveBeenCalledWith("memes");
    expect(supabaseMocks.select).toHaveBeenCalledWith("id");
    expect(supabaseMocks.eq).toHaveBeenCalledWith(
      "short_id",
      path.endsWith("/random") ? "random" : "missing",
    );
    expect(supabaseMocks.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(supabaseMocks.limit).toHaveBeenCalledWith(1);
    expect(supabaseMocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("skips the lookup for a cors RSC or prefetch request", async () => {
    const response = await proxy(publicRequest("/en/memes/missing-meme", { fetchMode: "cors" }));

    expect(response.status).toBe(200);
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it.each([undefined, "navigate"])("checks a document request with fetch mode %s", async (fetchMode) => {
    supabaseMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(publicRequest("/en/memes/missing-meme", { fetchMode }));

    expect(response.status).toBe(404);
    expect(supabaseMocks.from).toHaveBeenCalledWith("memes");
  });

  it.each([
    "/memes/random",
    "/memes/meme-1/export",
    "/en/memes/meme-1/opengraph-image",
  ])("does not query nested or reserved meme route %s", async (path) => {
    const response = await proxy(publicRequest(path));

    expect(response.status).toBe(200);
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { message: "provider unavailable" } },
    { data: [], error: { message: "timeout" } },
  ])("fails open when the public lookup returns an error", async (result) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    supabaseMocks.abortSignal.mockResolvedValueOnce(result);

    const response = await proxy(publicRequest("/memes/meme-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "public_meme_existence_check_failed query_error",
    );
    expect(warn.mock.calls.flat().join(" ")).not.toContain(result.error.message);
    warn.mockRestore();
  });

  it("fails open when the public lookup throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const providerMessage = "network down";
    supabaseMocks.abortSignal.mockRejectedValueOnce(new Error(providerMessage));

    const response = await proxy(publicRequest("/memes/meme-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "public_meme_existence_check_failed request_error",
    );
    expect(warn.mock.calls.flat().join(" ")).not.toContain(providerMessage);
    warn.mockRestore();
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

describe("proxy auth return path", () => {
  it("preserves Daily Signal query params inside the login destination", async () => {
    const response = await proxy(
      publicRequest("/premium?focus=meme-1&locale=en&from=daily_signal"),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(
      "/premium?focus=meme-1&locale=en&from=daily_signal",
    );
  });

  it("preserves a Global Daily One-Cut query inside the login destination", async () => {
    const response = await proxy(
      publicRequest("/premium?focus=meme-1&locale=ja&from=global_daily"),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe(
      "/premium?focus=meme-1&locale=ja&from=global_daily",
    );
  });

  it("preserves a validated Outcome Replay query inside the login destination", async () => {
    const response = await proxy(
      publicRequest("/premium?replay=meme-1&replay_locale=en&from=outcome_history"),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe(
      "/premium?replay=meme-1&replay_locale=en&from=outcome_history",
    );
  });

  it("drops unknown Premium query params before building the login destination", async () => {
    const response = await proxy(
      publicRequest(
        "/premium?focus=meme-1&locale=en&from=daily_signal&email=private@example.com",
      ),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe(
      "/premium?focus=meme-1&locale=en&from=daily_signal",
    );
    expect(location.search).not.toContain("private@example.com");
  });

  it.each([
    "/premium?focus=meme-1&locale=en",
    "/premium?focus=meme-1&locale=en&from=other",
    "/premium?focus=meme-1&locale=en&from=daily_signal&from=other",
    "/premium?focus=meme-1&focus=meme-2&locale=en&from=daily_signal",
    "/premium?focus=meme-1&locale=en&locale=ja&from=daily_signal",
    "/premium?focus=meme-1&locale=en&from=global_daily&from=daily_signal",
    "/premium?focus=meme-1&focus=meme-2&locale=en&from=global_daily",
    "/premium?focus=meme-1&locale=en&locale=ja&from=global_daily",
  ])("does not trust an invalid or duplicated Daily Signal marker: %s", async (path) => {
    const response = await proxy(publicRequest(path));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/premium");
  });

  it.each([
    "/premium?replay=meme-1&replay_locale=en",
    "/premium?replay=meme-1&replay_locale=en&from=other",
    "/premium?replay=meme-1&replay=meme-2&replay_locale=en&from=outcome_history",
    "/premium?replay=meme-1&replay_locale=fr&from=outcome_history",
  ])("does not trust an invalid or duplicated Outcome Replay marker: %s", async (path) => {
    const response = await proxy(publicRequest(path));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/premium");
  });

  it("preserves only the checkout return marker for a checkout resume", async () => {
    const response = await proxy(
      publicRequest("/premium?checkout=return&email=private@example.com"),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/premium?checkout=return");
  });

  it("preserves the unsourced admin queue query inside the login destination", async () => {
    const response = await proxy(
      publicRequest("/admin/memes?focus=unsourced&email=private@example.com"),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/admin/memes?focus=unsourced");
    expect(location.search).not.toContain("private@example.com");
  });
});
