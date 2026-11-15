import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/db/cache-tags";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
  unstableCache: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("next/cache", () => ({
  unstable_cache: mocks.unstableCache.mockImplementation(
    (fn: () => Promise<unknown>) => {
      let cached: Promise<unknown> | undefined;
      return () => {
        cached ??= fn();
        return cached;
      };
    },
  ),
}));
vi.mock("@/lib/db/server", () => ({
  createStaticClient: mocks.createStaticClient,
}));

describe("discovery index server cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("shares the public catalog invalidation tag with admin and source mutations", async () => {
    await import("@/lib/index-gate.server");

    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["public-discovery-index-v1"],
      {
        revalidate: 60 * 60,
        tags: [PUBLIC_CATALOG_CACHE_TAG, "public-discovery-index"],
      },
    );
  });

  it("reuses one full catalog scan across separate loader calls", async () => {
    const row = {
      id: "eligible",
      category: "phrase",
      origin_year: 2026,
      description: "설명".repeat(100),
      origin: "유래".repeat(40),
      usage_note: null,
      caution: null,
      usage_examples: [],
      meme_sources: [
        { source_url: "https://example.com/a" },
        { source_url: "https://example.com/b" },
      ],
      meme_contents: [],
      meme_tags_map: [],
    };
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({ data: [row], error: null }),
    };
    for (const key of ["select", "in", "order"] as const) query[key].mockReturnValue(query);
    mocks.createStaticClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    const { loadDiscoveryIndex } = await import("@/lib/index-gate.server");

    const first = await loadDiscoveryIndex();
    const second = await loadDiscoveryIndex();

    expect(first).toEqual({ ok: true, ids: new Set(["eligible"]) });
    expect(second).toEqual(first);
    expect(query.range).toHaveBeenCalledTimes(1);
  });
});
