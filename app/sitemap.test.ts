import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

import sitemap, { clearSitemapCache, getIndexableKoreanMemeCount } from "@/app/sitemap";
import { CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";
import { contentDepth, isIndexableMeme } from "@/lib/content-depth";
import {
  getHreflang,
  isSeoContentLocale,
  localizedMemePath,
  SEO_CONTENT_LOCALES,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";
import {
  isIndexableLocalizedMeme,
  overlayMemeTranslation,
  type MemeTranslationRow,
} from "@/lib/meme-translations";
import { clearKoreanRankingsCache } from "@/lib/korean-rankings.server";
import { SITE_URL } from "@/lib/site";

const source = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf-8");

type Translation = {
  locale: string;
  status: string;
  localized_slug: string;
  source_updated_at: string | Date;
  updated_at: string | Date;
  title: string;
  summary: string;
  description: string;
  origin: string;
};

function indexableMeme(index: number, translations: Translation[]) {
  return {
    short_id: `m${index}`,
    slug: `meme-${index}`,
    updated_at: "2026-01-02T00:00:00.000Z" as string | Date,
    description: "d".repeat(400),
    origin: "o".repeat(60),
    usage_note: null,
    caution: null,
    usage_examples: [] as { situation: string; text: string }[],
    meme_sources: [] as { source_url?: string; hidden_from_public?: boolean }[],
    meme_contents: [],
    meme_tags_map: [],
    meme_translations: translations,
  };
}

function reviewedTranslation(locale: string, updatedAt: string): Translation {
  return {
    locale,
    status: "reviewed",
    localized_slug: "localized-meme",
    source_updated_at: "2026-01-02T00:00:00.000Z",
    updated_at: updatedAt,
    title: "Translated title",
    summary: "Translated summary",
    description: "Translated description",
    origin: "Translated origin",
  };
}

function useRows(
  rows: ReturnType<typeof indexableMeme>[],
  queryError: { message: string } | null = null,
  latestResult: {
    data: { published_at: string | null } | null;
    error: { message: string } | null;
  } = {
    data: { published_at: "2026-01-01T00:00:00.000Z" },
    error: null,
  },
) {
  createStaticClient.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn((columns: string) => {
        if (columns === "published_at") {
          const homeQuery = {
            in: vi.fn(() => homeQuery),
            order: vi.fn(() => homeQuery),
            limit: vi.fn(() => homeQuery),
            single: vi.fn(async () => latestResult),
            maybeSingle: vi.fn(async () => latestResult),
          };
          return homeQuery;
        }

        const memeQuery = {
          in: vi.fn(() => memeQuery),
          eq: vi.fn(() => memeQuery),
          not: vi.fn(() => memeQuery),
          gt: vi.fn(() => memeQuery),
          lt: vi.fn(() => memeQuery),
          order: vi.fn(() => memeQuery),
          limit: vi.fn(async () => ({ data: [], error: null })),
          range: vi.fn(async (from: number, to: number) => ({
            data: rows.slice(from, to + 1),
            error: queryError,
          })),
        };
        return memeQuery;
      }),
    })),
  });
}

beforeEach(() => {
  clearSitemapCache();
  clearKoreanRankingsCache();
  createStaticClient.mockReset();
});

/**
 * 사이트맵은 구글에 제출하는 artifact 그 자체다. 여기서 생기는 중복·누락은
 * "신경 써서 큐레이션했다"는 주장을 그대로 무너뜨린다.
 */
