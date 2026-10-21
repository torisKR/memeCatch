import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

import { GET } from "@/app/llms-full.txt/route";

const source = readFileSync(
  join(process.cwd(), "app/llms-full.txt/route.ts"),
  "utf8",
);

function row(index: number, indexable: boolean) {
  return {
    id: `id-${String(index).padStart(4, "0")}`,
    title: `Meme ${index}`,
    short_id: `m${index}`,
    slug: `meme-${index}`,
    summary: `Summary ${index}`,
    description: indexable ? "d".repeat(400) : "thin",
    origin: indexable ? "o".repeat(60) : "",
    origin_year: 2026,
    usage_note: null as string | null,
    caution: null as string | null,
    aliases: [],
    published_at: "2026-10-20T00:00:00.000Z",
    moderation_status: "approved",
    category: "phrase",
    safety_level: "green",
    usage_examples: [] as unknown,
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

describe("llms-full category grouping", () => {
  it("keeps the tag-backed AI collection out of legacy format grouping", () => {
    expect(source).toContain(
      "displayCategory.key === AI_MEME_DISPLAY_CATEGORY",
    );
  });
});

describe("llms-full publication export", () => {
  it("counts all eligible rows and applies the 400 item limit only after filtering", async () => {
    const rows = [
      ...Array.from({ length: 1_000 }, (_, index) => row(index, false)),
      ...Array.from({ length: 405 }, (_, index) => row(index + 1_000, true)),
    ];
    const query = useRows(rows);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("한국 밈·유행어·챌린지 405건");
    expect(body).not.toContain("3,000+");
    expect(body.match(/^### Meme /gm)).toHaveLength(400);
    expect(body).not.toContain("### Meme 0\n");
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(query.order).toHaveBeenCalledWith("published_at", { ascending: false, nullsFirst: false });
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

  it("exports validated usage examples and keeps caution separate from usage", async () => {
    const meme = row(1, true);
    meme.usage_note = "친구와 맥락을 공유한 상황에서 사용합니다.";
    meme.caution = "공식적인 자리에서는 사용하지 않는 편이 좋습니다.";
    meme.usage_examples = [
      { situation: "친구 대화", text: "이게 바로 새삥이지." },
      { situation: "", text: "노출되면 안 되는 예문" },
    ];
    useRows([meme]);

    const body = await (await GET()).text();

    expect(body).toContain("- 사용법: 친구와 맥락을 공유한 상황에서 사용합니다.");
    expect(body).toContain("- 주의: 공식적인 자리에서는 사용하지 않는 편이 좋습니다.");
    expect(body).toContain("- 활용 예 · 친구 대화: 이게 바로 새삥이지.");
    expect(body).not.toContain("노출되면 안 되는 예문");
  });

  it("escapes stored Markdown and HTML syntax across headings and prose", async () => {
    const meme = row(1, true);
    meme.title = "Title\n# injected ](https://evil.example)";
    meme.summary = "`summary` <script>alert(1)</script>";
    meme.usage_note = "Usage\n---\n# heading";
    useRows([meme]);

    const body = await (await GET()).text();

    expect(body).not.toContain("\n# injected");
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("](https://evil.example)");
    expect(body).toContain("\\# injected");
  });
});
