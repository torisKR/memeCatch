// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

const mocks = vi.hoisted(() => ({ collect: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/thin-meme", async (original) => ({ ...await original(), collectIndexableWindow: mocks.collect }));
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme }: { meme: MemeListItem }) => <div data-testid="card">{meme.title}</div>,
}));
import { AUTO_LOAD_PAGES, ExploreGrid, PAGE_SIZE } from "@/components/explore-grid";

let page = 0;
function nextPage() {
  page += 1;
  const items = Array.from({ length: PAGE_SIZE }, (_, i) => ({
    id: `p${page}-${i}`,
    short_id: `p${page}x${i}`,
    title: `밈 ${page}-${i}`,
  }) as MemeListItem);
  return { items, scanned: PAGE_SIZE, hasMore: true };
}

let intersect: (() => void) | undefined;

beforeEach(() => {
  page = 0;
  mocks.collect.mockImplementation(async () => nextPage());
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const { ids } = JSON.parse(String(init.body)) as { ids: string[] };
    return { ok: true, json: async () => ({ previews: ids.map((id) => ({ id, contents: [] })) }) };
  }));
  // 센티넬이 화면(푸터 근처)에 계속 보이는 상태를 흉내 낸다: 관찰을 시작할 때마다 교차를 알린다.
  vi.stubGlobal("IntersectionObserver", class {
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
    observe() {
      intersect = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      queueMicrotask(intersect);
    }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); intersect = undefined; });

describe("explore infinite scroll near the footer", () => {
  it("stops auto-loading after a few pages so the footer stays reachable", async () => {
    const initial = nextPage().items;
    render(<ExploreGrid initial={initial} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);

    const expected = PAGE_SIZE * (1 + AUTO_LOAD_PAGES);
    await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(expected));
    const button = await screen.findByRole("button", { name: "밈 더 보기" });

    // 바닥에 머물러도(센티넬 교차가 다시 와도) 더 붙지 않는다.
    await act(async () => { intersect?.(); await Promise.resolve(); });
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.collect).toHaveBeenCalledTimes(AUTO_LOAD_PAGES);
    expect(screen.getAllByTestId("card")).toHaveLength(expected);

    // 버튼은 한 번에 한 페이지만 붙이고, 다시 자동 로드로 돌아가지 않는다.
    fireEvent.click(button);
    await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(expected + PAGE_SIZE));
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.collect).toHaveBeenCalledTimes(AUTO_LOAD_PAGES + 1);
    expect(screen.getByRole("button", { name: "밈 더 보기" })).toBeTruthy();
  });

  it("shows the end marker instead of the button once the catalog is exhausted", async () => {
    mocks.collect.mockImplementationOnce(async () => ({ ...nextPage(), hasMore: false }));
    render(<ExploreGrid initial={nextPage().items} hasMoreInitial filters={{ categories: [], sort: "trending" }} />);

    await screen.findByText("끝까지 봤어요");
    expect(screen.queryByRole("button", { name: "밈 더 보기" })).toBeNull();
    expect(mocks.collect).toHaveBeenCalledTimes(1);
  });
});
