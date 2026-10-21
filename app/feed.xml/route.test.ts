import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

import { GET } from "@/app/feed.xml/route";

function row(
  index: number,
  indexable: boolean,
  publishedAt: string | null = "2026-02-01T00:00:00.000Z",
  updatedAt = "2026-02-02T00:00:00.000Z",
) {
  return {
    id: `id-${String(index).padStart(4, "0")}`,
    short_id: `m${index}`,
    slug: `meme-${index}`,
    title: `Meme ${index}`,
    summary: `Summary ${index}`,
    category: "phrase",
    published_at: publishedAt,
    updated_at: updatedAt,
    description: indexable ? "d".repeat(400) : "thin",
    origin: indexable ? "o".repeat(60) : "",
    usage_note: null,
    caution: null,
    usage_examples: [],
    moderation_status: "approved",
    meme_sources: [] as Array<{ source_url: string; production_id?: string | null }>,
    meme_contents: [] as Array<{
      availability: string;
      moderation_status: string;
      production_id?: string | null;
    }>,
    meme_tags_map: [],
  };
}

function useRows(
  rows: ReturnType<typeof row>[],
  options: { returnedError?: string; thrownError?: string } = {},
) {
  const order = vi.fn(() => query);
  const result = (data: ReturnType<typeof row>[]) => {
    if (options.thrownError) throw new Error(options.thrownError);
    return {
      data: options.returnedError ? null : data,
      error: options.returnedError ? { message: options.returnedError } : null,
    };
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order,
    range: vi.fn(async (from: number, to: number) => result(rows.slice(from, to + 1))),
    limit: vi.fn(async (limit: number) => result(rows.slice(0, limit))),
  };
  createStaticClient.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}

beforeEach(() => createStaticClient.mockReset());

describe("RSS publication export", () => {
  it("filters with isIndexableMeme before applying the 30 item limit and pages stably", async () => {
    const rows = [
      ...Array.from({ length: 1_000 }, (_, index) => row(index, false)),
      ...Array.from({ length: 35 }, (_, index) => row(index + 1_000, true)),
    ];
    const query = useRows(rows);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body.match(/<item>/g)).toHaveLength(30);
    expect(body).not.toContain("Meme 0</title>");
    expect(body).toContain("Meme 1000</title>");
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(query.order).toHaveBeenCalledWith("published_at", {
      ascending: false,
      nullsFirst: false,
    });
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false });
  });

  it("uses only a real published_at as pubDate and derives lastBuildDate from stored data", async () => {
    useRows([
      row(1, true, null),
      row(2, true, "2026-02-03T04:05:06.000Z"),
    ]);

    const response = await GET();
    const body = await response.text();

    expect(body.match(/<pubDate>/g)).toHaveLength(1);
    expect(body).toContain("<pubDate>Tue, 03 Feb 2026 04:05:06 GMT</pubDate>");
    expect(body).toContain("<lastBuildDate>Mon, 02 Feb 2026 00:00:00 GMT</lastBuildDate>");
  });

  it("omits absent, impossible, and future dates without falling back to updated_at or now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));
    try {
      useRows([
        row(1, true, null, "2026-02-01T00:00:00.000Z"),
        row(2, true, "2026-02-30T00:00:00.000Z", "2026-02-30T00:00:00.000Z"),
        row(3, true, "2026-02-11T00:00:00.000Z", "2026-02-11T00:00:00.000Z"),
      ]);

      const body = await (await GET()).text();

      expect(body).not.toContain("<pubDate>");
      expect(body).toContain(
        "<lastBuildDate>Sun, 01 Feb 2026 00:00:00 GMT</lastBuildDate>",
      );
      expect(body).not.toContain("Tue, 10 Feb 2026 12:00:00 GMT");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["returned", "thrown"] as const)(
    "returns 503 with Retry-After for %s query errors",
    async (kind) => {
      useRows([], kind === "returned"
        ? { returnedError: "database unavailable" }
        : { thrownError: "network unavailable" });

      const response = await GET();

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("300");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it("keeps a valid empty feed distinct from an error", async () => {
    useRows([]);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain("<item>");
    expect(body).not.toContain("<lastBuildDate>");
  });

  it("does not let produced-only media make a boundary-thin item eligible", async () => {
    const producedOnly = row(77, false);
    producedOnly.description = "d".repeat(150);
    producedOnly.origin = "o".repeat(30);
    producedOnly.meme_sources = [
      { source_url: "https://example.com/source-a" },
      { source_url: "https://example.com/source-b" },
    ];
    producedOnly.meme_contents = [
      {
        availability: "live",
        moderation_status: "approved",
        production_id: "produced-video-1",
      },
    ];
    const query = useRows([producedOnly]);

    const body = await (await GET()).text();

    expect(body).not.toContain("Meme 77</title>");
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("meme_sources(*)"));
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("meme_contents(*)"));
  });
});
