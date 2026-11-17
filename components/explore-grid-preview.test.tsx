// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

const mocks = vi.hoisted(() => ({ collect: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/thin-meme", async (original) => ({ ...await original(), collectIndexableWindow: mocks.collect }));
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme, previewContents }: { meme: MemeListItem; previewContents: unknown }) => (
    <div data-testid="card" data-item-id={meme.id}>{JSON.stringify(previewContents)}</div>
  ),
}));
import { ExploreGrid } from "@/components/explore-grid";

const id = "00000000-0000-4000-8000-000000000001";
const card = { id, title: "테스트 밈", meme_contents: [{ content_id: "unreviewed" }] } as unknown as MemeListItem;
const verified = [{ content_id: "reviewed" }];
const fallback = { id: "5062885d-2d6f-577c-a7dd-2187b1cf3bd2", short_id: "oyj2021k", title: "fallback" } as MemeListItem;
const replacement = { ...card, short_id: "6hgbgvxs" } as MemeListItem;

function intersectImmediately() {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      queueMicrotask(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never));
    }
    observe() {}
    disconnect() {}
  });
}
beforeEach(() => {
  mocks.collect.mockResolvedValue({ items: [card], scanned: 1, hasMore: false });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("explore pagination preview policy", () => {
  it("renders only the server-qualified result for a newly loaded card", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [{ id, contents: verified }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByTestId("card").textContent).toContain("reviewed"));
    expect(screen.getByTestId("card").textContent).not.toContain("unreviewed");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ids: [id] });
  });
  it("still shows the card without an unqualified preview when lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id, contents: verified }] }) }));
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByTestId("card").textContent).toBe("[]"));
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.getByTestId("card").textContent).toContain("reviewed"));
    expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull();
  });

  it("replaces the curated fallback with its later catalog result and remaps the preview", async () => {
    const curated = {
      id: "curated-ohiryeo-joha",
      short_id: "oyj2021k",
      title: "오히려 좋아",
    } as MemeListItem;
    const catalog = {
      ...card,
      id,
      short_id: "6hgbgvxs",
      title: "오히려 좋아",
    } as MemeListItem;
    mocks.collect.mockResolvedValueOnce({ items: [catalog], scanned: 1, hasMore: false });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ previews: [{ id, contents: verified }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        queueMicrotask(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never));
      }
      observe() {}
      disconnect() {}
    });

    render(
      <ExploreGrid
        initial={[curated]}
        initialPreviews={[[{ content_id: "curated-poster" } as never]]}
        hasMoreInitial
        filters={{ q: "오히려 좋아", categories: [], sort: "trending" }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(id));
    expect(screen.getAllByTestId("card")).toHaveLength(1);
    expect(screen.getByTestId("card").textContent).toContain("reviewed");
    expect(screen.getByTestId("card").textContent).not.toContain("curated-poster");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ids: [id] });
  });

  it.each(["검색", "일반 탐색"])("keeps the seed if the later catalog ID is absent from public preview lookup (%s)", async (mode) => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [] }) }));
    intersectImmediately();
    render(<ExploreGrid initial={[fallback]} initialPreviews={[verified as never]} hasMoreInitial filters={{ q: mode === "검색" ? "오히려 좋아" : undefined, categories: [], sort: "trending" }} />);
    await waitFor(() => expect(screen.getByText("끝까지 봤어요")).toBeTruthy());
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id);
    expect(screen.getByTestId("card").textContent).toContain("reviewed");
  });

  it.each(["검색", "일반 탐색"])("replaces a database seed with a public catalog row (%s)", async (mode) => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [{ id, contents: verified }] }) }));
    intersectImmediately();
    render(<ExploreGrid initial={[fallback]} hasMoreInitial filters={{ q: mode === "검색" ? "오히려 좋아" : undefined, categories: [], sort: "trending" }} />);
    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(id));
    expect(screen.getAllByTestId("card")).toHaveLength(1);
    expect(screen.getByTestId("card").textContent).toContain("reviewed");
  });

  it("retries a failed replacement without discarding the current fallback", async () => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id, contents: [] }] }) }));
    intersectImmediately();
    render(<ExploreGrid initial={[fallback]} initialPreviews={[verified as never]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id);
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(id));
    expect(screen.getByTestId("card").textContent).toBe("[]");
    expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull();
  });

  it("keeps the fallback when a failed replacement retry is no longer public", async () => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [] }) }));
    intersectImmediately();
    render(<ExploreGrid initial={[fallback]} hasMoreInitial filters={{ q: "오히려 좋아", categories: [], sort: "trending" }} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id);
  });

  it("keeps a public seed from the same batch when the catalog candidate disappears", async () => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement, fallback], scanned: 2, hasMore: false });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: [] }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).ids).toEqual([id, fallback.id]);
  });
});
