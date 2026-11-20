import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/i18n";
import { proxy, resolveLandingRedirectLocale } from "@/proxy";

const dbMocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  createPublicDeadlineDb: vi.fn(),
  createRequestDb: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  in: vi.fn(),
  limit: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}));

const BASE_UPDATED_AT = "2026-09-20T00:00:00Z";
const INDEXABLE_DESCRIPTION = "밈".repeat(260);

function publicMemeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "meme-1",
    short_id: "meme",
    slug: "1",
    updated_at: BASE_UPDATED_AT,
    description: INDEXABLE_DESCRIPTION,
    origin: "밈의 구체적인 유래와 확산 과정을 설명하는 검수된 원문입니다.",
    usage_note: null,
    caution: null,
    usage_examples: null,
    meme_sources: [
      { source_url: "https://example.com/source-1" },
      { source_url: "https://example.com/source-2" },
    ],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "a" }, { tag_id: "b" }, { tag_id: "c" }],
    meme_translations: [],
    ...overrides,
  };
}

function localizedTranslation(overrides: Record<string, unknown> = {}) {
  return {
    locale: "ja",
    status: "reviewed",
    localized_slug: "現在の名前",
    title: "翻訳タイトル",
    summary: "翻訳要約",
    description: "翻訳説明",
    origin: "翻訳由来",
    source_updated_at: BASE_UPDATED_AT,
    ...overrides,
  };
}

vi.mock("@/lib/db/request-db", () => ({
  createPublicDeadlineDb: dbMocks.createPublicDeadlineDb,
  createRequestDb: dbMocks.createRequestDb,
}));

beforeEach(() => {
  dbMocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
  dbMocks.rpc.mockReset().mockResolvedValue({ data: false, error: null });
  dbMocks.abortSignal.mockReset().mockResolvedValue({
    data: [publicMemeRow()],
    error: null,
  });
  const query = {
    select: dbMocks.select,
    eq: dbMocks.eq,
    in: dbMocks.in,
    limit: dbMocks.limit,
    abortSignal: dbMocks.abortSignal,
  };
  dbMocks.select.mockReset().mockReturnValue(query);
  dbMocks.eq.mockReset().mockReturnValue(query);
  dbMocks.in.mockReset().mockReturnValue(query);
  dbMocks.limit.mockReset().mockReturnValue(query);
  dbMocks.from.mockReset().mockReturnValue(query);
  dbMocks.createPublicDeadlineDb.mockReset().mockResolvedValue({
    from: dbMocks.from,
    rpc: dbMocks.rpc,
  });
  dbMocks.createRequestDb.mockReset().mockResolvedValue({
    auth: { getUser: dbMocks.getUser },
    from: dbMocks.from,
    rpc: dbMocks.rpc,
  });
});

