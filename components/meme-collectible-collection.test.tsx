// @vitest-environment jsdom
import type { ComponentPropsWithoutRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeCardCollectionPage, MemeCollectibleCard } from "@/lib/meme-collectible";
const auth = vi.hoisted(() => ({ getUser: vi.fn(), listener: null as null | ((event: string) => void), refresh: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: auth.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: auth.getUser, onAuthStateChange: (listener: (event: string) => void) => { auth.listener = listener; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; } } }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/i18n-client", () => ({ useLocale: () => ({ locale: "ko" }) }));
import { MemeCollectibleCollection } from "./meme-collectible-collection";
const card: MemeCollectibleCard = { id: "mc-0001", cardNo: 1, edition: 1, artSeed: 1, memeId: "meme-a", title: "PPAP", slug: "ppap", href: "/memes/abcdef-ppap", summary: "공개된 설명", category: "song", originYear: 2016, thumbnailUrl: null, artMotif: "pen-pineapple", artSymbols: ["pen", "apple", "pineapple"], artComposition: "exchange" };
const initialPage: MemeCardCollectionPage = { cards: [{ ...card, available: true, claimedAt: "2026-10-07T01:00:00Z" }, { id: "mc-0002", available: false, claimedAt: "2026-10-07T01:00:00Z" }], page: 1, total: 28, pageSize: 24, hasMore: true };
const userResult = (id: string | null) => ({ data: { user: id ? { id, is_anonymous: false } : null }, error: null });
function deferred<T>() { let resolve!: (result: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { auth.getUser.mockResolvedValue(userResult("user-a")); auth.listener = null; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("private free meme card collection", () => {
  it("preserves the full owned count while server filters reduce matching cards", async () => {
    const fetcher = vi.fn(async (url: string) => { expect(url).toContain("query=PPAP"); return { ok: true, status: 200, json: async () => ({ ...initialPage, cards: [initialPage.cards[0]], total: 1, hasMore: false }) }; }); vi.stubGlobal("fetch", fetcher);
    render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>); const user = userEvent.setup();
    expect(await screen.findByText("28 / 1,000")).toBeTruthy(); expect(screen.getByText("내용 확인 중")).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "카드 이름 검색" }), "PPAP"); await user.click(screen.getByRole("button", { name: "찾기" }));
    await screen.findByRole("link", { name: "PPAP · 소장 중" }); expect(screen.getByText("28 / 1,000")).toBeTruthy();
    expect(fetcher.mock.calls[0][0]).toContain("query=PPAP"); expect(screen.queryByText("내용 확인 중")).toBeNull();
  });
  it("clears prior private content and counts when a request reports session expiry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 })));
    render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>);
    await screen.findByText("28 / 1,000");
    await userEvent.setup().click(screen.getByRole("button", { name: "찾기" }));
    expect(await screen.findByRole("link", { name: "로그인하고 보유하기" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "PPAP · 소장 중" })).toBeNull(); expect(screen.queryByText("28 / 1,000")).toBeNull();
  });
  it("renders a load failure distinctly from an empty collection and prompts anonymous accounts", () => {
    auth.getUser.mockResolvedValue(userResult(null));
    render(<MemeCollectibleCollection ownerUserId="anon" initialPage={null} initialError initialLoginRequired/>);
    expect(screen.getByRole("alert")).toBeTruthy(); expect(screen.queryByText("0 / 1,000")).toBeNull(); expect(screen.queryByText("아직 모은 밈카드가 없어요")).toBeNull();
    expect(screen.getByRole("link", { name: "로그인하고 보유하기" })).toBeTruthy();
  });
  it("gates cached SSR cards and counts until the current owner has been verified", async () => {
    const pending = deferred<ReturnType<typeof userResult>>(); auth.getUser.mockReturnValueOnce(pending.promise);
    render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>);
    expect(screen.queryByRole("link", { name: "PPAP · 소장 중" })).toBeNull(); expect(screen.queryByText("28 / 1,000")).toBeNull();
    await act(async () => pending.resolve(userResult("user-a")));
    expect(await screen.findByText("28 / 1,000")).toBeTruthy();
  });
  it("immediately clears cards and counts on event-only signout without making a collection request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>); await screen.findByText("28 / 1,000");
    act(() => auth.listener?.("SIGNED_OUT"));
    expect(screen.queryByRole("link", { name: "PPAP · 소장 중" })).toBeNull(); expect(screen.queryByText("28 / 1,000")).toBeNull();
    expect(screen.getByRole("link", { name: "로그인하고 보유하기" })).toBeTruthy(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("blocks account B under account A's SSR owner and ignores A's late filtered JSON response", async () => {
    const pending = deferred<MemeCardCollectionPage>();
    const fetcher = vi.fn(async (url: string, options: RequestInit) => { expect(url).toContain("query=PPAP"); expect(options.signal).toBeDefined(); return { ok: true, status: 200, json: () => pending.promise }; }); vi.stubGlobal("fetch", fetcher);
    const first = render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>); await screen.findByText("28 / 1,000");
    const user = userEvent.setup(); await user.type(screen.getByRole("textbox", { name: "카드 이름 검색" }), "PPAP"); await user.click(screen.getByRole("button", { name: "찾기" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    auth.getUser.mockResolvedValue(userResult("user-b"));
    act(() => auth.listener?.("SIGNED_IN"));
    expect(screen.queryByText("28 / 1,000")).toBeNull(); expect(screen.queryByRole("link", { name: "PPAP · 소장 중" })).toBeNull();
    await act(async () => pending.resolve({ ...initialPage, total: 1, hasMore: false }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("계정이 바뀌었어요"));
    expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
    fireEvent.submit(screen.getByRole("button", { name: "찾기" }).closest("form")!); expect(fetcher).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "다시 시도" })); expect(auth.refresh).toHaveBeenCalledOnce();
    first.unmount();
    const bPage = { ...initialPage, cards: [{ ...card, title: "새 계정 카드", available: true as const, claimedAt: "2026-10-07T01:00:00Z" }], total: 7, hasMore: false };
    fetcher.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...bPage, total: 1 }) });
    render(<MemeCollectibleCollection ownerUserId="user-b" initialPage={bPage}/>); await screen.findByText("7 / 1,000");
    await user.type(screen.getByRole("textbox", { name: "카드 이름 검색" }), "새 계정"); await user.click(screen.getByRole("button", { name: "찾기" }));
    await screen.findByRole("link", { name: "새 계정 카드 · 소장 중" }); expect(screen.getByText("7 / 1,000")).toBeTruthy(); expect(screen.queryByText("28 / 1,000")).toBeNull();
  });
  it("hides data during a same-account token refresh and restores only after verification", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>); await screen.findByText("28 / 1,000");
    const pending = deferred<ReturnType<typeof userResult>>(); auth.getUser.mockReturnValueOnce(pending.promise);
    act(() => auth.listener?.("TOKEN_REFRESHED")); expect(screen.queryByText("28 / 1,000")).toBeNull();
    await act(async () => pending.resolve(userResult("user-a")));
    expect(await screen.findByText("28 / 1,000")).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("detects cookie-only server logout on focus and account changes on visibility without SDK events", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const first = render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>); await screen.findByText("28 / 1,000");
    auth.getUser.mockResolvedValue(userResult(null)); fireEvent.focus(window);
    expect(screen.queryByText("28 / 1,000")).toBeNull(); expect(await screen.findByRole("link", { name: "로그인하고 보유하기" })).toBeTruthy(); first.unmount();
    auth.getUser.mockResolvedValue(userResult("user-a")); render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>); await screen.findByText("28 / 1,000");
    auth.getUser.mockResolvedValue(userResult("user-b")); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByText("28 / 1,000")).toBeNull(); expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("계정이 바뀌었어요")); expect(fetcher).not.toHaveBeenCalled();
  });
  it("clears private data conservatively after transport failure and can safely retry the verified owner's collection", async () => {
    auth.getUser.mockRejectedValueOnce(new Error("network"));
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => initialPage })); vi.stubGlobal("fetch", fetcher);
    render(<MemeCollectibleCollection ownerUserId="user-a" initialPage={initialPage}/>);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("상태를 확인하지 못했어요"));
    expect(screen.queryByText("28 / 1,000")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("28 / 1,000")).toBeTruthy(); expect(fetcher).toHaveBeenCalledOnce();
  });
});
