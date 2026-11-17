// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

const mocks = vi.hoisted(() => ({ collect: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/thin-meme", async (original) => ({ ...await original(), collectIndexableWindow: mocks.collect }));
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ previewContents }: { previewContents: unknown }) => <div data-testid="card">{JSON.stringify(previewContents)}</div>,
}));
import { ExploreGrid } from "@/components/explore-grid";

const id = "00000000-0000-4000-8000-000000000001";
const card = { id, title: "테스트 밈", meme_contents: [{ content_id: "unreviewed" }] } as unknown as MemeListItem;
const verified = [{ content_id: "reviewed" }];
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
});
