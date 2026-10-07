// @vitest-environment jsdom
import type { ComponentPropsWithoutRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeCollectibleCard } from "@/lib/meme-collectible";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), listener: null as null | ((event: string) => void), unsubscribe: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/i18n-client", () => ({ useLocale: () => ({ locale: "ko" }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: auth.getUser, onAuthStateChange: (listener: (event: string) => void) => { auth.listener = listener; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; } } }) }));
vi.mock("./meme-collectible-scratch", () => ({ MemeCollectibleScratch: ({ card, revealed, onReveal }: { card: MemeCollectibleCard; revealed: boolean; onReveal: () => void }) => <div data-scratch-card={card.id}>{!revealed && <button onClick={onReveal}>바로 공개</button>}</div> }));
import { MemeCollectibleGallery } from "./meme-collectible-gallery";

const card: MemeCollectibleCard = { id: "mc-0001", cardNo: 1, edition: 1, artSeed: 42, memeId: "meme-a", title: "PPAP", slug: "ppap", href: "/memes/abcdef-ppap", summary: "펜과 과일이 만나는 노래", category: "song", originYear: 2016, thumbnailUrl: null, artMotif: "pen-pineapple", artSymbols: ["pen", "apple", "pineapple"], artComposition: "exchange" };
const second = { ...card, id: "mc-0002", cardNo: 2, title: "강남스타일", artMotif: "dance" as const };
const catalog = { cards: [card, second], total: 1000, page: 1, pageSize: 24, hasMore: true };
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let fetchMock: ReturnType<typeof vi.fn>;
function posts() { return fetchMock.mock.calls.filter(([, options]) => options?.method === "POST"); }
function deferred() { let resolve!: (value: ReturnType<typeof json>) => void; const promise = new Promise<ReturnType<typeof json>>(done => { resolve = done; }); return { promise, resolve }; }
function renderRevealed() { return render(<MemeCollectibleGallery catalog={catalog} initialSelected={card} initialRevealed/>); }

