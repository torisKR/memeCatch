import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createStaticClient }));

import { GET, dynamic as routeDynamic } from "@/app/feed/updated.xml/route";
import { SITE_URL } from "@/lib/site";

function row(index: number, indexable: boolean, updatedAt: string) {
  return {
    id: `id-${String(index).padStart(4, "0")}`,
    short_id: `m${index}`,
    slug: `meme-${index}`,
    title: `Meme ${index}`,
    summary: `Summary ${index}`,
    category: "phrase",
    moderation_status: "approved" as const,
    published_at: "2025-01-01T00:00:00.000Z",
    updated_at: updatedAt,
    description: indexable ? "d".repeat(400) : "thin",
    origin: indexable ? "o".repeat(80) : "",
    usage_note: indexable ? "u".repeat(40) : null,
    caution: null,
    usage_examples: indexable ? [{ situation: "one", text: "a" }, { situation: "two", text: "b" }] : [],
    meme_sources: indexable ? [{ source_url: `https://example.com/${index}/a` }, { source_url: `https://example.com/${index}/b` }] : [],
    meme_contents: [],
    meme_tags_map: [],
  };
}

function useRows(rows: ReturnType<typeof row>[]) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null })),
  };
  createStaticClient.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}

beforeEach(() => createStaticClient.mockReset());

describe("recently updated memes RSS feed", () => {
  it("renders on request so a database-less build cannot cache a failure", () => {
    expect(routeDynamic).toBe("force-dynamic");
  });

  it("orders by updated_at and lists only indexable memes", async () => {
    const query = useRows([
      row(1, false, "2026-03-03T00:00:00.000Z"),
      row(2, true, "2026-03-02T00:00:00.000Z"),
    ]);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(body).not.toContain("Meme 1</title>");
    expect(body).toContain("Meme 2</title>");
    expect(body).toContain(`<atom:link href="${SITE_URL}/feed/updated.xml" rel="self"`);
  });

  it("dates each item by its last body edit and keys the guid on that revision", async () => {
    useRows([row(2, true, "2026-03-02T04:05:06.000Z")]);

    const body = await (await GET()).text();

    expect(body).toContain("<pubDate>Mon, 02 Mar 2026 04:05:06 GMT</pubDate>");
    expect(body).toContain(
      `<guid isPermaLink="false">memecatch-m2-${Date.parse("2026-03-02T04:05:06.000Z")}</guid>`,
    );
    expect(body).not.toContain("Wed, 01 Jan 2025");
  });

  it("omits a future updated_at instead of inventing a date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));
    try {
      useRows([row(3, true, "2026-02-11T00:00:00.000Z")]);
      const body = await (await GET()).text();
      expect(body).toContain("Meme 3</title>");
      expect(body).not.toContain("<pubDate>");
      expect(body).toContain('<guid isPermaLink="false">memecatch-m3</guid>');
    } finally {
      vi.useRealTimers();
    }
  });
});
