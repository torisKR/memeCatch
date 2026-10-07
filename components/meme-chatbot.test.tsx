// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeChatResult } from "@/lib/meme-chat";
import { MEME_CHAT_COPY } from "@/lib/meme-chat-copy";
import { MemeChatbot } from "./meme-chatbot";

const navigation = vi.hoisted(() => ({ pathname: "/", locale: "ko" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/lib/i18n-client", () => ({ useLocale: () => ({ locale: navigation.locale }) }));

const fetchMock = vi.fn<typeof fetch>();
const copy = MEME_CHAT_COPY.ko;

function result(overrides: Partial<MemeChatResult> = {}): MemeChatResult {
  return {
    answer: "친구의 취향을 따라 하는 상황에 쓰는 밈입니다.",
    mode: "retrieved",
    retrievalMode: "keyword",
    items: [{
      id: "meme-1",
      short_id: "abcd",
      slug: "손민수",
      title: "손민수",
      summary: "다른 사람의 취향을 따라 하는 표현",
      href: "/memes/abcd-%EC%86%90%EB%AF%BC%EC%88%98",
      sources: [{ url: "https://www.youtube.com/watch?v=source123", label: "원문 영상" }],
    }],
    ...overrides,
  };
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function openChat() {
  fireEvent.click(screen.getByRole("button", { name: copy.open }));
  return screen.getByRole("textbox", { name: copy.question });
}

function typeQuestion(value = "친구를 따라 하는 밈") {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
}

async function submit() {
  await act(async () => { fireEvent.submit(screen.getByRole("form")); });
}

beforeEach(() => {
  navigation.pathname = "/";
  navigation.locale = "ko";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-pwa-install-banner]").forEach((banner) => banner.remove());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MemeChatbot", () => {
  it("only requests an answer on explicit submit and displays catalog references honestly", async () => {
    fetchMock.mockResolvedValue(response(result()));
    render(<MemeChatbot />);
    expect(fetchMock).not.toHaveBeenCalled();
    const input = openChat();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    expect(screen.getByText(copy.disclosure)).toBeTruthy();
    typeQuestion("  친구를 따라 하는 밈  ");
    expect(fetchMock).not.toHaveBeenCalled();
    await submit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/memes/chat");
    expect(options).toMatchObject({
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "친구를 따라 하는 밈", locale: "ko" }),
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByText(copy.retrieved)).toBeTruthy();
    expect(screen.queryByText(copy.generated)).toBeNull();
    expect(screen.getByText(result().answer)).toBeTruthy();
    expect(screen.getByRole("link", { name: "손민수" }).getAttribute("href")).toBe(result().items[0].href);
    const source = screen.getByRole("link", { name: "원문 영상" });
    expect(source.getAttribute("target")).toBe("_blank");
    expect(source.getAttribute("rel")).toBe("noopener noreferrer");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it.each(["generated", "empty"] as const)("labels %s answers separately", async (mode) => {
    fetchMock.mockResolvedValue(response(result({ mode, items: [] })));
    render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await submit();
    expect(screen.getByText(copy[mode])).toBeTruthy();
    expect(screen.queryByText(copy.references)).toBeNull();
  });

  it("renders text safely and removes unsafe source and meme URLs", async () => {
    const unsafeText = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
    const item = result().items[0];
    fetchMock.mockResolvedValue(response(result({
      answer: unsafeText,
      items: [{
        ...item,
        title: "<script>title</script>",
        href: "javascript:alert(1)",
        sources: [
          { url: "javascript:alert(1)", label: "unsafe js" },
          { url: "https://127.0.0.1/private", label: "unsafe local" },
          { url: "https://user:pass@youtube.com/private", label: "unsafe credentials" },
          item.sources[0],
        ],
      }],
    })));
    const { container } = render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await submit();
    expect(screen.getByText(unsafeText)).toBeTruthy();
    expect(screen.getByText("<script>title</script>")).toBeTruthy();
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("unsafe js")).toBeNull();
    expect(screen.queryByText("unsafe local")).toBeNull();
    expect(screen.queryByText("unsafe credentials")).toBeNull();
  });

  it("closes with Escape, aborts, returns focus, and ignores a late result after resubmitting", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<MemeChatbot />);
    const input = openChat();
    typeQuestion();
    await submit();
    const firstSignal = fetchMock.mock.calls[0][1]?.signal;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: copy.open }));
    openChat();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("친구를 따라 하는 밈");
    await submit();
    await act(async () => { first.resolve(response(result({ answer: "오래된 답변" }))); });
    expect(screen.queryByText("오래된 답변")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(copy.pending);
    await act(async () => { second.resolve(response(result({ answer: "새 답변" }))); });
    expect(screen.getByText("새 답변")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("guards synchronous duplicate form submissions while pending", async () => {
    const request = deferredResponse();
    fetchMock.mockReturnValue(request.promise);
    render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await act(async () => {
      fireEvent.submit(screen.getByRole("form"));
      fireEvent.submit(screen.getByRole("form"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: copy.send }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { request.resolve(response(result())); });
  });

  it("bounds questions to 2..120 characters even for a forced submit", async () => {
    fetchMock.mockResolvedValue(response(result()));
    render(<MemeChatbot />);
    const input = openChat();
    expect(input.getAttribute("maxlength")).toBe("120");
    typeQuestion("가");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(copy.invalid);
    typeQuestion("가".repeat(121));
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    typeQuestion("가".repeat(120));
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, "invalid"], [413, "invalid"], [429, "limited"], [503, "unavailable"], [504, "timeout"],
  ] as const)("shows a useful %s error and retains the draft for retry", async (status, label) => {
    fetchMock.mockResolvedValueOnce(response({ error: "internal details never displayed" }, status))
      .mockResolvedValueOnce(response(result()));
    render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(copy[label]);
    expect(screen.queryByText("internal details never displayed")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("친구를 따라 하는 밈");
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects malformed successful responses and handles network failures without losing the question", async () => {
    fetchMock.mockResolvedValueOnce(response({ answer: "unexpected", items: "bad" }))
      .mockRejectedValueOnce(new Error("network details"));
    render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(copy.unavailable);
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(copy.unavailable);
    expect(screen.queryByText("network details")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("친구를 따라 하는 밈");
  });

  it("keeps at most six completed conversations in memory and clears them without a request", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<MemeChatbot />);
    openChat();
    for (let index = 0; index < 7; index++) {
      fetchMock.mockResolvedValueOnce(response(result({ answer: "응답 " + index, items: [] })));
      typeQuestion("질문 " + index);
      await submit();
    }
    expect(screen.queryByText("질문 0")).toBeNull();
    expect(screen.queryByText("응답 0")).toBeNull();
    expect(screen.getAllByText(copy.retrieved)).toHaveLength(6);
    expect(storageSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: copy.clear }));
    expect(screen.queryByText("응답 6")).toBeNull();
    expect(screen.getByText(copy.welcome)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
  });

  it("clear cancels an in-flight request and ignores its result", async () => {
    const request = deferredResponse();
    fetchMock.mockReturnValue(request.promise);
    render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await submit();
    fireEvent.click(screen.getByRole("button", { name: copy.clear }));
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => { request.resolve(response(result({ answer: "지운 답변" }))); });
    expect(screen.queryByText("지운 답변")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("aborts on public route changes and unmount", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { rerender, unmount } = render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await submit();
    navigation.pathname = "/explore";
    rerender(<MemeChatbot />);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    openChat();
    typeQuestion();
    await submit();
    unmount();
    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => {
      first.resolve(response(result()));
      second.resolve(response(result()));
    });
  });

  it.each(["/admin", "/admin/submissions", "/auth/callback", "/login", "/forgot-password", "/reset-password", "/en/admin", "/ja/login"])("hides chat on %s", (pathname) => {
    navigation.pathname = pathname;
    render(<MemeChatbot />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["ko", "en", "ja", "zh", "zh-tw"] as const)("uses %s route copy and sends its locale", async (locale) => {
    navigation.pathname = "/" + locale + "/search";
    navigation.locale = "ja";
    fetchMock.mockResolvedValue(response(result({ items: [] })));
    render(<MemeChatbot />);
    fireEvent.click(screen.getByRole("button", { name: MEME_CHAT_COPY[locale].open }));
    expect(screen.getByText(MEME_CHAT_COPY[locale].disclosure)).toBeTruthy();
    typeQuestion();
    await submit();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).locale).toBe(locale);
  });

  it("falls back to English for other UI languages", () => {
    navigation.locale = "th";
    render(<MemeChatbot />);
    expect(screen.getByRole("button", { name: MEME_CHAT_COPY.en.open })).toBeTruthy();
  });

  it("updates the launcher label to match its open or close action", () => {
    render(<MemeChatbot />);
    const launcher = screen.getByRole("button", { name: copy.open });
    fireEvent.click(launcher);
    expect(launcher.getAttribute("aria-label")).toBe(copy.close);
    expect(launcher.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(launcher);
    expect(launcher.getAttribute("aria-label")).toBe(copy.open);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("handles Escape from outside the nonmodal panel, ignores IME, and stops listening after close", () => {
    render(<><button type="button">Page control</button><MemeChatbot /></>);
    openChat();
    const pageButton = screen.getByRole("button", { name: "Page control" });
    pageButton.focus();
    fireEvent.keyDown(pageButton, { key: "Escape", isComposing: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(pageButton);
    fireEvent.keyDown(pageButton, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: copy.open }));
    pageButton.focus();
    fireEvent.keyDown(pageButton, { key: "Escape" });
    expect(document.activeElement).toBe(pageButton);
  });

  it.each(["dialog", "alertdialog"])("leaves Escape and focus to a higher %s until it is removed", async (role) => {
    render(<><button type="button">Page control</button><MemeChatbot /></>);
    openChat();
    const chat = screen.getByRole("dialog");
    const modal = document.createElement("section");
    modal.setAttribute("role", role);
    modal.setAttribute("aria-modal", "true");
    const modalControl = document.createElement("button");
    modalControl.textContent = "Modal control";
    modal.append(modalControl);
    await act(async () => { document.body.append(modal); });
    modalControl.focus();
    const modalEscape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    fireEvent(modalControl, modalEscape);
    expect(modalEscape.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(modalControl);
    expect(document.body.contains(chat)).toBe(true);
    expect(screen.getByRole("textbox")).toBeTruthy();
    await act(async () => { modal.remove(); });
    const pageButton = screen.getByRole("button", { name: "Page control" });
    pageButton.focus();
    fireEvent.keyDown(pageButton, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: copy.open }));
  });

  it("hides for an existing PWA install banner and restores the launcher when it is removed", async () => {
    const banner = document.createElement("div");
    banner.setAttribute("data-pwa-install-banner", "");
    document.body.append(banner);
    render(<MemeChatbot />);
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => { banner.remove(); });
    expect(screen.getByRole("button", { name: copy.open })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unmounts and cancels chat when a PWA banner appears, then restores a fresh panel", async () => {
    const request = deferredResponse();
    fetchMock.mockReturnValue(request.promise);
    render(<MemeChatbot />);
    openChat();
    typeQuestion();
    await submit();
    const banner = document.createElement("div");
    banner.setAttribute("data-pwa-install-banner", "");
    await act(async () => { document.body.append(banner); });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => { request.resolve(response(result({ answer: "배너 뒤의 오래된 답변" }))); });
    await act(async () => { banner.remove(); });
    openChat();
    expect(screen.queryByText("배너 뒤의 오래된 답변")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses a nonmodal panel and safe-area placement above mobile navigation", () => {
    render(<><button type="button">Page control</button><MemeChatbot /></>);
    const input = openChat();
    const panel = screen.getByRole("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("false");
    expect(panel.className).toContain("100dvh-16rem");
    expect(panel.className).toContain("100dvh-14rem");
    expect(panel.className).toContain("safe-area-inset-top");
    expect(panel.parentElement?.className).toContain("4.5rem+env(safe-area-inset-bottom)");
    expect(panel.parentElement?.className).toContain("md:bottom-6");
    const pageButton = screen.getByRole("button", { name: "Page control" });
    pageButton.focus();
    expect(document.activeElement).toBe(pageButton);
    input.focus();
    fireEvent.click(within(panel).getByRole("button", { name: copy.close }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: copy.open }));
    expect(document.body.style.overflow).toBe("");
  });
});
