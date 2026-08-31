// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createHouseOriginal = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/admin", () => ({
  createHouseOriginal: (...args: unknown[]) => createHouseOriginal(...args),
}));

import { HouseOriginalForm } from "./house-original-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("HouseOriginalForm", () => {
  it("saves pending only and does not offer a one-click approve", async () => {
    createHouseOriginal.mockResolvedValue({ ok: true, data: { memeId: "meme-1" } });
    render(<HouseOriginalForm />);

    expect(screen.queryByRole("button", { name: "게시 승인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "수동 게시" })).toBeNull();
    expect(screen.getByRole("list", { name: "자체 제작 검수 경로" }).textContent).toContain(
      "수동 게시",
    );
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("대기");
    expect(screen.getByText("운영자가 확인란을 치고 수동 게시합니다.", { exact: false })).toBeTruthy();
    expect(screen.getByLabelText("어떻게 만들었나요?").getAttribute("aria-describedby")).toBe(
      "house-origin-hint",
    );
    expect(screen.getByText("검수 메모나 게시 여부를 쓰지 말고", { exact: false })).toBeTruthy();
    expect(screen.getByText("인터넷 원출처나 연도를 지어내지 마세요.", { exact: false })).toBeTruthy();
    expect(screen.getByLabelText("제작 연도 (선택)")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "자체 제작 밈" } });
    fireEvent.change(screen.getByLabelText("한 줄 요약"), { target: { value: "밈캐치가 만들었어요." } });
    fireEvent.click(screen.getByRole("button", { name: "대기로 저장" }));

    await waitFor(() => {
      expect(createHouseOriginal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "자체 제작 밈",
          summary: "밈캐치가 만들었어요.",
        }),
      );
    });
    expect(push).toHaveBeenCalledWith("/admin/memes/meme-1");
  });

  it("applies a generated draft without writing until the operator saves", async () => {
    const concepts = [
      {
        headline: "게시물 캡션 · 칼퇴의 기적",
        caption: "회의가 일찍 끝났다. 오늘은 내가 주인공이다.",
        why_it_works: "작은 행운을 과장해 공감을 만든다.",
        usage_context: "퇴근 직전 단체 채팅에 쓰기 좋다.",
      },
      {
        headline: "두 번째 초안",
        caption: "두 번째 문구",
        why_it_works: "두 번째 이유",
        usage_context: "두 번째 활용",
      },
      {
        headline: "세 번째 초안",
        caption: "세 번째 문구",
        why_it_works: "세 번째 이유",
        usage_context: "세 번째 활용",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mode: "template", concepts }),
    });
    vi.stubGlobal("fetch", fetchMock);
    createHouseOriginal.mockResolvedValue({ ok: true, data: { memeId: "meme-2" } });
    render(<HouseOriginalForm />);

    fireEvent.change(screen.getByLabelText("자체 밈 주제"), {
      target: { value: "회의 조기 종료" },
    });
    fireEvent.click(screen.getByRole("button", { name: "자체 밈 초안 3개 만들기" }));

    expect(await screen.findByText("$0 기본 템플릿 초안")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/meme-studio",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topic: "회의 조기 종료", tone: "hype", format: "caption" }),
      }),
    );
    expect(createHouseOriginal).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "“게시물 캡션 · 칼퇴의 기적” 초안 사용" }),
    );
    expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe(
      "게시물 캡션 · 칼퇴의 기적",
    );
    expect((screen.getByLabelText("한 줄 요약") as HTMLInputElement).value).toBe(
      "회의가 일찍 끝났다. 오늘은 내가 주인공이다.",
    );
    expect((screen.getByLabelText("어떻게 만들었나요?") as HTMLTextAreaElement).value).toContain(
      "외부 SNS 원본이나 제3자 미디어를 사용하지 않았습니다.",
    );
    expect((screen.getByLabelText("제작 연도 (선택)") as HTMLInputElement).value).toBe(
      String(new Date().getFullYear()),
    );
    expect(createHouseOriginal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "대기로 저장" }));
    await waitFor(() => {
      expect(createHouseOriginal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "게시물 캡션 · 칼퇴의 기적",
          summary: "회의가 일찍 끝났다. 오늘은 내가 주인공이다.",
          category: "phrase",
          originYear: new Date().getFullYear(),
        }),
      );
    });
    expect(push).toHaveBeenCalledWith("/admin/memes/meme-2");
  });

  it("discards generated drafts when their topic changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "template",
        concepts: [0, 1, 2].map((index) => ({
          headline: `초안 ${index + 1}`,
          caption: `문구 ${index + 1}`,
          why_it_works: "이유",
          usage_context: "활용",
        })),
      }),
    }));
    render(<HouseOriginalForm />);

    fireEvent.change(screen.getByLabelText("자체 밈 주제"), { target: { value: "첫 주제" } });
    fireEvent.click(screen.getByRole("button", { name: "자체 밈 초안 3개 만들기" }));
    expect(await screen.findByRole("button", { name: "“초안 1” 초안 사용" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("자체 밈 주제"), { target: { value: "바뀐 주제" } });
    expect(screen.queryByRole("button", { name: "“초안 1” 초안 사용" })).toBeNull();
    expect(createHouseOriginal).not.toHaveBeenCalled();
  });
});
