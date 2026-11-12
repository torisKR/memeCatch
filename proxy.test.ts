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

const BASE_UPDATED_AT = "2026-09-20T00:00:00Z";

function publicMemeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "meme-1",
    short_id: "meme",
    slug: "1",
    updated_at: BASE_UPDATED_AT,
    meme_translations: [],
    ...overrides,
  };
}

vi.mock("@/lib/db/request-db", () => ({
  createRequestDb: async () => ({
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  }),
}));

beforeEach(() => {
  supabaseMocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
  supabaseMocks.rpc.mockReset().mockResolvedValue({ data: false, error: null });
  supabaseMocks.abortSignal.mockReset().mockResolvedValue({
    data: [publicMemeRow()],
    error: null,
  });
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

  it("rejects an operator lookup error even if data is truthy", async () => {
    supabaseMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "operator-1" } } });
    supabaseMocks.rpc.mockResolvedValueOnce({ data: true, error: { message: "unavailable" } });
    const response = await proxy(publicRequest("/admin/activity"));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
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
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps an unprefixed page Korean when Accept-Language prefers another language", async () => {
    const response = await proxy(
      publicRequest("/explore", { acceptLanguage: "ja-JP,ko-KR;q=0.8" }),
    );

    expect(response.headers.get("content-language")).toBe("ko");
    expect(forwardedLocale(response)).toBe("ko");
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });

  it("keeps an unprefixed page Korean when a stale locale cookie is present", async () => {
    const response = await proxy(
      publicRequest("/explore", {
        cookie: "zh-tw",
        acceptLanguage: "en-US,en;q=0.9",
      }),
    );

    expect(response.headers.get("content-language")).toBe("ko");
    expect(forwardedLocale(response)).toBe("ko");
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });

  it("uses a document language tag while storing the URL locale key", async () => {
    const response = await proxy(publicRequest("/zh-tw/explore", { cookie: "en" }));

    expect(response.headers.get("content-language")).toBe("zh-Hant");
    expect(forwardedLocale(response)).toBe("zh-tw");
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses the export query locale for a localized card response", async () => {
    const response = await proxy(publicRequest("/memes/m1/export?locale=en", { cookie: "ko" }));

    expect(response.headers.get("content-language")).toBe("en");
    expect(forwardedLocale(response)).toBe("ko");
  });
});

