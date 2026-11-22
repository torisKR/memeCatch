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

it("does not restore an unobserved seed after initial preview failure and a missing public catalog row", async () => {
  const catalog = { id: "00000000-0000-4000-8000-000000000001", short_id: "6hgbgvxs", title: "오히려 좋아" };
  mocks.collect.mockResolvedValue({ items: [catalog], scanned: 1, hasMore: false });
  mocks.qualify.mockRejectedValue(new Error("ledger unavailable"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [] }) }));
  const grid = findGrid(await ExplorePage({ searchParams: Promise.resolve({ q: "오히려 좋아" }) }));
  expect(grid).toBeTruthy();
  render(grid!);
  expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(catalog.id);
  fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
  expect(screen.queryByTestId("card")).toBeNull();
});

it.each([
  { name: "seed remains public", previews: [{ id: "5062885d-2d6f-577c-a7dd-2187b1cf3bd2", contents: [] }], winner: "5062885d-2d6f-577c-a7dd-2187b1cf3bd2" },
  { name: "both are private", previews: [], winner: null },
  { name: "catalog remains public", previews: [{ id: "00000000-0000-4000-8000-000000000001", contents: [] }], winner: "00000000-0000-4000-8000-000000000001" },
  { name: "both remain public", previews: [{ id: "5062885d-2d6f-577c-a7dd-2187b1cf3bd2", contents: [] }, { id: "00000000-0000-4000-8000-000000000001", contents: [] }], winner: "00000000-0000-4000-8000-000000000001" },
])("rechecks the suppressed SSR database seed when $name", async ({ previews, winner }) => {
  const catalog = { id: "00000000-0000-4000-8000-000000000001", short_id: "6hgbgvxs", title: "오히려 좋아" };
  const seed = { id: "5062885d-2d6f-577c-a7dd-2187b1cf3bd2", short_id: "oyj2021k", title: "오히려 좋아" };
  mocks.collect.mockResolvedValue({ items: [seed, catalog], scanned: 2, hasMore: false });
  mocks.qualify.mockRejectedValue(new Error("ledger unavailable"));
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews }) });
  vi.stubGlobal("fetch", fetchMock);
  const grid = findGrid(await ExplorePage({ searchParams: Promise.resolve({ q: "오히려 좋아" }) }));
  render(grid!);
  expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(catalog.id);
  fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
  expect(screen.queryByTestId("card")?.getAttribute("data-item-id") ?? null).toBe(winner);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).ids).toEqual(expect.arrayContaining([catalog.id, seed.id]));
});