beforeEach(() => {
  window.history.replaceState(null, "", "/meme-cards?card=mc-0001&revealed=1");
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-a", is_anonymous: false } }, error: null });
  fetchMock = vi.fn(async () => json({ ownedCardIds: [] })); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("meme card collection actions", () => {
  it("keeps the exact revealed guest card in the login return and never automatically claims on return", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const rendered = renderRevealed();
    const link = await screen.findByRole("link", { name: "로그인하고 보유하기" });
    const next = new URL(link.getAttribute("href")!, "https://test.local").searchParams.get("next")!;
    expect(new URL(next, "https://test.local").searchParams.get("card")).toBe("mc-0001");
    expect(next).toContain("revealed=1"); expect(posts()).toHaveLength(0);
    rendered.unmount(); renderRevealed();
    await screen.findByRole("button", { name: "보유하기" });
    expect(posts()).toHaveLength(0); expect(document.getElementById("reveal")?.dataset.cardId).toBe("mc-0001");
  });
  it("guards double clicks, stays unowned until confirmation, and accepts an idempotent duplicate result", async () => {
    const pending = deferred();
    fetchMock.mockImplementation((url: string) => url.includes("/claim") ? pending.promise : Promise.resolve(json({ ownedCardIds: [] })));
    renderRevealed(); const user = userEvent.setup();
    await user.dblClick(await screen.findByRole("button", { name: "보유하기" }));
    expect(posts()).toHaveLength(1); expect(screen.queryByText("소장 중 ✓")).toBeNull();
    expect(screen.getByRole("button", { name: "보유하는 중…" }).hasAttribute("disabled")).toBe(true);
    await act(async () => pending.resolve(json({ cardId: card.id, owned: true, claimedAt: "2026-10-07T01:00:00Z" })));
    expect(await screen.findByText("소장 중 ✓")).toBeTruthy();
  });
  it("preserves reveal across a failed claim and retry, then session expiration", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(url.includes("/claim") ? json({}, posts().length === 1 ? 503 : 401) : json({ ownedCardIds: [] })));
    renderRevealed(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "보유하기" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("보유하지 못했어요"));
    expect(document.getElementById("reveal")?.dataset.revealed).toBe("true");
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("link", { name: "로그인하고 보유하기" })).toBeTruthy();
    expect(screen.queryByText("소장 중 ✓")).toBeNull();
  });
  it("ignores a late claim after another card is selected", async () => {
    const pending = deferred(); fetchMock.mockImplementation((url: string) => url.includes("/claim") ? pending.promise : Promise.resolve(json({ ownedCardIds: [] })));
    renderRevealed(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "보유하기" }));
    await user.click(screen.getByRole("button", { name: "강남스타일 · 이 카드 공개하기" }));
    await act(async () => pending.resolve(json({}, 503)));
    expect(document.getElementById("reveal")?.dataset.cardId).toBe(second.id);
    expect(screen.queryByRole("alert")).toBeNull(); expect(screen.queryByText("소장 중 ✓")).toBeNull();
  });
  it("aborts an in-flight claim across account changes and rejects old-account success", async () => {
    const pending = deferred(); fetchMock.mockImplementation((url: string) => url.includes("/claim") ? pending.promise : Promise.resolve(json({ ownedCardIds: [] })));
    renderRevealed(); await userEvent.setup().click(await screen.findByRole("button", { name: "보유하기" }));
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-b", is_anonymous: false } }, error: null });
    await act(async () => auth.listener?.("SIGNED_IN"));
    await act(async () => pending.resolve(json({ cardId: card.id, owned: true })));
    await waitFor(() => expect(screen.getByRole("button", { name: "보유하기" })).toBeTruthy());
    expect(screen.queryByText("소장 중 ✓")).toBeNull(); expect(posts()[0][1].signal.aborted).toBe(true);
  });
  it("asks anonymous Supabase users to log in and lets transport failures retry verification", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: "anon", is_anonymous: true } }, error: null });
    const first = renderRevealed(); expect(await screen.findByRole("link", { name: "로그인하고 보유하기" })).toBeTruthy(); first.unmount();
    auth.getUser.mockRejectedValueOnce(new Error("network")); renderRevealed();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("상태를 확인하지 못했어요"));
    expect(screen.queryByRole("link", { name: "로그인하고 보유하기" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("button", { name: "보유하기" })).toBeTruthy(); expect(posts()).toHaveLength(0);
  });
  it("rejects a former owner's delayed ownership JSON across account changes", async () => {
    let resolve!: (value: { ownedCardIds: string[] }) => void;
    const payload = new Promise<{ ownedCardIds: string[] }>(done => { resolve = done; });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => payload });
    renderRevealed(); await screen.findByRole("button", { name: "보유하기" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const firstSignal = fetchMock.mock.calls[0][1].signal;
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-b", is_anonymous: false } }, error: null });
    await act(async () => { auth.listener?.("SIGNED_IN"); resolve({ ownedCardIds: [card.id] }); });
    await screen.findByRole("button", { name: "보유하기" });
    expect(firstSignal.aborted).toBe(true); expect(screen.queryByText("소장 중 ✓")).toBeNull();
  });
  it("clears ownership on an ownership-query 401 and keeps the revealed card's login return", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401)); renderRevealed();
    const link = await screen.findByRole("link", { name: "로그인하고 보유하기" });
    expect(link.getAttribute("href")).toContain("mc-0001"); expect(document.getElementById("reveal")?.dataset.revealed).toBe("true"); expect(posts()).toHaveLength(0);
  });
  it("detects server-side cookie logout on focus without an SDK signout event", async () => {
    fetchMock.mockResolvedValueOnce(json({ ownedCardIds: [card.id] })); renderRevealed();
    expect(await screen.findByText("소장 중 ✓")).toBeTruthy();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null }); fireEvent.focus(window);
    expect(screen.queryByText("소장 중 ✓")).toBeNull();
    expect(await screen.findByRole("link", { name: "로그인하고 보유하기" })).toBeTruthy();
    expect(document.getElementById("reveal")?.dataset.cardId).toBe(card.id); expect(document.getElementById("reveal")?.dataset.revealed).toBe("true");
  });
});
