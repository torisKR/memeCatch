// @vitest-environment jsdom
import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeCardDiscoveryPage, MemeCollectibleCard } from "@/lib/meme-collectible";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), listener: null as null | ((event: string) => void), unsubscribe: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/i18n-client", () => ({ useLocale: () => ({ locale: "ko" }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: auth.getUser, onAuthStateChange: (listener: (event: string) => void) => { auth.listener = listener; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; } } }) }));
vi.mock("./meme-collectible-scratch", () => ({ MemeCollectibleScratch: ({ cardId, card, revealed, onStart, onReveal }: { cardId: string; card: MemeCollectibleCard | null; revealed: boolean; onStart: () => void; onReveal: () => void }) => <div data-scratch-card={cardId} data-loaded-card={card?.id} data-revealed={revealed}>{card && <span data-testid="scratch-loaded-title">{card.title}</span>}{!revealed && <><button onClick={onStart}>긁기 시작</button><button onClick={onReveal}>바로 공개</button></>}</div> }));
import { MemeCollectibleGallery } from "./meme-collectible-gallery";

const card: MemeCollectibleCard = { id: "mc-0001", cardNo: 1, edition: 1, artSeed: 42, memeId: "meme-a", title: "PPAP", slug: "ppap", href: "/memes/abcdef-ppap", summary: "펜과 과일이 만나는 노래", category: "song", originYear: 2016, thumbnailUrl: null, artMotif: "pen-pineapple", artSymbols: ["pen", "apple", "pineapple"], artComposition: "exchange" };
const second = { ...card, id: "mc-0002", cardNo: 2, title: "강남스타일", artMotif: "dance" as const };
const catalog: MemeCardDiscoveryPage = { cards: [{ id: card.id }, { id: second.id }], total: 1000, page: 1, pageSize: 24, hasMore: true };
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let fetchMock: ReturnType<typeof vi.fn>;
function posts() { return fetchMock.mock.calls.filter(([, options]) => options?.method === "POST"); }
function cardGets() { return fetchMock.mock.calls.filter(([url]) => /^\/api\/meme-cards\/mc-\d{4}$/.test(String(url))); }
function deferred() { let resolve!: (value: ReturnType<typeof json>) => void; const promise = new Promise<ReturnType<typeof json>>(done => { resolve = done; }); return { promise, resolve }; }
function renderRevealed() { return render(<MemeCollectibleGallery catalog={catalog} initialSelected={{ id: card.id }} initialCard={card} initialRevealed/>); }
function renderSealed() {
  window.history.replaceState(null, "", `/meme-cards?card=${card.id}`);
  return render(<MemeCollectibleGallery catalog={catalog} initialSelected={{ id: card.id }}/>);
}
function expectSealed() {
  expect(document.getElementById("reveal")?.dataset.revealed).toBe("false");
  expect(document.body.textContent).not.toContain(card.title);
  expect(document.body.textContent).not.toContain(card.summary);
  expect(document.querySelector(`a[href="${card.href}"]`)).toBeNull();
  expect(screen.queryByRole("button", { name: "보유하기" })).toBeNull();
  expect(screen.queryByRole("link", { name: "로그인하고 보유하기" })).toBeNull();
  expect(new URL(window.location.href).searchParams.has("revealed")).toBe(false);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/meme-cards?card=mc-0001&revealed=1");
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-a", is_anonymous: false } }, error: null });
  fetchMock = vi.fn(async (url: string) => /^\/api\/meme-cards\/mc-\d{4}$/.test(url) ? json({ card: url.endsWith(second.id) ? second : card }) : json({ ownedCardIds: [] })); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
    await user.click(screen.getByRole("button", { name: "미공개 카드 2 선택" }));
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

describe("sealed meme card discovery", () => {
  beforeEach(() => { auth.getUser.mockResolvedValue({ data: { user: null }, error: null }); });

  it("renders sealed SSR markup without card identity, art, detail links, or name/category filters", () => {
    const html = renderToStaticMarkup(<MemeCollectibleGallery catalog={catalog} initialSelected={{ id: card.id }} initialCard={card}/>);
    for (const identity of [card.title, card.summary, second.title, card.href, "NO. 0001", "pen-pineapple", "data-motif", "data-symbol", "data-composition"]) expect(html).not.toContain(identity);
    expect(html).not.toMatch(/<(input|select|form)\b/);
    expect(html).toContain('aria-label="미공개 카드 1 선택"');
    expect(html).toContain('aria-label="미공개 카드 2 선택"');
    expect(cardGets()).toHaveLength(0);
  });

  it("labels choices by their discovery position rather than the actual card number", () => {
    const sparseCatalog = { ...catalog, cards: [{ id: "mc-0042" }, { id: "mc-0100" }] };
    render(<MemeCollectibleGallery catalog={sparseCatalog}/>);
    expect(screen.getByRole("button", { name: "미공개 카드 1 선택" }).dataset.cardId).toBe("mc-0042");
    expect(screen.getByRole("button", { name: "미공개 카드 2 선택" }).dataset.cardId).toBe("mc-0100");
    expect(screen.queryByRole("button", { name: /42|100/ })).toBeNull();
  });

  it("keeps selection and hover sealed without fetching the card or claiming it", async () => {
    render(<MemeCollectibleGallery catalog={catalog}/>);
    const user = userEvent.setup();
    const choice = screen.getByRole("button", { name: "미공개 카드 1 선택" });
    await user.hover(choice); await user.click(choice); await user.hover(screen.getByRole("button", { name: "긁기 시작" }));
    expectSealed(); expect(cardGets()).toHaveLength(0); expect(posts()).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("meme-card-reveal-title")));
  });

  it("deduplicates first scratch loads and does not complete reveal merely because the card loaded", async () => {
    const pending = deferred(); fetchMock.mockImplementation(() => pending.promise);
    renderSealed();
    fireEvent.click(screen.getByRole("button", { name: "긁기 시작" }));
    fireEvent.click(screen.getByRole("button", { name: "긁기 시작" }));
    expect(cardGets()).toHaveLength(1); expect(cardGets()[0][0]).toBe(`/api/meme-cards/${card.id}`);
    expect(cardGets()[0][1]).toEqual(expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
    expectSealed();
    await act(async () => pending.resolve(json({ card })));
    expect(screen.getByTestId("scratch-loaded-title").textContent).toBe(card.title);
    expect(document.getElementById("reveal")?.dataset.revealed).toBe("false");
    expect(screen.getByRole("heading", { level: 2, name: "오늘 내 취향에 들어올 카드" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "로그인하고 보유하기" })).toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it("waits for a valid card response before completing a pending reveal and focusing its title", async () => {
    const pending = deferred(); fetchMock.mockImplementation(() => pending.promise);
    renderSealed();
    await userEvent.setup().click(screen.getByRole("button", { name: "바로 공개" }));
    expect(cardGets()).toHaveLength(1); expectSealed();
    await act(async () => pending.resolve(json({ card })));
    const title = await screen.findByRole("heading", { level: 2, name: card.title });
    expect(document.getElementById("reveal")?.dataset.revealed).toBe("true");
    expect(screen.getByRole("link", { name: /밈 뜻 · 유래 보기/ }).getAttribute("href")).toBe(card.href);
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(new URL(window.location.href).searchParams.get("revealed")).toBe("1");
    expect(posts()).toHaveLength(0);
  });

  it("keeps the same sealed selection after a load failure and completes the requested reveal on retry", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ card }));
    renderSealed(); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "바로 공개" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("카드를 불러오지 못했어요"));
    expect(document.getElementById("reveal")?.dataset.cardId).toBe(card.id); expectSealed();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("heading", { level: 2, name: card.title })).toBeTruthy();
    expect(cardGets()).toHaveLength(2); expect(screen.queryByRole("alert")).toBeNull(); expect(posts()).toHaveLength(0);
  });

  it("keeps an unavailable card concealed and does not offer a retry or collection action", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404)); renderSealed();
    await userEvent.setup().click(screen.getByRole("button", { name: "바로 공개" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("지금은 이 카드를 보유할 수 없어요"));
    expectSealed(); expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "긁기 시작" }));
    fireEvent.click(screen.getByRole("button", { name: "바로 공개" }));
    expect(cardGets()).toHaveLength(1); expect(posts()).toHaveLength(0);
  });
  it("waits for an explicit retry when the first scratch load failed before the reveal threshold", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ card }));
    renderSealed(); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "긁기 시작" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "바로 공개" }));
    expect(cardGets()).toHaveLength(1); expectSealed();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("heading", { level: 2, name: card.title })).toBeTruthy();
    expect(cardGets()).toHaveLength(2); expect(posts()).toHaveLength(0);
  });

  it("rejects a mismatched card response before exposing its title or detail link", async () => {
    fetchMock.mockResolvedValueOnce(json({ card: second })); renderSealed();
    await userEvent.setup().click(screen.getByRole("button", { name: "바로 공개" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("카드를 불러오지 못했어요"));
    expectSealed(); expect(document.body.textContent).not.toContain(second.title);
    expect(screen.queryByTestId("scratch-loaded-title")).toBeNull(); expect(posts()).toHaveLength(0);
  });

  it.each(["select another card", "cancel selection"])("ignores a delayed reveal JSON response after users %s", async (action) => {
    let resolve!: (value: { card: MemeCollectibleCard }) => void;
    const payload = new Promise<{ card: MemeCollectibleCard }>(done => { resolve = done; });
    const readJson = vi.fn(() => payload);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: readJson });
    renderSealed(); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "바로 공개" }));
    await waitFor(() => expect(readJson).toHaveBeenCalledOnce());
    const signal = cardGets()[0][1].signal;
    await user.click(screen.getByRole("button", { name: action === "select another card" ? "미공개 카드 2 선택" : "선택 취소" }));
    await act(async () => resolve({ card }));
    expect(signal.aborted).toBe(true); expect(document.body.textContent).not.toContain(card.title);
    expect(screen.queryByTestId("scratch-loaded-title")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
    if (action === "select another card") {
      expect(document.getElementById("reveal")?.dataset.cardId).toBe(second.id);
      expect(document.getElementById("reveal")?.dataset.revealed).toBe("false");
    } else expect(document.getElementById("reveal")).toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it("reseals the same revealed card without retaining its previously loaded front", async () => {
    const pending = deferred(); fetchMock.mockImplementation(() => pending.promise);
    renderRevealed(); const user = userEvent.setup();
    expect(screen.getByTestId("scratch-loaded-title").textContent).toBe(card.title);
    await user.click(screen.getByRole("button", { name: "미공개 카드 1 선택" }));
    expectSealed(); expect(screen.queryByTestId("scratch-loaded-title")).toBeNull(); expect(cardGets()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "바로 공개" }));
    expectSealed(); expect(cardGets()).toHaveLength(1);
    await act(async () => pending.resolve(json({ card })));
    expect(await screen.findByRole("heading", { level: 2, name: card.title })).toBeTruthy();
  });

  it("shuffles the sealed choices explicitly without duplicating cards or fetching their contents", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<MemeCollectibleGallery catalog={catalog}/>);
    const choices = () => screen.getAllByRole("button", { name: /^미공개 카드 \d+ 선택$/ });
    const before = choices().map(button => button.dataset.cardId);
    await userEvent.setup().click(screen.getByRole("button", { name: /카드 뒤섞기/ }));
    const after = choices().map(button => button.dataset.cardId);
    expect(after).not.toEqual(before); expect([...after].sort()).toEqual([...before].sort());
    expect(new Set(after).size).toBe(after.length); expect(cardGets()).toHaveLength(0); expect(posts()).toHaveLength(0);
    expect(document.body.textContent).not.toContain(card.title);
  });
});