describe("proxy public meme existence check", () => {
  it.each([
    ["/memes/gjq95suv", "/memes/gjq95suv-%ED%95%9C%EA%B5%AD-%EB%B0%88"],
    ["/memes/gjq95suv-old-slug", "/memes/gjq95suv-%ED%95%9C%EA%B5%AD-%EB%B0%88"],
  ])("308-redirects a confirmed Korean alias %s to its stored canonical path", async (path, expected) => {
    supabaseMocks.abortSignal.mockResolvedValueOnce({
      data: [publicMemeRow({ short_id: "gjq95suv", slug: "한국-밈" })],
      error: null,
    });

    const response = await proxy(publicRequest(path));

    expect(response.status).toBe(308);
    expect(new URL(response.headers.get("location")!).pathname).toBe(expected);
  });

  it.each([
    "/memes/gjq95suv-current",
    "/memes/gjq95suv-%ED%95%9C%EA%B5%AD-%EB%B0%88",
  ])("does not redirect an exact canonical key %s", async (path) => {
    const slug = path.includes("gjq95suv-current") ? "current" : "한국-밈";
    supabaseMocks.abortSignal.mockResolvedValueOnce({
      data: [publicMemeRow({ short_id: "gjq95suv", slug })],
      error: null,
    });

    const response = await proxy(publicRequest(path));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("308-redirects a localized alias to the current stored localized slug", async () => {
    supabaseMocks.abortSignal.mockResolvedValueOnce({
      data: [
        publicMemeRow({
          short_id: "gjq95suv",
          slug: "한국-밈",
          meme_translations: [
            {
              locale: "ja",
              status: "reviewed",
              localized_slug: "現在の名前",
              source_updated_at: BASE_UPDATED_AT,
            },
          ],
        }),
      ],
      error: null,
    });

    const response = await proxy(publicRequest("/ja/memes/gjq95suv-old"));

    expect(response.status).toBe(308);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/ja/memes/gjq95suv-%E7%8F%BE%E5%9C%A8%E3%81%AE%E5%90%8D%E5%89%8D",
    );
  });

  it.each([
    { name: "missing", memeTranslations: [] },
    {
      name: "stale",
      memeTranslations: [{
        locale: "ja",
        status: "stale",
        localized_slug: "古い名前",
        source_updated_at: BASE_UPDATED_AT,
      }],
    },
    {
      name: "outdated",
      memeTranslations: [{
        locale: "ja",
        status: "reviewed",
        localized_slug: "古い名前",
        source_updated_at: "2026-09-01T00:00:00Z",
      }],
    },
  ])("does not redirect an unavailable localized document ($name)", async ({ memeTranslations }) => {
    supabaseMocks.abortSignal.mockResolvedValueOnce({
      data: [
        publicMemeRow({
          short_id: "gjq95suv",
          slug: "한국-밈",
          meme_translations: memeTranslations,
        }),
      ],
      error: null,
    });

    const response = await proxy(publicRequest("/ja/memes/gjq95suv-old"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("fails open without canonicalizing an alias when lookup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    supabaseMocks.abortSignal.mockResolvedValueOnce({
      data: null,
      error: { message: "provider unavailable" },
    });

    const response = await proxy(publicRequest("/memes/gjq95suv-wrong"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "public_meme_existence_check_failed query_error",
    );
    warn.mockRestore();
  });

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
    expect(supabaseMocks.select).toHaveBeenCalledWith(
      "id, short_id, slug, updated_at, meme_translations(locale, status, localized_slug, source_updated_at)",
    );
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

  it("keeps a curated home-card slug reachable when the catalog has no matching row", async () => {
    supabaseMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(publicRequest("/memes/jkm2022k-jung-kkuk-ma"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
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

describe("resolveLandingRedirectLocale", () => {
  it("keeps the Korean home when Accept-Language prefers English and no cookie is set", () => {
    expect(resolveLandingRedirectLocale({
      pathname: "/",
      cookieValue: undefined,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "Mozilla/5.0",
    })).toBeNull();
  });

  it.each(["en", "ja", "zh", "zh-tw"] as const)(
    "redirects / only for an explicit %s cookie",
    (cookieValue) => {
      expect(resolveLandingRedirectLocale({
        pathname: "/",
        cookieValue,
        acceptLanguage: "ko-KR",
      })).toBe(cookieValue);
    },
  );

  it("does not redirect a ko cookie or a non-SEO cookie", () => {
    expect(resolveLandingRedirectLocale({ pathname: "/", cookieValue: "ko" })).toBeNull();
    expect(resolveLandingRedirectLocale({ pathname: "/", cookieValue: "th" })).toBeNull();
  });

  it("does not redirect paths other than the exact root", () => {
    expect(resolveLandingRedirectLocale({
      pathname: "/explore",
      cookieValue: "en",
      acceptLanguage: "en-US,en;q=0.9",
    })).toBeNull();
  });
});

describe("proxy landing redirect", () => {
  it("serves Korean / with Accept-Language en and does not set a locale cookie", async () => {
    const response = await proxy(publicRequest("/", { acceptLanguage: "en-US,en;q=0.9" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("vary")).toBeNull();
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("redirects / when the visitor explicitly chose an SEO locale cookie, without rewriting it", async () => {
    const response = await proxy(publicRequest("/", { cookie: "en", acceptLanguage: "ko-KR" }));

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/en");
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not redirect a ko cookie on /", async () => {
    const response = await proxy(publicRequest("/", { cookie: "ko", acceptLanguage: "en-US,en;q=0.9" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });
});

describe("proxy locale cookie", () => {
  const speculativeHeaders: Array<Record<string, string>> = [
    { "next-router-prefetch": "1", rsc: "1" },
    { RSC: "1" },
    { purpose: "prefetch" },
    { "sec-purpose": "prefetch" },
    { "next-router-segment-prefetch": "/zh/pricing" },
  ];

  it.each(speculativeHeaders)("does not set memecatch_locale on a speculative /zh/pricing request %j", async (headers) => {
    const response = await proxy(new NextRequest("https://catchmeme.test/zh/pricing", { headers }));

    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not set memecatch_locale on a full navigation to a prefixed route", async () => {
    const response = await proxy(publicRequest("/zh/pricing"));

    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not set memecatch_locale on a localized canonical redirect", async () => {
    supabaseMocks.abortSignal.mockResolvedValueOnce({
      data: [
        publicMemeRow({
          short_id: "gjq95suv",
          slug: "한국-밈",
          meme_translations: [
            {
              locale: "zh",
              status: "reviewed",
              localized_slug: "当前名称",
              source_updated_at: BASE_UPDATED_AT,
            },
          ],
        }),
      ],
      error: null,
    });

    const response = await proxy(publicRequest("/zh/memes/gjq95suv-old"));

    expect(response.status).toBe(308);
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("proxy auth return path", () => {
  it("preserves the searched meme name through submission login", async () => {
    const name = "zzqxv7239 & 회귀테스트";
    const query = new URLSearchParams({ name, email: "private@example.com", q: "other" });
    const response = await proxy(publicRequest(`/submit?${query}`));
    const location = new URL(response.headers.get("location")!);
    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(`/submit?${new URLSearchParams({ name })}`);
    expect(location.search).not.toContain("private");
  });

  it("drops duplicated names before submission login", async () => {
    const response = await proxy(publicRequest("/submit?name=first&name=second"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/submit");
  });

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
