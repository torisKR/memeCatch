// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submitMemeContribution = vi.fn();
const track = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => "/memes/pp3tzbgm/test" }));
vi.mock("@/app/(default)/submit/actions", () => ({
  submitMemeContribution: (...args: unknown[]) => submitMemeContribution(...args),
}));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

import { MemeContribute } from "./meme-contribute";

const MEME_ID = "10000000-0000-4000-8000-000000000001";

describe("MemeContribute", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    submitMemeContribution.mockReset();
    track.mockReset();
    window.location.hash = "";
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("승인된 기여자를 닉네임과 기여 종류로 보여 준다", () => {
    const html = renderToStaticMarkup(
      <MemeContribute
        memeId={MEME_ID}
        shortId="pp3tzbgm"
        contributors={[
          { nickname: "유저A", sourceCount: 1, exampleCount: 2 },
          { nickname: "유저B", sourceCount: 0, exampleCount: 1 },
        ]}
      />,
    );
    expect(html).toContain("함께 채운 사람");
    expect(html).toContain("유저A");
    expect(html).toContain("출처 1·예문 2");
    expect(html).toContain("유저B");
    expect(html).toContain('id="contribute"');
  });

  it("기여자가 없으면 기여자 줄을 그리지 않고, 접수를 닫으면 폼도 숨긴다", () => {
    const html = renderToStaticMarkup(
      <MemeContribute memeId={MEME_ID} shortId="pp3tzbgm" contributors={[]} enabled={false} />,
    );
    expect(html).not.toContain("함께 채운 사람");
    expect(html).not.toContain('id="contribute"');
  });

  it("#contribute-example 로 들어오면 펼치고 예문 탭을 고른다", () => {
    window.location.hash = "#contribute-example";
    act(() => {
      root.render(<MemeContribute memeId={MEME_ID} shortId="pp3tzbgm" contributors={[]} />);
    });
    const details = container.querySelector("details")!;
    expect(details.open).toBe(true);
    expect(container.textContent).toContain("어떤 상황에서 썼나요?");
  });

  it("출처 링크를 이 밈에 묶어 보내고 성공을 계측한다", async () => {
    submitMemeContribution.mockResolvedValue({ ok: true });
    act(() => {
      root.render(<MemeContribute memeId={MEME_ID} shortId="pp3tzbgm" contributors={[]} />);
    });
    const input = container.querySelector<HTMLInputElement>('input[type="url"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "https://www.youtube.com/watch?v=abc");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(submitMemeContribution).toHaveBeenCalledWith({
      memeId: MEME_ID,
      kind: "source",
      sourceUrl: "https://www.youtube.com/watch?v=abc",
      note: "",
      creditPublic: true,
    });
    expect(track).toHaveBeenCalledWith("meme_contribution_submitted", {
      short_id: "pp3tzbgm",
      kind: "source",
    });
    expect(container.textContent).toContain("함께 채운 사람」에 닉네임이 올라가요");
  });

  it("로그인이 필요하면 돌아올 앵커를 담은 로그인 링크를 준다", async () => {
    submitMemeContribution.mockResolvedValue({
      ok: false,
      error: "login_required",
      message: "로그인하면 제보할 수 있어요.",
    });
    act(() => {
      root.render(<MemeContribute memeId={MEME_ID} shortId="pp3tzbgm" contributors={[]} />);
    });
    const input = container.querySelector<HTMLInputElement>('input[type="url"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "https://example.com/a");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const login = container.querySelector<HTMLAnchorElement>('a[href^="/login"]')!;
    expect(login.getAttribute("href")).toBe(
      `/login?next=${encodeURIComponent("/memes/pp3tzbgm/test#contribute-source")}`,
    );
    expect(track).not.toHaveBeenCalled();
  });
});
