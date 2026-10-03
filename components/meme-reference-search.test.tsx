// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemeReferenceSearch } from "./meme-reference-search";
import { memePathFrom } from "@/lib/labels";

const item = {
  id: "reference-1", short_id: "abcdefgh", slug: "참고-밈", title: "참고 밈", summary: "직장인의 월요일",
};
const fetchMock = vi.fn();

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function deferred() {
  let resolve!: (value: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("explicit meme reference search", () => {
  it("never requests on render or query change and sends a bounded request on click", async () => {
    const view = render(<MemeReferenceSearch query="월요일 출근" />);
    expect(fetchMock).not.toHaveBeenCalled();
    view.rerender(<MemeReferenceSearch query="  퇴근하고 싶은 상황  " />);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(response({ mode: "hybrid", items: [item] }));
    fireEvent.click(screen.getByRole("button", { name: "상황·의미로 찾기" }));
    expect((await screen.findByRole("link", { name: /참고 밈/ })).getAttribute("href"))
      .toBe(memePathFrom(item.short_id, item.slug));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/memes/semantic-search", expect.objectContaining({
      method: "POST", body: JSON.stringify({ query: "퇴근하고 싶은 상황", limit: 12 }), cache: "no-store",
      headers: { "content-type": "application/json" }, signal: expect.any(AbortSignal),
    }));
    expect(screen.getByText("참고 자료이며 재사용 권한은 별도로 확인해 주세요.")).toBeTruthy();
  });

  it.each(["", " ", "a", "x".repeat(121)])("disables invalid queries %s", (query) => {
    render(<MemeReferenceSearch query={query} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the studio action without submitting a parent form", async () => {
    const submit = vi.fn();
    fetchMock.mockResolvedValue(response({ mode: "hybrid", items: [] }));
    render(<form onSubmit={submit}><MemeReferenceSearch query="고양이 출근" variant="studio" /></form>);
    fireEvent.click(screen.getByRole("button", { name: "제작 참고 밈 찾기" }));
    await screen.findByText("참고할 밈을 찾지 못했어요. 다른 검색어로 찾아보세요.");
    expect(submit).not.toHaveBeenCalled();
  });

  it("cancels pending work and ignores its late result even after retry", async () => {
    const first = deferred();
    const second = deferred();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button", { name: "상황·의미로 찾기" }));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "검색 취소" }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByText("검색을 취소했어요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "상황·의미로 찾기" }));
    await act(async () => { first.resolve(response({ mode: "hybrid", items: [item] })); });
    expect(screen.queryByRole("link")).toBeNull();
    await act(async () => { second.resolve(response({ mode: "hybrid", items: [{ ...item, title: "최신 결과" }] })); });
    expect(screen.getByRole("link").textContent).toContain("최신 결과");
  });

  it("aborts on query change, hides old results, and does not fetch automatically", async () => {
    const request = deferred();
    fetchMock.mockReturnValue(request.promise);
    const view = render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    view.rerender(<MemeReferenceSearch query="금요일 퇴근" />);
    expect(signal.aborted).toBe(true);
    await act(async () => { request.resolve(response({ mode: "hybrid", items: [item] })); });
    expect(screen.queryByRole("link")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not restore a previous query's results when returning to it", async () => {
    fetchMock.mockResolvedValue(response({ mode: "hybrid", items: [item] }));
    const view = render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("link");
    view.rerender(<MemeReferenceSearch query="금요일 퇴근" />);
    expect(screen.queryByRole("link")).toBeNull();
    view.rerender(<MemeReferenceSearch query="월요일 출근" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts on unmount and silently accepts a later cancellation rejection", async () => {
    const request = deferred();
    fetchMock.mockReturnValue(request.promise);
    const view = render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { request.reject(new Error("aborted")); });
  });

  it.each(["disabled", "model_unavailable", "index_empty", "rpc_unavailable"])("explains keyword fallback %s", async (reason) => {
    fetchMock.mockResolvedValue(response({ mode: "keyword", reason, items: [item] }));
    render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("의미 검색이 준비되지 않아 이름·별칭 검색 결과를 보여드려요.")).toBeTruthy();
    expect(screen.getByRole("link")).toBeTruthy();
    expect(screen.queryByText(reason)).toBeNull();
  });

  it("explains an empty reference index", async () => {
    fetchMock.mockResolvedValue(response({ mode: "keyword", reason: "index_empty", items: [] }));
    render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("아직 참고 자료가 준비되지 않았어요. 다른 검색어로 찾아보세요.")).toBeTruthy();
  });

  it.each(["http", "network", "invalid"])("reports %s errors in Korean and permits retry", async (failure) => {
    fetchMock.mockImplementationOnce(() => failure === "network"
      ? Promise.reject(new Error("internal provider details"))
      : Promise.resolve(failure === "http" ? response({ error: "private details" }, 503) : response({ items: [] })));
    render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    expect((await screen.findByRole("alert")).textContent).toBe("밈을 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
    fetchMock.mockResolvedValue(response({ mode: "hybrid", items: [item] }));
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("link");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("escapes API text and uses only locally constructed meme links", async () => {
    const unsafe = { ...item, title: '<script>alert("x")</script>', summary: '<img src=x onerror="alert(1)">', slug: "javascript:alert(1)" };
    fetchMock.mockResolvedValue(response({ mode: "hybrid", items: [unsafe] }));
    const { container } = render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    const link = await screen.findByRole("link");
    expect(link.textContent).toContain(unsafe.title);
    expect(link.textContent).toContain(unsafe.summary);
    expect(link.getAttribute("href")).toBe(memePathFrom(unsafe.short_id, unsafe.slug));
    expect(container.querySelector("script, img")).toBeNull();
  });

  it("rejects malformed or path-traversing identifiers before rendering links", async () => {
    fetchMock.mockResolvedValue(response({ mode: "hybrid", items: [{ ...item, short_id: "../../evil" }] }));
    render(<MemeReferenceSearch query="월요일 출근" />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("alert");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
