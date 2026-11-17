import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ collect: vi.fn(), qualify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createStaticClient: () => ({}) }));
vi.mock("@/lib/index-gate.server", () => ({ loadDiscoveryIndex: async () => ({ ok: true, ids: new Set(["seed", "catalog"]) }) }));
vi.mock("@/lib/thin-meme", async (original) => ({ ...await original(), collectIndexableWindow: mocks.collect }));
vi.mock("@/lib/search-preview.server", () => ({ qualifySearchPreviews: mocks.qualify }));
vi.mock("@/lib/explore-preview-deadline.server", () => ({
  createPreviewDeadlineDb: () => ({}),
  withPreviewDeadline: (run: (signal: AbortSignal) => unknown) => run(new AbortController().signal),
}));
vi.mock("@/components/explore-grid", () => ({ ExploreGrid: () => null }));

import { ExploreGrid } from "@/components/explore-grid";
import ExplorePage from "./page";

const seed = { id: "seed", short_id: "oyj2021k", title: "오히려 좋아" };
const catalog = { id: "catalog", short_id: "6hgbgvxs", title: "오히려 좋아" };
const unrelated = { id: "unrelated", short_id: "different", title: "오히려 좋아" };

function findGrid(node: ReactNode): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findGrid(child);
      if (result) return result;
    }
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === ExploreGrid) return node.props;
  return findGrid(node.props.children);
}

beforeEach(() => {
  mocks.collect.mockReset();
  mocks.qualify.mockReset();
  mocks.qualify.mockImplementation(async (items: typeof seed[]) => items.map((item) => [{ content_id: item.id }]));
});

describe("explore server presentation", () => {
  it.each([{}, { q: "오히려 좋아" }])("selects catalog and aligns previews for search and normal browse: %o", async (searchParams) => {
    mocks.collect.mockResolvedValue({ items: [seed, unrelated, catalog], scanned: 3, hasMore: true });
    const grid = findGrid(await ExplorePage({ searchParams: Promise.resolve(searchParams) }));
    expect(grid?.initial).toEqual([unrelated, catalog]);
    expect(grid?.initialPreviews).toEqual([[{ content_id: "unrelated" }], [{ content_id: "catalog" }]]);
    expect(grid?.initialOffset).toBe(3);
    expect(grid?.hasMoreInitial).toBe(true);
  });
});
