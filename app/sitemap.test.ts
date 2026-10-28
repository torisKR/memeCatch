import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient, filterPublicMemeMedia } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
  filterPublicMemeMedia: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));
vi.mock("@/lib/sources/public-links.server", () => ({ filterPublicMemeMedia }));

import sitemap from "@/app/sitemap";

const source = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf-8");

type Translation = {
  locale: string;
  status: string;
  localized_slug: string;
  source_updated_at: string;
  updated_at: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
};

function indexableMeme(index: number, translations: Translation[]) {
  return {
    short_id: `m${index}`,
    slug: `meme-${index}`,
    title: `Meme ${index}`,
    summary: "Registered meme summary",
    published_at: "2026-01-01T00:00:00.000Z",
    moderation_status: "approved" as const,
    updated_at: "2026-01-02T00:00:00.000Z",
    description: "d".repeat(400),
    origin: "o".repeat(60),
    usage_note: null,
    caution: null,
    usage_examples: [],
    meme_sources: [] as { source_url: string; production_id?: string | null }[],
    meme_contents: [] as {
      url: string;
      platform: string;
      content_id: string;
      availability: string;
      moderation_status: string;
      production_id?: string | null;
    }[],
    meme_tags_map: [],
    meme_market_profiles: [
      { market_code: "KR", role: "origin", review_state: "reviewed" },
    ],
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
          order: vi.fn(() => memeQuery),
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
  createStaticClient.mockReset();
  filterPublicMemeMedia.mockReset();
  filterPublicMemeMedia.mockImplementation(async (input) => input);
});

describe("사이트맵과 실제 공개 상세의 색인 자격 일치", () => {
  it("선택적 영상 제작 마이그레이션이 없는 로컬 스키마에서도 상세와 같은 관계 DTO를 읽는다", () => {
    expect(source).toContain("meme_sources(*)");
    expect(source).toContain("meme_contents(*)");
  });

  function mediaDependentMeme(index: number) {
    return {
      ...indexableMeme(index, [reviewedTranslation("en", "2026-03-01T00:00:00.000Z")]),
      description: "d".repeat(185),
      origin: "o".repeat(32),
      meme_sources: [
        { source_url: "https://www.youtube.com/watch?v=abcdefghijk" },
        { source_url: "https://www.youtube.com/watch?v=lmnopqrstuv" },
      ],
      meme_contents: [{
        url: "https://www.youtube.com/watch?v=lmnopqrstuv",
        platform: "youtube",
        content_id: "lmnopqrstuv",
        availability: "live",
        moderation_status: "approved",
      }],
    };
  }

  it("비공개·임베드 불가 원자료가 제외되어 noindex인 문서와 번역을 등재하지 않는다", async () => {
    const row = mediaDependentMeme(1);
    useRows([row]);
    filterPublicMemeMedia.mockResolvedValue({ sources: row.meme_sources, contents: [] });

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.includes("/memes/m1-"))).toBe(false);
    expect(filterPublicMemeMedia).toHaveBeenCalledOnce();
  });

  it("삭제 미디어와 URL 변형 출처는 상세와 동일하게 점수에서 제외한다", async () => {
    const row = mediaDependentMeme(1);
    row.meme_contents[0].availability = "dead";
    row.meme_sources[1].source_url = "https://youtu.be/lmnopqrstuv";
    useRows([row]);

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.includes("/memes/m1-"))).toBe(false);
  });

  it("자체 제작 미디어와 그 출처로 얇은 원문을 색인 가능하게 만들지 않는다", async () => {
    const row = mediaDependentMeme(1);
    useRows([{
      ...row,
      meme_sources: row.meme_sources.map((source) => ({ ...source, production_id: "production-1" })),
      meme_contents: row.meme_contents.map((content) => ({ ...content, production_id: "production-1" })),
    }]);

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.includes("/memes/m1-"))).toBe(false);
  });

  it("공개 산문에서 제거된 내부 삽화 운영 문구를 색인 점수로 세지 않는다", async () => {
    useRows([{
      ...indexableMeme(1, []),
      description: `${"d".repeat(370)}. 특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.`,
    }]);

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.includes("/memes/m1-"))).toBe(false);
  });

  it("같은 DB 페이지의 원자료는 행별이 아닌 한 번의 묶음 조회로 확인한다", async () => {
    useRows([mediaDependentMeme(1), mediaDependentMeme(2)]);

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.includes("/memes/m1-"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("/memes/m2-"))).toBe(true);
    expect(filterPublicMemeMedia).toHaveBeenCalledOnce();
    expect(filterPublicMemeMedia.mock.calls[0][0].contents).toHaveLength(2);
  });

  it("출처·미디어 없이 이미 충실한 1,000개 문서는 원장을 조회하지 않는다", async () => {
    useRows(Array.from({ length: 1_000 }, (_, index) => ({
      ...indexableMeme(index, []),
      ...{
        meme_sources: mediaDependentMeme(index).meme_sources,
        meme_contents: mediaDependentMeme(index).meme_contents,
      },
    })));

    const entries = await sitemap();

    expect(entries.filter((entry) => new URL(entry.url).pathname.startsWith("/memes/"))).toHaveLength(1_000);
    expect(filterPublicMemeMedia).not.toHaveBeenCalled();
  });

  it("혼합 페이지에서도 미디어 신호에 의존하는 경계 문서만 원장으로 확인한다", async () => {
    const boundary = mediaDependentMeme(1);
    useRows([boundary, {
      ...indexableMeme(2, []),
      meme_sources: boundary.meme_sources.map((source) => ({ ...source })),
      meme_contents: boundary.meme_contents.map((content) => ({ ...content })),
    }]);

    await sitemap();

    expect(filterPublicMemeMedia).toHaveBeenCalledOnce();
    expect(filterPublicMemeMedia.mock.calls[0][0]).toEqual({
      sources: boundary.meme_sources,
      contents: boundary.meme_contents,
    });
  });
});