describe("사이트맵 페이지네이션 안정성", () => {
  it("요청 시점에 다시 만들어 빌드 당시의 빈 카탈로그를 고정하지 않는다", () => {
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).not.toContain("export const revalidate");
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
    expect(config).toContain(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
  });

  it("keeps a successful catalog in memory and retries an outage", async () => {
    useRows([indexableMeme(1, [])]);
    await sitemap();
    const callsAfterFirst = createStaticClient.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);
    await sitemap();
    expect(createStaticClient.mock.calls.length).toBe(callsAfterFirst);

    clearSitemapCache();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createStaticClient.mockImplementation(() => {
      throw new Error("catalog down");
    });
    await sitemap();
    await sitemap();
    expect(createStaticClient.mock.calls.length).toBe(callsAfterFirst + 2);
    errorLog.mockRestore();
  });

  it("range() 페이지네이션에 고유 타이브레이커(id)가 있다", () => {
    // published_at은 동점이 매우 많다(일괄 등록으로 공개 3,905건 중 2,835건이
    // 같은 타임스탬프). 단일 컬럼 정렬로 페이지를 나누면 쿼리마다 정렬이 달라져
    // 경계에서 같은 행을 다시 읽고 다른 행은 건너뛴다. 실제로 URL 2건이 중복
    // 등재되고 충실한 문서 1건이 누락된 적이 있다.
    const paged = source.slice(
      source.indexOf(".order("),
      source.lastIndexOf(".range("),
    );
    expect(paged).toContain('.order("published_at"');
    expect(paged).toContain('.order("id"');
  });

  it("얇은 문서를 거르는 단일 판정 함수를 쓴다", () => {
    // 상세의 robots 판정과 같은 함수여야 "사이트맵엔 있는데 noindex" 모순이 없다.
    expect(source).toContain("isIndexableMeme");
  });

  it("밈 조회 오류는 밈 URL 없이 정적 사이트맵만 남긴다", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useRows([], { message: "exceed_egress_quota" });

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.endsWith("/explore"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("/memes/"))).toBe(false);
    expect(errorLog).toHaveBeenCalledWith("[sitemap] catalog unavailable");
    expect(errorLog.mock.calls.flat().join(" ")).not.toContain("exceed_egress_quota");
    errorLog.mockRestore();
  });

  it("최신 공개일 조회 오류도 현재 시각을 만들지 않고 정적 URL만 남긴다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2035-12-31T23:59:59.000Z"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      useRows([], null, {
        data: null,
        error: { message: "exceed_egress_quota" },
      });

      const entries = await sitemap();

      expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
      expect(entries.some((entry) => entry.url.endsWith("/collections"))).toBe(true);
      expect(entries.some((entry) => entry.url.includes("/memes/"))).toBe(false);
      expect(errorLog.mock.calls.flat().join(" ")).not.toContain("exceed_egress_quota");
    } finally {
      errorLog.mockRestore();
      vi.useRealTimers();
    }
  });

  it("Supabase 클라이언트가 던져도 정적 사이트맵을 반환한다", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createStaticClient.mockImplementation(() => {
      throw new Error("Your project's URL and Key are required to create a Supabase client!");
    });

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.endsWith("/explore"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("/memes/"))).toBe(false);
    expect(errorLog).toHaveBeenCalledWith("[sitemap] catalog unavailable");
    expect(await getIndexableKoreanMemeCount()).toBeNull();
    errorLog.mockRestore();
  });

  it("counts the indexable Korean meme URLs the sitemap publishes", async () => {
    useRows([indexableMeme(1, []), indexableMeme(2, [])]);
    expect(await getIndexableKoreanMemeCount()).toBe(2);
    const entries = await sitemap();
    const koreanMemes = entries.filter((entry) => new URL(entry.url).pathname.startsWith("/memes/"));
    expect(koreanMemes).toHaveLength(2);
  });
});

