// @vitest-environment jsdom
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ collect: vi.fn(), qualify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createStaticClient: () => ({}) }));
vi.mock("@/lib/index-gate.server", () => ({ loadDiscoveryIndex: async () => ({ ok: true, ids: new Set(["00000000-0000-4000-8000-000000000001"]) }) }));
vi.mock("@/lib/thin-meme", async (original) => ({ ...await original(), collectIndexableWindow: mocks.collect }));
vi.mock("@/lib/search-preview.server", () => ({ qualifySearchPreviews: mocks.qualify }));
vi.mock("@/lib/explore-preview-deadline.server", () => ({
  createPreviewDeadlineDb: () => ({}),
  withPreviewDeadline: async (run: (signal: AbortSignal) => unknown) => {
    try { return await run(new AbortController().signal); } catch { return null; }
  },
}));
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme }: { meme: { id: string } }) => <div data-testid="card" data-item-id={meme.id} />,
}));

import { ExploreGrid } from "@/components/explore-grid";
import ExplorePage from "./page";

function findGrid(node: ReactNode): ReactElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findGrid(child);
      if (result) return result;
    }
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === ExploreGrid) return node;
  return findGrid(node.props.children);
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

it("recovers the SSR-suppressed curated card after the initial preview failure and a missing public catalog row", async () => {
  const catalog = { id: "00000000-0000-4000-8000-000000000001", short_id: "6hgbgvxs", title: "오히려 좋아" };
  mocks.collect.mockResolvedValue({ items: [catalog], scanned: 1, hasMore: false });
  mocks.qualify.mockRejectedValue(new Error("ledger unavailable"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [] }) }));
  const grid = findGrid(await ExplorePage({ searchParams: Promise.resolve({ q: "오히려 좋아" }) }));
  expect(grid).toBeTruthy();
  render(grid!);
  expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(catalog.id);
  fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
  await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe("curated-ohiryeo-joha"));
});
