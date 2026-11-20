import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_MAX_URLS,
  indexNowPayloads,
  indexNowUrls,
  postIndexNowPayloads,
  sitemapLocs,
} from "@/lib/indexnow";

vi.mock("server-only", () => ({}));
const afterMock = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: afterMock }));

describe("IndexNow key file", () => {
  it("is a 32-character hex key served verbatim at /{key}.txt", () => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
    expect(INDEXNOW_KEY_LOCATION).toBe(`https://catchmeme.com/${INDEXNOW_KEY}.txt`);
    const file = readFileSync(join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`), "utf8");
    expect(file).toBe(INDEXNOW_KEY);
  });
});

describe("IndexNow URL filtering", () => {
  it("keeps only https apex catchmeme.com URLs and dedupes them", () => {
    expect(
      indexNowUrls([
        "https://catchmeme.com/memes/a-b",
        "https://catchmeme.com/memes/a-b",
        "https://catchmeme.com/memes/a-b#top",
        "https://www.catchmeme.com/memes/c",
        "http://catchmeme.com/memes/d",
        "https://catchmeme.com:8443/memes/e",
        "https://user@catchmeme.com/memes/f",
        "https://evil.example/memes/g",
        "https://catchmeme.com.evil.example/x",
        "/memes/relative",
        "not a url",
        "",
        null,
        undefined,
        "https://catchmeme.com/en/memes/h-%EB%B0%88",
      ]),
    ).toEqual([
      "https://catchmeme.com/memes/a-b",
      "https://catchmeme.com/en/memes/h-%EB%B0%88",
    ]);
  });

  it("splits payloads at the 10,000 URL protocol limit", () => {
    const urls = Array.from({ length: INDEXNOW_MAX_URLS + 5 }, (_, i) => `https://catchmeme.com/memes/${i}`);
    const payloads = indexNowPayloads(urls);
    expect(payloads).toHaveLength(2);
    expect(payloads[0].urlList).toHaveLength(INDEXNOW_MAX_URLS);
    expect(payloads[1].urlList).toHaveLength(5);
    expect(payloads[0]).toMatchObject({
      host: "catchmeme.com",
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
    });
    // A caller cannot raise the cap above the protocol limit.
    expect(indexNowPayloads(urls, 50_000)[0].urlList).toHaveLength(INDEXNOW_MAX_URLS);
  });

  it("returns no payload when nothing survives the filter", () => {
    expect(indexNowPayloads(["https://www.catchmeme.com/"])).toEqual([]);
  });

  it("reads <loc> values from a sitemap and decodes entities", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://catchmeme.com</loc></url>
      <url><loc> https://catchmeme.com/memes?page=2&amp;x=1 </loc><xhtml:link href="https://catchmeme.com/en"/></url></urlset>`;
    expect(sitemapLocs(xml)).toEqual([
      "https://catchmeme.com",
      "https://catchmeme.com/memes?page=2&x=1",
    ]);
  });
});

describe("IndexNow POST", () => {
  it("posts the JSON body to the shared endpoint and treats 200/202 as success", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 422 }))
      .mockRejectedValueOnce(new Error("network"));
    const payloads = [
      ...indexNowPayloads(["https://catchmeme.com/a"]),
      ...indexNowPayloads(["https://catchmeme.com/b"]),
      ...indexNowPayloads(["https://catchmeme.com/c"]),
    ];
    const results = await postIndexNowPayloads(payloads, { fetchImpl });
    expect(results).toEqual([
      { urls: 1, status: 202, ok: true },
      { urls: 1, status: 422, ok: false },
      { urls: 1, status: null, ok: false },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      host: "catchmeme.com",
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: ["https://catchmeme.com/a"],
    });
  });
});

const chars = (n: number) => "밈".repeat(n);
const UPDATED = "2026-11-20T13:48:16.000Z";

function richMeme(overrides: Record<string, unknown> = {}) {
  return {
    short_id: "abc123",
    slug: "테스트-밈",
    moderation_status: "approved",
    updated_at: UPDATED,
    description: chars(339),
    origin: chars(60),
    usage_note: null,
    caution: null,
    usage_examples: null,
    meme_sources: [{ source_url: "https://example.com/source", hidden_from_public: false }],
    meme_contents: [],
    meme_tags_map: [],
    meme_translations: [
      {
        locale: "en",
        status: "reviewed",
        localized_slug: "test-meme",
        title: "Test",
        summary: "Summary",
        description: "Description",
        origin: "Origin",
        source_updated_at: UPDATED,
      },
      {
        locale: "ja",
        status: "reviewed",
        localized_slug: null,
        title: "テスト",
        summary: "要約",
        description: "説明",
        origin: "由来",
        // Translated from an older Korean revision: not served, not submitted.
        source_updated_at: "2026-11-01T00:00:00.000Z",
      },
      {
        locale: "zh",
        status: "machine",
        localized_slug: "x",
        title: "t",
        summary: "s",
        description: "d",
        origin: "o",
        source_updated_at: UPDATED,
      },
    ],
    ...overrides,
  };
}

describe("IndexNow server helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("announces the Korean URL and reviewed current translations only", async () => {
    const { indexNowUrlsForMeme } = await import("@/lib/indexnow.server");
    expect(indexNowUrlsForMeme(richMeme())).toEqual([
      `https://catchmeme.com/memes/abc123-${encodeURIComponent("테스트-밈")}`,
      "https://catchmeme.com/en/memes/abc123-test-meme",
    ]);
  });

  it("skips a public thin (noindex) document", async () => {
    const { indexNowUrlsForMeme } = await import("@/lib/indexnow.server");
    expect(indexNowUrlsForMeme(richMeme({ description: chars(20), origin: null }))).toEqual([]);
  });

  it("announces only the Korean URL once a meme leaves the public set", async () => {
    const { indexNowUrlsForMeme } = await import("@/lib/indexnow.server");
    expect(indexNowUrlsForMeme(richMeme({ moderation_status: "rejected", description: chars(5) }))).toEqual([
      `https://catchmeme.com/memes/abc123-${encodeURIComponent("테스트-밈")}`,
    ]);
  });

  it("does nothing outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { submitIndexNow, scheduleIndexNowForMeme } = await import("@/lib/indexnow.server");
    const fetchImpl = vi.fn();
    expect(await submitIndexNow(["https://catchmeme.com/a"], { fetchImpl })).toEqual({
      submitted: 0,
      batches: [],
      skipped: "disabled",
    });
    scheduleIndexNowForMeme({}, "meme-id");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("can be switched off in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INDEXNOW_DISABLED", "1");
    const { indexNowEnabled } = await import("@/lib/indexnow.server");
    expect(indexNowEnabled()).toBe(false);
  });

  it("logs counts and status codes but never the key or URLs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { submitIndexNow } = await import("@/lib/indexnow.server");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    const result = await submitIndexNow(["https://catchmeme.com/a"], { fetchImpl, force: true });
    expect(result.submitted).toBe(0);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("indexnow_submit_failed");
    expect(logged).toContain("403");
    expect(logged).not.toContain(INDEXNOW_KEY);
    expect(logged).not.toContain("catchmeme.com/a");
    warn.mockRestore();
  });

  it("schedules the lookup after the response and swallows lookup failures", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { scheduleIndexNowForMeme } = await import("@/lib/indexnow.server");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = {
      from: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    expect(() => scheduleIndexNowForMeme(db, "meme-id")).not.toThrow();
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(db.from).not.toHaveBeenCalled();
    await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(db.from).toHaveBeenCalledWith("memes");
    warn.mockRestore();
  });
});