describe("사이트맵 날짜 진실성", () => {
  it("정적·정책·가격·모음 URL에 최신 밈 날짜를 복사하지 않는다", async () => {
    useRows([]);
    const entries = await sitemap();
    const staticPaths = [
      "/pricing",
      "/en/pricing",
      "/collections",
      "/collections/2020s",
      "/about",
      "/privacy",
      "/terms",
    ];

    const pathnames = entries.map((entry) => new URL(entry.url).pathname);
    expect(pathnames).not.toContain("/products");
    expect(pathnames).not.toContain("/en/products");
    expect(pathnames).not.toContain("/ja/products");
    expect(pathnames).not.toContain("/retired-products");
    expect(pathnames).not.toContain("/en/retired-products");
    expect(pathnames.some((pathname) => pathname.startsWith("/products/") || pathname.includes("/go/products") || pathname.includes("/retired-products"))).toBe(false);

    for (const pathname of staticPaths) {
      const entry = entries.find((candidate) =>
        new URL(candidate.url).pathname === pathname,
      );
      expect(entry?.lastModified, pathname).toBeUndefined();
    }
  });

  it("공개 데이터가 비어 있으면 요청 시각을 lastModified로 만들지 않는다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2035-12-31T23:59:59.000Z"));
    useRows([], null, { data: null, error: null });

    const entries = await sitemap();

    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
    vi.useRealTimers();
  });

  it.each([
    ["존재하지 않는 날짜", "2026-02-30T00:00:00.000Z"],
    ["미래 날짜", "2026-03-01T00:00:00.000Z"],
  ])("%s인 공개일과 밈·번역 수정일은 lastModified에서 생략한다", async (_label, storedDate) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));
    try {
      const translation = reviewedTranslation("en", storedDate);
      translation.source_updated_at = storedDate;
      useRows(
        [{ ...indexableMeme(1, [translation]), updated_at: storedDate }],
        null,
        { data: { published_at: storedDate }, error: null },
      );

      const entries = await sitemap();
      const datedEntries = entries.filter((entry) => entry.lastModified !== undefined);

      expect(datedEntries).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("사이트맵 다국어 색인 계약", () => {
  it("테마별 모음 인덱스를 독립 URL로 노출한다", async () => {
    useRows([]);
    const entries = await sitemap();

    expect(
      entries.filter((entry) => entry.url.endsWith("/collections")),
    ).toHaveLength(1);
  });

  it("Plus 가격 전환 페이지를 모든 정적 SEO locale에 reciprocal alternates로 노출한다", async () => {
    useRows([]);
    const entries = await sitemap();
    const pricingEntries = entries.filter((entry) =>
      /\/pricing$/.test(entry.url),
    );
    const englishPricing = pricingEntries.find((entry) =>
      entry.url.endsWith("/en/pricing"),
    );

    expect(pricingEntries).toHaveLength(5);
    expect(englishPricing?.alternates?.languages).toMatchObject({
      ko: expect.stringMatching(/\/pricing$/),
      en: expect.stringMatching(/\/en\/pricing$/),
      ja: expect.stringMatching(/\/ja\/pricing$/),
      "zh-Hans": expect.stringMatching(/\/zh\/pricing$/),
      "zh-Hant": expect.stringMatching(/\/zh-tw\/pricing$/),
      "x-default": expect.stringMatching(/\/en\/pricing$/),
    });
  });

  it("24개 이상 적격 문서가 있는 locale만 localized explore sitemap에 올린다", async () => {
    useRows(
      Array.from({ length: 24 }, (_, index) =>
        indexableMeme(index, [reviewedTranslation("en", "2026-03-01T00:00:00.000Z")]),
      ),
    );

    const entries = await sitemap();
    const englishExplore = entries.find((entry) => entry.url.endsWith("/en/explore"));

    expect(entries.filter((entry) => entry.url.endsWith("/en/explore"))).toHaveLength(1);
    expect(entries.filter((entry) => entry.url.endsWith("/ja/explore"))).toHaveLength(0);
    expect(englishExplore?.alternates?.languages).toMatchObject({
      ko: expect.stringMatching(/\/explore$/),
      en: expect.stringMatching(/\/en\/explore$/),
      "x-default": expect.stringMatching(/\/en\/explore$/),
    });
  });

  it("각 URL에 localized alternates와 ko/x-default를 생성한다", () => {
    expect(source).toContain("alternates");
    expect(source).toContain("languages");
    expect(source).toContain('"x-default"');
    expect(source).toMatch(/(?:SEO_ROUTE_LOCALES|buildHreflangLanguages)/);
  });

  it("x-default는 reviewed en 문서를 우선하고 없으면 ko 원문을 유지한다", async () => {
    useRows([
      indexableMeme(1, [reviewedTranslation("en", "2026-03-01T00:00:00.000Z")]),
      indexableMeme(2, [reviewedTranslation("ja", "2026-03-01T00:00:00.000Z")]),
    ]);

    const entries = await sitemap();
    const languagesOf = (predicate: (url: string) => boolean) =>
      entries.find(
        (entry) => predicate(entry.url) && entry.alternates?.languages,
      )?.alternates?.languages as Record<string, string> | undefined;

    const withEnglish = languagesOf((url) => url.includes("/memes/m1"));
    expect(withEnglish?.["x-default"]).toBe(withEnglish?.en);
    expect(withEnglish?.["x-default"]).toContain("/en/memes/");

    const withoutEnglish = languagesOf((url) => url.includes("/memes/m2"));
    expect(withoutEnglish?.en).toBeUndefined();
    expect(withoutEnglish?.["x-default"]).toBe(withoutEnglish?.ko);
  });

  it("번역 locale과 검수·원문 동기화·필수 필드를 조회한다", () => {
    expect(source).toContain("meme_translations");

    const translationQuery = source.slice(source.indexOf("meme_translations"));
    expect(translationQuery).toContain("locale");
    expect(translationQuery).toContain("status");
    expect(translationQuery).toContain("source_updated_at");
    expect(translationQuery).toContain("updated_at");
    expect(translationQuery).toContain("title");
    expect(translationQuery).toContain("summary");
    expect(translationQuery).toContain("description");
  });

  it("indexable 원문에 대해 상세와 같은 번역 색인 판정만 alternates에 허용한다", () => {
    // 원문 충실도 판정은 번역 유무보다 먼저 통과해야 한다.
    expect(source).toContain("if (!isIndexableMeme(meme)) continue");
    // 검수·필수 필드·원문 150자·시각 비교는 isIndexableLocalizedMeme 한 곳이다.
    // 타임스탬프 문자열 동등 비교로 다시 갈라지면 Date와 마이크로초 문자열이 빠진다.
    expect(source).toContain("isIndexableLocalizedMeme");
    expect(source).toContain("isTranslationCurrent");
    expect(source).not.toMatch(/source_updated_at\s*={2,3}\s*meme\.updated_at/);
  });

  it("같은 밀리초의 Date·마이크로초 문자열·다른 ISO 표기를 포함하고 1ms 차이는 뺀다", async () => {
    const instant = new Date("2026-07-15T15:30:00.191Z");
    const micros = "2026-07-15T15:30:00.191373+00:00";
    useRows([
      {
        ...indexableMeme(1, [
          {
            ...reviewedTranslation("en", "2026-03-01T00:00:00.000Z"),
            source_updated_at: micros,
          },
        ]),
        updated_at: instant,
      },
      {
        ...indexableMeme(2, [
          {
            ...reviewedTranslation("ja", "2026-03-01T00:00:00.000Z"),
            source_updated_at: instant,
          },
        ]),
        updated_at: micros,
      },
      {
        ...indexableMeme(3, [
          {
            ...reviewedTranslation("zh", "2026-03-01T00:00:00.000Z"),
            source_updated_at: "2026-07-15T15:30:00.191000Z",
          },
          {
            ...reviewedTranslation("zh-tw", "2026-03-01T00:00:00.000Z"),
            source_updated_at: new Date(instant.getTime() + 1),
          },
        ]),
        updated_at: "2026-07-15T15:30:00.191Z",
      },
    ]);

    const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);

    expect(paths.some((pathname) => pathname.startsWith("/en/memes/m1"))).toBe(true);
    expect(paths.some((pathname) => pathname.startsWith("/ja/memes/m2"))).toBe(true);
    expect(paths.some((pathname) => pathname.startsWith("/zh/memes/m3"))).toBe(true);
    expect(paths.some((pathname) => pathname.startsWith("/zh-tw/memes/m3"))).toBe(false);
  });

  it("점수 4인 원문과 1ms 지난 번역은 색인 판정과 사이트맵에서 빠진다", async () => {
    const updatedAt = "2026-07-15T15:30:00.191Z";
    const thinProse = {
      description: "d".repeat(250),
      origin: "o".repeat(60),
      usage_note: null,
      caution: null,
      aliases: [] as string[],
      usage_examples: [] as { situation: string; text: string }[],
      meme_sources: [] as { source_url?: string }[],
      meme_contents: [] as { availability?: string | null; moderation_status?: string | null }[],
      meme_tags_map: [] as { tag_id?: string | null }[],
    };
    const thinTranslation = {
      ...reviewedTranslation("en", "2026-03-01T00:00:00.000Z"),
      source_updated_at: updatedAt,
    };
    const thinRow = {
      short_id: "thin1",
      slug: "thin-source",
      updated_at: updatedAt,
      ...thinProse,
      meme_translations: [thinTranslation],
    };
    const staleTranslation = {
      ...reviewedTranslation("ja", "2026-03-01T00:00:00.000Z"),
      source_updated_at: "2026-07-15T15:30:00.190Z",
    };
    const staleRow = {
      ...indexableMeme(9, [staleTranslation]),
      updated_at: updatedAt,
    };

    expect(contentDepth(thinRow).score).toBe(4);
    expect(contentDepth(thinRow).proseChars).toBeGreaterThanOrEqual(150);
    expect(isIndexableMeme(thinRow)).toBe(false);

    function localized(shortId: string, slug: string, translation: Translation, prose: typeof thinProse) {
      const meme = {
        id: shortId === "thin1"
          ? "00000000-0000-4000-8000-000000000011"
          : "00000000-0000-4000-8000-000000000019",
        short_id: shortId,
        slug,
        title: "원본",
        summary: "요약",
        updated_at: updatedAt,
        ...prose,
      };
      const locale = translation.locale;
      if (!isSeoContentLocale(locale)) {
        throw new Error(`unexpected locale ${locale}`);
      }
      const row: MemeTranslationRow = {
        meme_id: meme.id,
        locale,
        status: "reviewed",
        localized_slug: translation.localized_slug,
        title: translation.title,
        summary: translation.summary,
        description: translation.description,
        origin: translation.origin,
        usage_note: null,
        caution: null,
        aliases: [],
        usage_examples: [],
        source_updated_at: String(translation.source_updated_at),
        provider: "test",
        model: "test",
        prompt_version: 1,
        translated_at: updatedAt,
        reviewed_at: updatedAt,
        reviewed_by: null,
        created_at: updatedAt,
        updated_at: updatedAt,
      };
      return overlayMemeTranslation(meme, row, locale);
    }

    const substantial = {
      ...thinProse,
      description: "d".repeat(400),
    };
    expect(isIndexableLocalizedMeme(localized("thin1", "thin-source", thinTranslation, thinProse))).toBe(false);
    expect(isIndexableLocalizedMeme(localized("m9", "meme-9", staleTranslation, substantial))).toBe(false);

    useRows([thinRow, staleRow] as ReturnType<typeof indexableMeme>[]);
    const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);

    expect(paths.some((pathname) => pathname.includes("thin1"))).toBe(false);
    expect(paths.some((pathname) => pathname.startsWith("/ja/memes/m9"))).toBe(false);
    expect(paths.some((pathname) => pathname.startsWith("/memes/m9"))).toBe(true);
  });

  it("사이트맵 locale URL 집합이 색인 가능한 상세 페이지와 같고 hreflang도 같다", async () => {
    const instant = new Date("2026-07-15T15:30:00.191Z");
    const micros = "2026-07-15T15:30:00.191373+00:00";
    const substantial = {
      title: "원본",
      summary: "요약",
      description: "d".repeat(400),
      origin: "o".repeat(60),
      usage_note: null as string | null,
      caution: null as string | null,
      aliases: [] as string[],
      usage_examples: [] as { situation: string; text: string }[],
      meme_sources: [] as { source_url?: string }[],
      meme_contents: [] as { availability?: string | null; moderation_status?: string | null }[],
      meme_tags_map: [] as { tag_id?: string | null }[],
    };

    function parityMeme(
      id: string,
      shortId: string,
      slug: string,
      updatedAt: string | Date,
      prose: Partial<typeof substantial> = {},
    ) {
      return {
        id,
        short_id: shortId,
        slug,
        updated_at: updatedAt,
        ...substantial,
        ...prose,
      };
    }

    function parityTranslation(
      meme: { id: string; updated_at: string | Date },
      locale: SeoContentLocale,
      overrides: Partial<MemeTranslationRow> = {},
    ): MemeTranslationRow {
      return {
        meme_id: meme.id,
        locale,
        status: "reviewed",
        localized_slug: `${locale}-slug`,
        title: "Translated title",
        summary: "Translated summary",
        description: "Translated description",
        origin: "Translated origin",
        usage_note: null,
        caution: null,
        aliases: [],
        usage_examples: [],
        source_updated_at: typeof meme.updated_at === "string"
          ? meme.updated_at
          : meme.updated_at.toISOString(),
        provider: "test",
        model: "test",
        prompt_version: 1,
        translated_at: "2026-07-15T15:30:00.191Z",
        reviewed_at: "2026-07-15T15:30:00.191Z",
        reviewed_by: null,
        created_at: "2026-07-15T15:30:00.191Z",
        updated_at: "2026-07-16T00:00:00.000Z",
        ...overrides,
      };
    }

    const dateMeme = parityMeme("00000000-0000-4000-8000-000000000001", "p1", "date-meme", instant);
    const stringMeme = parityMeme("00000000-0000-4000-8000-000000000002", "p2", "string-meme", micros);
    const jaOnly = parityMeme(
      "00000000-0000-4000-8000-000000000003",
      "p3",
      "ja-only",
      "2026-07-15T15:30:00.191Z",
    );
    const thin = parityMeme(
      "00000000-0000-4000-8000-000000000004",
      "p4",
      "thin-meme",
      instant,
      { description: "짧음", origin: "" },
    );
    const alias = parityMeme(
      "00000000-0000-4000-8000-000000000005",
      "cssqxwmb",
      "alias-meme",
      instant,
    );
    const machineMeme = parityMeme(
      "00000000-0000-4000-8000-000000000006",
      "p6",
      "machine-meme",
      instant,
    );

    const fixtures: { meme: ReturnType<typeof parityMeme>; translations: MemeTranslationRow[] }[] = [
      {
        meme: dateMeme,
        translations: [
          parityTranslation(dateMeme, "en", {
            localized_slug: "english-format",
            source_updated_at: micros,
          }),
          parityTranslation(dateMeme, "ja", {
            localized_slug: "   ",
            source_updated_at: "2026-07-15T15:30:00.191000Z",
          }),
          parityTranslation(dateMeme, "zh", {
            source_updated_at: new Date(instant.getTime() + 1).toISOString(),
          }),
          parityTranslation(dateMeme, "zh-tw", { description: "   " }),
        ],
      },
      {
        meme: stringMeme,
        translations: [
          parityTranslation(stringMeme, "ja", {
            localized_slug: "japanese-format",
            source_updated_at: instant as unknown as string,
          }),
          parityTranslation(stringMeme, "en", {
            source_updated_at: "2026-07-16T00:30:00.191373+09:00",
          }),
        ],
      },
      {
        meme: jaOnly,
        translations: [
          parityTranslation(jaOnly, "ja", { localized_slug: "  ja-slug  " }),
        ],
      },
      {
        meme: thin,
        translations: [parityTranslation(thin, "en")],
      },
      {
        meme: alias,
        translations: [parityTranslation(alias, "en")],
      },
      {
        meme: machineMeme,
        translations: [parityTranslation(machineMeme, "en", { status: "machine" })],
      },
    ];

    function indexableLocalePaths(meme: (typeof fixtures)[number]["meme"], translations: MemeTranslationRow[]) {
      if (CANONICAL_MEME_ALIAS_MAP[meme.short_id]) return [];
      if (!isIndexableMeme(meme)) return [];
      const paths: string[] = [];
      for (const row of translations) {
        if (!isSeoContentLocale(row.locale)) continue;
        const localized = overlayMemeTranslation(
          meme as unknown as Parameters<typeof overlayMemeTranslation>[0],
          row,
          row.locale,
        );
        if (!localized || !isIndexableLocalizedMeme(localized)) continue;
        paths.push(localizedMemePath(row.locale, localized.short_id, localized.slug));
      }
      return paths;
    }

    function detailLanguages(
      meme: (typeof fixtures)[number]["meme"],
      translations: MemeTranslationRow[],
    ): Record<string, string> {
      const versions = translations.flatMap((row) => {
        if (!isSeoContentLocale(row.locale)) return [];
        const localized = overlayMemeTranslation(
          meme as unknown as Parameters<typeof overlayMemeTranslation>[0],
          row,
          row.locale,
        );
        if (!localized || !isIndexableLocalizedMeme(localized)) return [];
        return [{ locale: row.locale, meme: localized }];
      });
      const koreanPath = memePathFrom(meme.short_id, meme.slug);
      const english = versions.find((version) => version.locale === "en")?.meme;
      const xDefault = english
        ? localizedMemePath("en", english.short_id, english.slug)
        : koreanPath;
      return Object.fromEntries([
        ["ko", koreanPath],
        ...versions.map(({ locale, meme: version }) => [
          getHreflang(locale),
          localizedMemePath(locale, version.short_id, version.slug),
        ]),
        ["x-default", xDefault],
      ]);
    }

    useRows(fixtures.map(({ meme, translations }) => ({
      short_id: meme.short_id,
      slug: meme.slug,
      updated_at: meme.updated_at,
      description: meme.description,
      origin: meme.origin,
      usage_note: meme.usage_note,
      caution: meme.caution,
      usage_examples: meme.usage_examples,
      meme_sources: meme.meme_sources,
      meme_contents: meme.meme_contents,
      meme_tags_map: meme.meme_tags_map,
      meme_translations: translations.map((row) => ({
        locale: row.locale,
        status: row.status,
        localized_slug: row.localized_slug ?? "",
        source_updated_at: row.source_updated_at,
        updated_at: row.updated_at,
        title: row.title,
        summary: row.summary,
        description: row.description,
        origin: row.origin,
      })),
    })) as ReturnType<typeof indexableMeme>[]);

    const entries = await sitemap();
    const pathnameOf = (url: string) => new URL(url, SITE_URL).pathname;
    const sitemapLocalePaths = entries
      .map((entry) => pathnameOf(entry.url))
      .filter((pathname) => SEO_CONTENT_LOCALES.some((locale) => pathname.startsWith(`/${locale}/memes/`)))
      .sort();
    const detailLocalePaths = fixtures
      .flatMap(({ meme, translations }) => indexableLocalePaths(meme, translations))
      .sort();

    expect(sitemapLocalePaths).toEqual(detailLocalePaths);
    expect(detailLocalePaths).toEqual([
      "/en/memes/p1-english-format",
      "/en/memes/p2-en-slug",
      "/ja/memes/p1-date-meme",
      "/ja/memes/p2-japanese-format",
      "/ja/memes/p3-ja-slug",
    ].sort());

    for (const { meme, translations } of fixtures) {
      if (CANONICAL_MEME_ALIAS_MAP[meme.short_id] || !isIndexableMeme(meme)) continue;
      const expected = detailLanguages(meme, translations);
      const paths = new Set([
        memePathFrom(meme.short_id, meme.slug),
        ...indexableLocalePaths(meme, translations),
      ]);
      const related = entries.filter((entry) => paths.has(pathnameOf(entry.url)));
      expect(related).toHaveLength(paths.size);
      for (const entry of related) {
        const actual = Object.fromEntries(
          Object.entries(entry.alternates?.languages ?? {}).map(([key, url]) => [
            key,
            pathnameOf(url ?? ""),
          ]),
        );
        expect(actual).toEqual(expected);
      }
    }
  });

  it("x-default는 영어 문서를 가리키고, en 번역이 없으면 ko 원문을 유지한다", async () => {
    // 해외 주 타깃 전환 — 언어 미상 방문자의 기본 문서는 영어다. 단, reviewed en
    // 번역이 없는 밈에서 /en URL을 가리키면 존재하지 않는 문서를 신고하는 셈이라
    // ko 원문을 유지한다.
    useRows([
      indexableMeme(1, [reviewedTranslation("en", "2026-03-01T00:00:00.000Z")]),
      indexableMeme(2, [reviewedTranslation("ja", "2026-03-01T00:00:00.000Z")]),
    ]);

    const entries = await sitemap();
    const languagesOf = (predicate: (url: string) => boolean) =>
      entries.find((entry) => predicate(entry.url) && entry.alternates?.languages)
        ?.alternates?.languages as Record<string, string> | undefined;

    const home = languagesOf((url) => !url.includes("/memes/"));
    expect(home?.["x-default"]).toBe(home?.en);
    expect(home?.["x-default"]).toMatch(/\/en$/);

    const withEnglish = languagesOf((url) => url.includes("/memes/m1"));
    expect(withEnglish?.["x-default"]).toBe(withEnglish?.en);
    expect(withEnglish?.["x-default"]).toContain("/en/memes/");

    const withoutEnglish = languagesOf((url) => url.includes("/memes/m2"));
    expect(withoutEnglish?.en).toBeUndefined();
    expect(withoutEnglish?.["x-default"]).toBe(withoutEnglish?.ko);
  });

  it("현재 reviewed 번역 수정 시각을 localized URL과 해당 locale 홈에 쓴다", async () => {
    const newestEnglishUpdate = "2026-04-03T12:00:00.000Z";
    useRows([
      indexableMeme(1, [reviewedTranslation("en", "2026-03-01T00:00:00.000Z")]),
      indexableMeme(2, [reviewedTranslation("en", newestEnglishUpdate)]),
      indexableMeme(3, [
        {
          ...reviewedTranslation("en", "2026-05-01T00:00:00.000Z"),
          source_updated_at: "2025-12-01T00:00:00.000Z",
        },
      ]),
    ]);

    const entries = await sitemap();
    const englishHome = entries.find((entry) => entry.url.endsWith("/en"));
    const englishMeme = entries.find((entry) =>
      entry.url.includes("/en/memes/"),
    );

    expect(englishHome?.lastModified).toEqual(new Date(newestEnglishUpdate));
    expect(englishMeme?.lastModified).toEqual(
      new Date("2026-03-01T00:00:00.000Z"),
    );
  });

  it("번역이 소스당 4개여도 sitemap URL을 50,000개 이하로 제한한다", async () => {
    const translations = ["en", "ja", "zh", "zh-tw"].map((locale) =>
      reviewedTranslation(locale, "2026-04-03T12:00:00.000Z"),
    );
    useRows(
      Array.from({ length: 10_000 }, (_, index) =>
        indexableMeme(index, translations),
      ),
    );

    const entries = await sitemap();

    expect(entries).toHaveLength(50_000);
  });

  it("selects hidden_from_public so hidden rows can be excluded from the gate", () => {
    expect(source).toContain("meme_sources(source_url, hidden_from_public)");
  });


  it("excludes a meme whose only sources are hidden_from_public, and keeps a twin with visible sources", async () => {
    const gated = (index: number, meme_sources: { source_url: string; hidden_from_public?: boolean }[]) => ({
      short_id: `g${index}`,
      slug: `gated-${index}`,
      updated_at: "2026-01-02T00:00:00.000Z",
      // Score without sources: description 250 (+2) + origin 59 (+1) + 1 example (+1) = 4, below MIN_SCORE 5.
      // Two visible sources add +2 and make it indexable; hidden sources must not.
      description: "d".repeat(250),
      origin: "o".repeat(59),
      usage_note: null,
      caution: null,
      usage_examples: [{ situation: "s", text: "t" }],
      meme_sources,
      meme_contents: [],
      meme_tags_map: [],
      meme_translations: [],
    });

    useRows([
      gated(1, [
        { source_url: "https://namu.wiki/w/hidden", hidden_from_public: true },
        { source_url: "https://example.org/also-hidden", hidden_from_public: true },
      ]),
      gated(2, [
        { source_url: "https://example.org/one" },
        { source_url: "https://example.org/two", hidden_from_public: false },
      ]),
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/memes/g1-gated-1"))).toBe(false);
    expect(urls.some((url) => url.includes("/memes/g2-gated-2"))).toBe(true);
  });

});
