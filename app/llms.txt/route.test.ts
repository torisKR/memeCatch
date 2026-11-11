import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

import { GET, dynamic as routeDynamic } from "@/app/llms.txt/route";

function row(index: number, indexable: boolean) {
  return {
    id: `id-${String(index).padStart(4, "0")}`,
    title: `Meme ${index}`,
    summary: `Summary ${index}`,
    short_id: `m${index}`,
    slug: `meme-${index}`,
    description: indexable ? "d".repeat(400) : "thin",
    origin: indexable ? "o".repeat(60) : "",
    usage_note: null,
    caution: null,
    usage_examples: [],
    meme_sources: [],
    meme_contents: [],
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
      count: options.returnedError ? null : rows.length,
    };
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order,
    range: vi.fn(async (from: number, to: number) => result(rows.slice(from, to + 1))),
    limit: vi.fn(async (limit: number) => result(rows.slice(0, limit))),
    then: undefined,
  };
  createStaticClient.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}

beforeEach(() => createStaticClient.mockReset());

describe("llms.txt publication export", () => {
  it("renders on request so a database-less build cannot cache a failure", () => {
    expect(routeDynamic).toBe("force-dynamic");
  });

  it("counts only indexable approved rows and applies the 15 item limit after filtering", async () => {
    const rows = [
      ...Array.from({ length: 1_000 }, (_, index) => row(index, false)),
      ...Array.from({ length: 20 }, (_, index) => row(index + 1_000, true)),
    ];
    const query = useRows(rows);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("한국 밈·유행어·챌린지 20건");
    expect(body).not.toContain("3,000+");
    expect(body.match(/^- \[Meme /gm)).toHaveLength(15);
    expect(body).not.toContain("[Meme 0]");
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(query.order).toHaveBeenCalledWith("trend_score", { ascending: false });
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false });
  });

  it.each(["returned", "thrown"] as const)(
    "returns 503 with Retry-After for %s query errors",
    async (kind) => {
      useRows([], kind === "returned"
        ? { returnedError: "database unavailable" }
        : { thrownError: "network unavailable" });

      const response = await GET();
      const body = await response.text();

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("300");
      expect(body).not.toContain("3,000+");
    },
  );

  it("returns a truthful zero-count document for a valid empty result", async () => {
    useRows([]);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("한국 밈·유행어·챌린지 0건");
    expect(body).not.toContain("3,000+");
  });

  it("describes inclusion as approval plus indexability, not independent fact review", async () => {
    useRows([]);

    const body = await (await GET()).text();

    expect(body).toContain("공개 승인 상태");
    expect(body).toContain("콘텐츠 충실도 기준");
    expect(body).not.toContain("사실 확인 → 저작권 확인");
  });
});
