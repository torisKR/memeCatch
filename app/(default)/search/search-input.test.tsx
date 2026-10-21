// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "./search-input";
import { consumeMemeIntentSubmit, MEME_INTENT_SUBMIT_EVENT } from "@/lib/meme-intent-submit.client";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

type Result = { data: Array<{ id: string; short_id: string; slug: string; title: string; summary: string; category: "phrase" }> | null; error: unknown };
const requests: Array<{
  resolve: (result: Result) => void;
  reject: (error: Error) => void;
  select: ReturnType<typeof vi.fn>;
  abortSignal: ReturnType<typeof vi.fn>;
}> = [];

function result(title: string): Result {
  return { data: [{ id: title, short_id: "abcdefgh", slug: title, title, summary: "뜻", category: "phrase" }], error: null };
}

async function tick(milliseconds = 300) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  requests.length = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
  mocks.rpc.mockImplementation(() => {
    let resolve!: (result: Result) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Result>((done, fail) => { resolve = done; reject = fail; });
    const query = {
      select: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      then: promise.then.bind(promise),
    };
    requests.push({ resolve, reject, select: query.select, abortSignal: query.abortSignal });
    return query;
  });
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("SearchInput request budget", () => {
  it("signals Laya routing only on an explicit valid submit", () => {
    const listener = vi.fn();
    window.addEventListener(MEME_INTENT_SUBMIT_EVENT, listener);
    render(<SearchInput initialQuery="" popularTerms={[]} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "친구 취향을 따라 할 때" } });
    expect(listener).not.toHaveBeenCalled();
    expect(consumeMemeIntentSubmit("친구 취향을 따라 할 때", "ko")).toBe(false);

    fireEvent.submit(screen.getByRole("search"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(consumeMemeIntentSubmit("친구 취향을 따라 할 때", "ko")).toBe(true);
    window.removeEventListener(MEME_INTENT_SUBMIT_EVENT, listener);
  });

  it("keeps a localized submit on its existing search route without a Korean AI marker", () => {
    const listener = vi.fn();
    window.addEventListener(MEME_INTENT_SUBMIT_EVENT, listener);
    render(
      <SearchInput
        initialQuery=""
        popularTerms={[]}
        searchPath="/en/search"
        locale="en"
        copy={{
          label: "Search memes",
          placeholder: "Search",
          suggestionLabel: "Suggestions",
          loading: "Loading",
          noMatches: "No matches",
          recent: "Recent",
          clearRecent: "Clear",
          popular: "Popular",
          emptyHint: "Search by name",
          removeRecent: "Remove",
        }}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a meme for work" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(mocks.replace).toHaveBeenCalledWith("/en/search?q=a%20meme%20for%20work");
    expect(listener).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
    expect(consumeMemeIntentSubmit("a meme for work", "ko")).toBe(false);
    window.removeEventListener(MEME_INTENT_SUBMIT_EVENT, listener);
  });

  it("applies browser history query changes without replaying a pending local draft", async () => {
    const view = render(<SearchInput initialQuery="처음" popularTerms={[]} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "작성 중" } });
    await tick(100);
    view.rerender(<SearchInput initialQuery="뒤로 간 검색" popularTerms={[]} />);

    expect((input as HTMLInputElement).value).toBe("뒤로 간 검색");
    await tick(300);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("ignores out-of-order confirmations of its own live query replacements", async () => {
    const view = render(<SearchInput initialQuery="old" popularTerms={[]} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "a" } });
    await tick();
    fireEvent.change(input, { target: { value: "ab" } });
    await tick();
    expect(mocks.replace).toHaveBeenNthCalledWith(1, "/search?q=a");
    expect(mocks.replace).toHaveBeenNthCalledWith(2, "/search?q=ab");

    view.rerender(<SearchInput initialQuery="a" popularTerms={[]} />);
    expect((input as HTMLInputElement).value).toBe("ab");
    view.rerender(<SearchInput initialQuery="ab" popularTerms={[]} />);
    expect((input as HTMLInputElement).value).toBe("ab");

    view.rerender(<SearchInput initialQuery="a" popularTerms={[]} />);
    expect((input as HTMLInputElement).value).toBe("a");
  });

  it("aborts obsolete suggestions and shows recent searches when history clears the query", async () => {
    window.localStorage.setItem("mc_recent_searches", JSON.stringify(["최근 검색"]));
    const view = render(<SearchInput initialQuery="이전 검색" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await tick();

    view.rerender(<SearchInput initialQuery="" popularTerms={[]} />);

    expect((input as HTMLInputElement).value).toBe("");
    expect(requests[0].abortSignal.mock.calls[0][0].aborted).toBe(true);
    expect(screen.getByRole("button", { name: "최근 검색" })).toBeTruthy();
    await act(async () => { requests[0].resolve(result("낡은 결과")); });
    expect(screen.queryByText("낡은 결과")).toBeNull();
    await tick();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("keeps a loaded query idle until focus opens the suggestions", async () => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    await tick();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByRole("combobox"));
    await tick();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("search_memes", { p_query: "밈", p_limit: 6 });
    expect(requests[0].select).toHaveBeenCalledWith("id, short_id, slug, title, summary, category");
    expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe("true");
  });

  it("retains 300ms live result navigation while cancelling obsolete suggestions", async () => {
    render(<SearchInput initialQuery="" popularTerms={[]} searchPath="/en/search" />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "이전" } });
    await tick(299);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await tick(1);
    expect(mocks.replace).toHaveBeenLastCalledWith("/en/search?q=%EC%9D%B4%EC%A0%84");
    fireEvent.change(input, { target: { value: "최신" } });
    expect(requests[0].abortSignal.mock.calls[0][0].aborted).toBe(true);
    await tick();
    await act(async () => { requests[1].resolve(result("최신 결과")); });
    await act(async () => { requests[0].resolve(result("오래된 결과")); });
    expect(screen.getByText("최신 결과")).toBeTruthy();
    expect(screen.queryByText("오래된 결과")).toBeNull();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalled();
  });

  it("reuses repeated trimmed input briefly, then refetches after expiry", async () => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await tick();
    await act(async () => { requests[0].resolve(result("캐시 결과")); });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: " 밈 " } });
    await tick();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(screen.getByText("캐시 결과")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    await tick(30_001);
    fireEvent.focus(input);
    await tick();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("aborts on close and retries failures instead of caching them", async () => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await tick();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(requests[0].abortSignal.mock.calls[0][0].aborted).toBe(true);
    await act(async () => { requests[0].reject(new Error("cancelled")); });
    fireEvent.focus(input);
    await tick();
    await act(async () => { requests[1].resolve({ data: null, error: { message: "offline" } }); });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.focus(input);
    await tick();
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
  });

  it("does not fetch whitespace and cancels a pending request on unmount", async () => {
    const view = render(<SearchInput initialQuery="" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "  " } });
    await tick();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "밈" } });
    await tick();
    view.unmount();
    expect(requests[0].abortSignal.mock.calls[0][0].aborted).toBe(true);
  });

  it("skips dismissed suggestions before debounce while still updating body search", async () => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "새밈" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await tick();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/search?q=%EC%83%88%EB%B0%88");
  });

  it("recovers from a rejected request without caching the failure", async () => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await tick();
    await act(async () => { requests[0].reject(new Error("network offline")); });
    expect(screen.queryByRole("option")).toBeNull();
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.focus(input);
    await tick();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    await act(async () => { requests[1].resolve(result("복구 결과")); });
    expect(screen.getByRole("option").textContent).toContain("복구 결과");
  });

  it("defers IME queries until composition ends, then keeps the 300ms debounce", async () => {
    render(<SearchInput initialQuery="" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "ㅎ" } });
    await tick(600);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("search"));
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "한글" } });
    fireEvent.compositionEnd(input);
    await tick(299);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("search_memes", { p_query: "한글", p_limit: 6 });
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/search?q=%ED%95%9C%EA%B8%80");
  });

  it.each([{ isComposing: true }, { keyCode: 229 }])("ignores composition confirmation Enter %o", async (event) => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await tick();
    await act(async () => { requests[0].resolve(result("이전 결과")); });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(fireEvent.keyDown(input, { key: "Enter", ...event })).toBe(false);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("cancels an existing suggestion request when IME composition starts", async () => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await tick();
    fireEvent.compositionStart(input);
    expect(requests[0].abortSignal.mock.calls[0][0].aborted).toBe(true);
    await act(async () => { requests[0].resolve(result("취소 결과")); });
    await tick(600);
    expect(screen.queryByRole("option")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("invalidates an old selection as soon as the query changes", async () => {
    render(<SearchInput initialQuery="밈" popularTerms={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await tick();
    await act(async () => { requests[0].resolve(result("이전 결과")); });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    fireEvent.change(input, { target: { value: "다른밈" } });
    expect(screen.queryByRole("option")).toBeNull();
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