/**
 * 사이트맵은 구글에 제출하는 artifact 그 자체다. 여기서 생기는 중복·누락은
 * "신경 써서 큐레이션했다"는 주장을 그대로 무너뜨린다.
 */
describe("사이트맵 페이지네이션 안정성", () => {
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

  it("공개 밈 조회 실패를 부분 사이트맵 성공으로 숨기지 않는다", async () => {
    useRows([], { message: "database unavailable" });

    await expect(sitemap()).rejects.toThrow(
      "[sitemap] 밈 조회 실패 (from=0): database unavailable",
    );
  });

  it("최신 공개일 조회 실패도 정상 사이트맵이나 현재 시각으로 숨기지 않는다", async () => {
    useRows([], null, {
      data: null,
      error: { message: "latest unavailable" },
    });

    await expect(sitemap()).rejects.toThrow(
      "[sitemap] 최신 공개일 조회 실패: latest unavailable",
    );
  });
});

describe("사이트맵 날짜 진실성", () => {
  it("독립 읽기 가이드를 노출하되 임의의 수정 시각을 만들지 않는다", async () => {
    useRows([]);
    const entries = await sitemap();
    const guide = entries.find((entry) => entry.url.endsWith("/guides/reading-memes"));

    expect(guide).toMatchObject({ changeFrequency: "daily", priority: 0.6 });
    expect(guide?.lastModified).toBeUndefined();
  });

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
  it("실제 reviewed/current/public 번역이 없는 locale 홈은 sitemap과 root hreflang에서 제외한다", async () => {
    useRows([]);

    const entries = await sitemap();
    const root = entries.find((entry) => entry.url === "https://catchmeme.com");

    expect(entries.some((entry) => /\/(en|ja|zh|zh-tw)$/.test(entry.url))).toBe(false);
    expect(root?.alternates?.languages).toEqual({
      ko: "https://catchmeme.com",
      "x-default": "https://catchmeme.com",
    });
  });

  it("reviewed/current/public 번역이 있는 locale 홈만 reciprocal root alternates에 포함한다", async () => {
    useRows([
      indexableMeme(1, [reviewedTranslation("en", "2026-03-01T00:00:00.000Z")]),
    ]);

    const entries = await sitemap();
    const root = entries.find((entry) => entry.url === "https://catchmeme.com");
    const english = entries.find((entry) => entry.url === "https://catchmeme.com/en");

    expect(english?.alternates).toEqual(root?.alternates);
    expect(root?.alternates?.languages).toEqual({
      ko: "https://catchmeme.com",
      en: "https://catchmeme.com/en",
      "x-default": "https://catchmeme.com",
    });
    expect(entries.some((entry) => entry.url === "https://catchmeme.com/ja")).toBe(false);
  });

  it("비한국 기원 번역 상세는 유지하되 localized home coverage로 세지 않는다", async () => {
    const nonKorean = indexableMeme(1, [
      reviewedTranslation("en", "2026-03-01T00:00:00.000Z"),
    ]);
    nonKorean.meme_market_profiles = [
      { market_code: "US", role: "origin", review_state: "reviewed" },
    ];
    useRows([nonKorean]);

    const entries = await sitemap();
    const root = entries.find((entry) => entry.url === "https://catchmeme.com");

    expect(entries.some((entry) => entry.url.includes("/en/memes/m1-"))).toBe(true);
    expect(entries.some((entry) => entry.url === "https://catchmeme.com/en")).toBe(false);
    expect(root?.alternates?.languages).toEqual({
      ko: "https://catchmeme.com",
      "x-default": "https://catchmeme.com",
    });
  });

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
      "x-default": expect.stringMatching(/\/pricing$/),
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
      "x-default": expect.stringMatching(/\/explore$/),
    });
  });

  it("각 URL에 localized alternates와 ko/x-default를 생성한다", () => {
    expect(source).toContain("alternates");
    expect(source).toContain("languages");
    expect(source).toContain('"x-default"');
    expect(source).toMatch(/(?:SEO_ROUTE_LOCALES|buildHreflangLanguages)/);
  });

  it("x-default는 reviewed 번역 유무와 무관하게 ko 원문을 유지한다", async () => {
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
    expect(withEnglish?.["x-default"]).toBe(withEnglish?.ko);
    expect(withEnglish?.["x-default"]).not.toContain("/en/memes/");

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
    expect(source).toContain("meme_market_profiles(market_code, role, review_state)");
  });

  it("indexable 원문에 대해 현재 reviewed 완역 locale만 alternates에 허용한다", () => {
    // 원문 충실도 판정은 번역 유무보다 먼저 통과해야 한다.
    expect(source).toContain("if (!isIndexableMeme(publicDepthInput)) continue");
    expect(source).toContain("publicEditorialEligibilityInput");

    // machine/stale/부분 번역을 hreflang에 내보내지 않는 계약. 구현은 인라인 또는
    // 명명된 helper 어느 쪽이어도 되지만 세 조건이 소스에 명시돼야 한다.
    expect(source).toMatch(/status\s*={2,3}\s*["']reviewed["']/);
    expect(source).toContain("isTranslationCurrent(translation.source_updated_at, meme.updated_at)");
    for (const field of ["title", "summary", "description"] as const) {
      expect(source).toMatch(new RegExp(`${field}\\??\\.trim\\(\\)`));
    }
  });

  it("원문과 같은 순간을 나타내는 다른 UTC offset의 reviewed 번역을 현재 버전으로 인정한다", async () => {
    const translation = reviewedTranslation("en", "2026-03-01T00:00:00.000Z");
    translation.source_updated_at = "2026-01-02T09:00:00+09:00";
    useRows([indexableMeme(1, [translation])]);

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.includes("/en/memes/m1-"))).toBe(true);
  });

  it("정적 홈과 상세의 x-default는 한국어 원문을 가리킨다", async () => {
    useRows([
      indexableMeme(1, [reviewedTranslation("en", "2026-03-01T00:00:00.000Z")]),
      indexableMeme(2, [reviewedTranslation("ja", "2026-03-01T00:00:00.000Z")]),
    ]);

    const entries = await sitemap();
    const languagesOf = (predicate: (url: string) => boolean) =>
      entries.find((entry) => predicate(entry.url) && entry.alternates?.languages)
        ?.alternates?.languages as Record<string, string> | undefined;

    const home = languagesOf((url) => !url.includes("/memes/"));
    expect(home?.["x-default"]).toBe(home?.ko);
    expect(home?.["x-default"]).toMatch(/catchmeme\.com$/);

    const withEnglish = languagesOf((url) => url.includes("/memes/m1"));
    expect(withEnglish?.["x-default"]).toBe(withEnglish?.ko);
    expect(withEnglish?.["x-default"]).not.toContain("/en/memes/");

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
});
