// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: [] }] }) }));
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

  it("retains same-page alternatives through repeated read failures and selects the public seed", async () => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement, fallback], scanned: 2, hasMore: false });
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ q: "오히려 좋아", categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).not.toHaveProperty("disabled", true));
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id));
    expect(screen.getAllByTestId("card")).toHaveLength(1);
    expect(screen.getByTestId("card").textContent).toContain("reviewed");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).ids).toEqual([id, fallback.id]);
    expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull();
  });

  it.each([
    { name: "both public", rows: [{ id, contents: [] }, { id: fallback.id, contents: [] }], winner: id },
    { name: "both missing", rows: [], winner: null },
  ])("reselects only public candidates after a same-page failure: $name", async ({ rows, winner }) => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement, fallback], scanned: 2, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: rows }) }));
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(screen.queryByTestId("card")?.getAttribute("data-item-id") ?? null).toBe(winner);
  });

  it("does not apply a delayed old-page response after a filter-key remount", async () => {
    let finish!: (value: unknown) => void;
    const delayed = new Promise((resolve) => { finish = resolve; });
    mocks.collect.mockResolvedValueOnce({ items: [replacement, fallback], scanned: 2, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(delayed));
    const view = render(<ExploreGrid key="old" initial={[]} hasMoreInitial filters={{ q: "old", categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const next = { ...card, id: "00000000-0000-4000-8000-000000000099", short_id: "next" };
    view.rerender(<ExploreGrid key="new" initial={[next]} filters={{ q: "new", categories: [], sort: "trending" }} />);
    await act(async () => { finish({ ok: true, json: async () => ({ previews: [{ id, contents: verified }] }) }); await delayed; });
    expect(screen.getAllByTestId("card")).toHaveLength(1);
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(next.id);
    expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull();
  });

  it("keeps equivalent candidates together across the retry API batch boundary", async () => {
    const earlier = Array.from({ length: 23 }, (_, i) => ({
      ...card, id: `00000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`, short_id: `other${i}`,
    }));
    mocks.collect.mockResolvedValueOnce({ items: earlier, scanned: 23, hasMore: true })
      .mockResolvedValueOnce({ items: [replacement, fallback], scanned: 2, hasMore: false });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: earlier.map((item) => ({ id: item.id, contents: [] })) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) });
    vi.stubGlobal("fetch", fetchMock);
    let observe: IntersectionObserverCallback | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: IntersectionObserverCallback) { observe = cb; } observe() {} disconnect() {} });
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(23));
    await waitFor(() => expect(observe).toBeTypeOf("function"));
    act(() => observe!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("끝까지 봤어요")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).not.toHaveProperty("disabled", true));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).ids).toEqual(earlier.map((item) => item.id));
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).ids).toEqual([id, fallback.id]);
    expect(screen.getAllByTestId("card").map((element) => element.getAttribute("data-item-id"))).toContain(fallback.id);
    expect(screen.getAllByTestId("card").map((element) => element.getAttribute("data-item-id"))).not.toContain(id);
  });

  it("does not let an unconfirmed earlier catalog hide a later public seed", async () => {
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [fallback], scanned: 1, hasMore: false });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) });
    vi.stubGlobal("fetch", fetchMock);
    let observe: IntersectionObserverCallback | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: IntersectionObserverCallback) { observe = cb; } observe() {} disconnect() {} });
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    await waitFor(() => expect(observe).toBeTypeOf("function"));
    act(() => observe!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id));
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id);
  });

  it("keeps a later confirmed seed when an earlier catalog retry finishes last", async () => {
    let finish!: (value: unknown) => void;
    const delayed = new Promise((resolve) => { finish = resolve; });
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [fallback], scanned: 1, hasMore: false });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockReturnValueOnce(delayed)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) });
    vi.stubGlobal("fetch", fetchMock);
    let observe: IntersectionObserverCallback | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: IntersectionObserverCallback) { observe = cb; } observe() {} disconnect() {} });
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(observe).toBeTypeOf("function"));
    act(() => observe!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id));
    await act(async () => { finish({ ok: true, json: async () => ({ previews: [] }) }); await delayed; });
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).not.toHaveProperty("disabled", true));
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id);
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id);
    expect(screen.getByTestId("card").textContent).toContain("reviewed");
  });

  it("keeps a failed first-page card in place when its preview retry succeeds after a later page", async () => {
    const later = { ...card, id: "00000000-0000-4000-8000-000000000099", short_id: "later" };
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [later], scanned: 1, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: later.id, contents: [{ content_id: "later-preview" }] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id, contents: verified }] }) }));
    let observe: IntersectionObserverCallback | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: IntersectionObserverCallback) { observe = cb; } observe() {} disconnect() {} });
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    await waitFor(() => expect(observe).toBeTypeOf("function"));
    act(() => observe!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(screen.getAllByTestId("card").map((element) => element.getAttribute("data-item-id"))).toEqual([id, later.id]);
    expect(screen.getAllByTestId("card")[0].textContent).toContain("reviewed");
    expect(screen.getAllByTestId("card")[1].textContent).toContain("later-preview");
  });

  it("replaces a seed in its existing slot when its catalog row arrives on a later page", async () => {
    const later = { ...card, id: "00000000-0000-4000-8000-000000000099", short_id: "other" };
    mocks.collect.mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [{ id, contents: verified }] }) }));
    intersectImmediately();
    render(<ExploreGrid initial={[fallback, later]} initialPreviews={[[], [{ content_id: "later-preview" }] as never]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    await waitFor(() => expect(screen.getByText("끝까지 봤어요")).toBeTruthy());
    expect(screen.getAllByTestId("card").map((element) => element.getAttribute("data-item-id"))).toEqual([id, later.id]);
    expect(screen.getAllByTestId("card")[1].textContent).toContain("later-preview");
  });

  it("replaces an unavailable provisional catalog with the public seed in the same slot", async () => {
    const later = { ...card, id: "00000000-0000-4000-8000-000000000099", short_id: "later" };
    mocks.collect.mockResolvedValueOnce({ items: [replacement, fallback], scanned: 2, hasMore: true })
      .mockResolvedValueOnce({ items: [later], scanned: 1, hasMore: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: later.id, contents: [{ content_id: "later-preview" }] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) }));
    let observe: IntersectionObserverCallback | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: IntersectionObserverCallback) { observe = cb; } observe() {} disconnect() {} });
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    await waitFor(() => expect(observe).toBeTypeOf("function"));
    act(() => observe!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(screen.getAllByTestId("card").map((element) => element.getAttribute("data-item-id"))).toEqual([fallback.id, later.id]);
    expect(screen.getAllByTestId("card")[0].textContent).toContain("reviewed");
    expect(screen.getAllByTestId("card")[1].textContent).toContain("later-preview");
  });

  it("rechecks the current catalog together with a pending seed before selecting a winner", async () => {
    mocks.collect.mockResolvedValueOnce({ items: [fallback], scanned: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [replacement], scanned: 1, hasMore: false });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id, contents: [] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id: fallback.id, contents: verified }] }) });
    vi.stubGlobal("fetch", fetchMock);
    let observe: IntersectionObserverCallback | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: IntersectionObserverCallback) { observe = cb; } observe() {} disconnect() {} });
    render(<ExploreGrid initial={[]} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "계속 찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).toBeTruthy());
    await waitFor(() => expect(observe).toBeTypeOf("function"));
    act(() => observe!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(id));
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).ids).toEqual(expect.arrayContaining([id, fallback.id]));
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(fallback.id);
  });

  it("removes an initially unverified card when the public retry omits it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ previews: [] }) }));
    render(<ExploreGrid initial={[replacement]} initialPreviewUnavailable filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByTestId("card")).toBeNull());
    expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull();
  });

  it("treats malformed public lookup rows as a retryable failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id, contents: null }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ previews: [{ id, contents: verified }] }) }));
    render(<ExploreGrid initial={[replacement]} initialPreviewUnavailable filters={{ categories: [], sort: "trending" }} />);
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "미리보기 다시 불러오기" })).not.toHaveProperty("disabled", true));
    expect(screen.getByTestId("card").getAttribute("data-item-id")).toBe(id);
    fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "미리보기 다시 불러오기" })).toBeNull());
    expect(screen.getByTestId("card").textContent).toContain("reviewed");
  });
});