describe("proxy operator authorization", () => {
  it("removes private dashboard filters when a non-operator is redirected to the public site", async () => {
    dbMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "member-1" } } });
    const response = await proxy(publicRequest("/admin/activity?userId=81000000-0000-4000-8000-000000000003&subscribersOnly=1"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/");
    expect(destination.search).toBe("");
  });

  it("redirects an authenticated non-operator without reading profiles.role", async () => {
    dbMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "member-1" } } });

    const response = await proxy(publicRequest("/admin"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
    expect(dbMocks.rpc).toHaveBeenCalledWith("is_operator");
    expect(dbMocks.from).not.toHaveBeenCalledWith("profiles");
  });

  it("allows an authenticated operator through the RPC authorization boundary", async () => {
    dbMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "operator-1" } } });
    dbMocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    const response = await proxy(publicRequest("/admin"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(dbMocks.rpc).toHaveBeenCalledWith("is_operator");
  });

  it("rejects an operator lookup error even if data is truthy", async () => {
    dbMocks.getUser.mockResolvedValueOnce({ data: { user: { id: "operator-1" } } });
    dbMocks.rpc.mockResolvedValueOnce({ data: true, error: { message: "unavailable" } });
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
    dbMocks.abortSignal.mockResolvedValueOnce({
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
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: [publicMemeRow({ short_id: "gjq95suv", slug })],
      error: null,
    });

    const response = await proxy(publicRequest(path));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("308-redirects a localized alias to the current stored localized slug", async () => {
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: [
        publicMemeRow({
          short_id: "gjq95suv",
          slug: "한국-밈",
          meme_translations: [localizedTranslation()],
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

  it.each(["cssqxwmb", "9ajbp6w6"])(
    "resolves canonical duplicate %s before checking localized eligibility",
    async (duplicateShortId) => {
      dbMocks.abortSignal.mockResolvedValueOnce({
        data: [
          publicMemeRow({
            short_id: "gnact78h",
            slug: "히딩크-나는-아직-배가-고프다",
            meme_translations: [localizedTranslation()],
          }),
        ],
        error: null,
      });

      const response = await proxy(
        publicRequest(`/ja/memes/${duplicateShortId}-duplicate`),
      );

      expect(dbMocks.eq).toHaveBeenCalledWith("short_id", "gnact78h");
      expect(response.status).toBe(308);
      expect(new URL(response.headers.get("location")!).pathname).toBe(
        "/ja/memes/gnact78h-%E7%8F%BE%E5%9C%A8%E3%81%AE%E5%90%8D%E5%89%8D",
      );
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );

  it("passes the missing-meme page through so the standalone rewrite fetch cannot loop", async () => {
    const response = await proxy(publicRequest("/missing-public-meme"));

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(dbMocks.eq).not.toHaveBeenCalled();
  });

  it.each(["cssqxwmb", "9ajbp6w6"])(
    "rewrites missing Korean canonical duplicate %s instead of serving the target fallback",
    async (duplicateShortId) => {
      dbMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

      const response = await proxy(
        publicRequest(`/memes/${duplicateShortId}-duplicate`),
      );

      expect(dbMocks.eq).toHaveBeenCalledWith("short_id", "gnact78h");
      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/missing-public-meme",
      );
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("keeps the Korean curated fallback for the requested canonical representative", async () => {
    dbMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(
      publicRequest("/memes/gnact78h-hidink-hungry"),
    );

    expect(dbMocks.eq).toHaveBeenCalledWith("short_id", "gnact78h");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["cssqxwmb", "9ajbp6w6"])(
    "308-redirects Korean canonical duplicate %s when the representative row exists",
    async (duplicateShortId) => {
      dbMocks.abortSignal.mockResolvedValueOnce({
        data: [
          publicMemeRow({
            short_id: "gnact78h",
            slug: "히딩크-나는-아직-배가-고프다",
          }),
        ],
        error: null,
      });

      const response = await proxy(
        publicRequest(`/memes/${duplicateShortId}-duplicate`),
      );

      expect(response.status).toBe(308);
      expect(new URL(response.headers.get("location")!).pathname).toBe(
        "/memes/gnact78h-%ED%9E%88%EB%94%A9%ED%81%AC-%EB%82%98%EB%8A%94-%EC%95%84%EC%A7%81-%EB%B0%B0%EA%B0%80-%EA%B3%A0%ED%94%84%EB%8B%A4",
      );
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );

  it("rewrites a canonical duplicate when the target translation is unavailable", async () => {
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: [
        publicMemeRow({
          short_id: "gnact78h",
          slug: "히딩크-나는-아직-배가-고프다",
          meme_translations: [],
        }),
      ],
      error: null,
    });

    const response = await proxy(publicRequest("/ja/memes/cssqxwmb-duplicate"));

    expect(dbMocks.eq).toHaveBeenCalledWith("short_id", "gnact78h");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/missing-public-meme",
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("fails open for a canonical duplicate when the target lookup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: null,
      error: { message: "provider unavailable" },
    });

    const response = await proxy(publicRequest("/ja/memes/9ajbp6w6-duplicate"));

    expect(dbMocks.eq).toHaveBeenCalledWith("short_id", "gnact78h");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "public_meme_existence_check_failed query_error",
    );
    expect(warn.mock.calls.flat().join(" ")).not.toContain("provider unavailable");
    warn.mockRestore();
  });

  it("returns at the hard deadline when the database lookup never settles", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    dbMocks.abortSignal.mockImplementationOnce(
      () => new Promise<never>(() => undefined),
    );

    try {
      const responsePromise = proxy(publicRequest("/ja/memes/cssqxwmb-duplicate"));
      await vi.advanceTimersByTimeAsync(1_500);
      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(dbMocks.eq).toHaveBeenCalledWith("short_id", "gnact78h");
      const signal = dbMocks.abortSignal.mock.calls[0]?.[0] as AbortSignal;
      expect(signal.aborted).toBe(true);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        "public_meme_existence_check_failed deadline_exceeded",
      );
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("returns at the hard deadline when the isolated public database initialization never settles", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    dbMocks.createPublicDeadlineDb.mockImplementationOnce(
      () => new Promise<never>(() => undefined),
    );

    try {
      const responsePromise = proxy(publicRequest("/ja/memes/cssqxwmb-duplicate"));
      await vi.advanceTimersByTimeAsync(1_500);
      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(dbMocks.from).not.toHaveBeenCalled();
      expect(dbMocks.createRequestDb).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        "public_meme_existence_check_failed deadline_exceeded",
      );
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("serves an exact eligible localized canonical key without rewriting", async () => {
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: [
        publicMemeRow({
          short_id: "gjq95suv",
          slug: "한국-밈",
          meme_translations: [localizedTranslation()],
        }),
      ],
      error: null,
    });

    const response = await proxy(
      publicRequest("/ja/memes/gjq95suv-%E7%8F%BE%E5%9C%A8%E3%81%AE%E5%90%8D%E5%89%8D"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it.each([
    { name: "missing", memeTranslations: [] },
    {
      name: "stale",
      memeTranslations: [localizedTranslation({ status: "stale", localized_slug: "古い名前" })],
    },
    {
      name: "outdated",
      memeTranslations: [localizedTranslation({
        localized_slug: "古い名前",
        source_updated_at: "2026-09-01T00:00:00Z",
      })],
    },
  ])("rewrites an unavailable localized document before streaming ($name)", async ({ memeTranslations }) => {
    dbMocks.abortSignal.mockResolvedValueOnce({
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

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toContain("/missing-public-meme");
  });

  it.each([
    {
      name: "thin Korean source",
      row: publicMemeRow({
        description: "짧은 설명",
        origin: "짧은 유래",
        meme_sources: [],
        meme_contents: [],
        meme_tags_map: [],
        meme_translations: [localizedTranslation()],
      }),
    },
    {
      name: "blank required translation field",
      row: publicMemeRow({
        meme_translations: [localizedTranslation({ description: " " })],
      }),
    },
    {
      name: "hidden sources do not create index eligibility",
      row: publicMemeRow({
        description: "밈".repeat(75),
        origin: "유래".repeat(15),
        meme_sources: [
          {
            source_url: "https://example.com/source-1",
            hidden_from_public: true,
          },
          {
            source_url: "https://example.com/source-2",
            hidden_from_public: true,
          },
        ],
        meme_translations: [localizedTranslation()],
      }),
    },
  ])("rewrites a confirmed ineligible localized document ($name)", async ({ row }) => {
    dbMocks.abortSignal.mockResolvedValueOnce({ data: [row], error: null });

    const response = await proxy(publicRequest("/ja/memes/gjq95suv-old"));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/missing-public-meme");
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the existing Korean canonical policy even when localized depth eligibility fails", async () => {
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: [publicMemeRow({
        short_id: "gjq95suv",
        slug: "한국-밈",
        description: "짧은 설명",
        origin: "짧은 유래",
        meme_sources: [],
        meme_contents: [],
        meme_tags_map: [],
      })],
      error: null,
    });

    const response = await proxy(publicRequest("/memes/gjq95suv-old"));

    expect(response.status).toBe(308);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/memes/gjq95suv-%ED%95%9C%EA%B5%AD-%EB%B0%88",
    );
  });

  it("fails open without canonicalizing an alias when lookup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: null,
      error: { message: "provider unavailable" },
    });

    const response = await proxy(publicRequest("/ja/memes/gjq95suv-wrong"));

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
    dbMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(publicRequest(path));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/missing-public-meme");
    expect(response.headers.get("content-language")).toBe(language);
    expect(dbMocks.from).toHaveBeenCalledWith("memes");
    expect(dbMocks.select).toHaveBeenCalledWith(
      path.startsWith("/memes/")
        ? "id, short_id, slug, updated_at, meme_translations(locale, status, localized_slug, source_updated_at)"
        : "id, short_id, slug, updated_at, description, origin, usage_note, caution, usage_examples, meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status), meme_tags_map(tag_id), meme_translations(locale, status, localized_slug, title, summary, description, origin, source_updated_at)",
    );
    expect(dbMocks.eq).toHaveBeenCalledWith(
      "short_id",
      path.endsWith("/random") ? "random" : "missing",
    );
    expect(dbMocks.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(dbMocks.limit).toHaveBeenCalledWith(1);
    expect(dbMocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each([
    "/ar",
    "/ar/pricing",
    "/ar/memes",
    "/ar/memes/unknown-slug",
    "/ar/memes/bjk2021k-bun-jo-ka",
    "/ar/memes/yeyam8cm-pc-modem-dial-up-sound",
  ])("lets the app router render main's not-found document for %s", async (path) => {
    const response = await proxy(publicRequest(path));

    expect(response.status).not.toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(dbMocks.from).not.toHaveBeenCalled();
  });

  it("skips the lookup for a cors RSC or prefetch request", async () => {
    const response = await proxy(publicRequest("/en/memes/missing-meme", { fetchMode: "cors" }));

    expect(response.status).toBe(200);
    expect(dbMocks.from).not.toHaveBeenCalled();
  });

  it("keeps a curated home-card slug reachable when the catalog has no matching row", async () => {
    dbMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(publicRequest("/memes/jkm2022k-jung-kkuk-ma"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not apply the Korean curated fallback to a missing localized document", async () => {
    dbMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(publicRequest("/en/memes/jkm2022k-jung-kkuk-ma"));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/missing-public-meme");
  });

  it.each([undefined, "navigate"])("checks a document request with fetch mode %s", async (fetchMode) => {
    dbMocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });

    const response = await proxy(publicRequest("/en/memes/missing-meme", { fetchMode }));

    expect(response.status).toBe(404);
    expect(dbMocks.from).toHaveBeenCalledWith("memes");
  });

  it.each([
    "/memes/random",
    "/memes/meme-1/export",
    "/en/memes/meme-1/opengraph-image",
  ])("does not query nested or reserved meme route %s", async (path) => {
    const response = await proxy(publicRequest(path));

    expect(response.status).toBe(200);
    expect(dbMocks.from).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { message: "provider unavailable" } },
    { data: [], error: { message: "timeout" } },
  ])("fails open when the public lookup returns an error", async (result) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    dbMocks.abortSignal.mockResolvedValueOnce(result);

    const response = await proxy(publicRequest("/ja/memes/meme-1"));

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
    dbMocks.abortSignal.mockRejectedValueOnce(new Error(providerMessage));

    const response = await proxy(publicRequest("/ja/memes/meme-1"));

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

  it.each([
    ["browser", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "en-US,en;q=0.9"],
    ["kakao", "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984", undefined],
    ["kakao-en", "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984", "en-US,en;q=0.9"],
    ["x", "Twitterbot/1.0", "en-US,en;q=0.9"],
  ] as const)("keeps / Korean for %s even when the request previously negotiated /en", async (_name, userAgent, acceptLanguage) => {
    const response = await proxy(publicRequest("/", { userAgent, acceptLanguage }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
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
    dbMocks.abortSignal.mockResolvedValueOnce({
      data: [
        publicMemeRow({
          short_id: "gjq95suv",
          slug: "한국-밈",
          meme_translations: [localizedTranslation({
            locale: "zh",
            localized_slug: "当前名称",
          })],
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

  it("no longer gates the retired /premium path behind login", async () => {
    const response = await proxy(publicRequest("/premium?checkout=return"));
    expect(response.headers.get("location")).toBeNull();
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
