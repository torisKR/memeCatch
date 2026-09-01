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
        country_code: "US",
        headline: "게시물 캡션 · 칼퇴의 기적",
        caption: "회의가 일찍 끝났다. 오늘은 내가 주인공이다.",
        local_caption: "The meeting ended early. Today I win.",
        cultural_anchor: "미국 직장인의 퇴근 단체 채팅",
        visual_brief: "노트북을 닫는 손",
        why_it_works: "작은 행운을 과장해 공감을 만든다.",
        usage_context: "퇴근 직전 단체 채팅에 쓰기 좋다.",
      },
      {
        country_code: "US",
        headline: "두 번째 초안",
        caption: "두 번째 문구",
        local_caption: "Second local caption",
        cultural_anchor: "두 번째 현지 맥락",
        visual_brief: "두 번째 비주얼",
        why_it_works: "두 번째 이유",
        usage_context: "두 번째 활용",
      },
      {
        country_code: "US",
        headline: "세 번째 초안",
        caption: "세 번째 문구",
        local_caption: "Third local caption",
        cultural_anchor: "세 번째 현지 맥락",
        visual_brief: "세 번째 비주얼",
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
    fireEvent.change(screen.getByLabelText("밈 국가"), { target: { value: "US" } });
    fireEvent.click(screen.getByRole("button", { name: "자체 밈 초안 3개 만들기" }));

    expect(await screen.findByText("$0 기본 템플릿 초안")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/meme-studio",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topic: "회의 조기 종료", tone: "hype", format: "caption", country: "US" }),
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
          country: "US",
          localTitle: "The meeting ended early. Today I win.",
        }),
      );
    });
    expect(push).toHaveBeenCalledWith("/admin/memes/meme-2");
  });

  it("saves one explicitly chosen Bedrock concept directly as pending with safe defaults", async () => {
    const concepts = [0, 1, 2].map((index) => ({
      country_code: "FR",
      headline: `Bedrock 초안 ${index + 1}`,
      caption: `문구 ${index + 1}`,
      local_caption: `Phrase locale ${index + 1}`,
      cultural_anchor: `현지 맥락 ${index + 1}`,
      visual_brief: `비주얼 ${index + 1}`,
      why_it_works: `이유 ${index + 1}`,
      usage_context: `활용 ${index + 1}`,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mode: "ai", provider: "bedrock", concepts }),
    }));
    createHouseOriginal.mockResolvedValue({ ok: true, data: { memeId: "meme-bedrock" } });
    render(<HouseOriginalForm />);

    fireEvent.change(screen.getByLabelText("자체 밈 주제"), { target: { value: "칼퇴 성공" } });
    fireEvent.change(screen.getByLabelText("밈 국가"), { target: { value: "FR" } });
    fireEvent.click(screen.getByRole("button", { name: "자체 밈 초안 3개 만들기" }));

    expect(await screen.findByText("AWS Bedrock 초안")).toBeTruthy();
    expect(screen.getAllByText("프랑스").length).toBeGreaterThan(0);
    expect(screen.getByText("Phrase locale 2", { exact: false })).toBeTruthy();
    expect(screen.getByText("현지 맥락 2", { exact: false })).toBeTruthy();
    expect(screen.getByText("비주얼 2", { exact: false })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /대기로 바로 저장/ })).toHaveLength(3);
    expect(createHouseOriginal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "“Bedrock 초안 2” 대기로 바로 저장" }));
    await waitFor(() => {
      expect(createHouseOriginal).toHaveBeenCalledTimes(1);
      expect(createHouseOriginal).toHaveBeenCalledWith({
        title: "Bedrock 초안 2",
        summary: "문구 2",
        description: "현지 맥락: 현지 맥락 2\n\n비주얼: 비주얼 2\n\n왜 통하나요? 이유 2\n\n추천 활용: 활용 2",
        origin: expect.stringContaining("외부 SNS 원본이나 제3자 미디어를 사용하지 않았습니다."),
        country: "FR",
        localTitle: "Phrase locale 2",
        safetyLevel: "yellow",
        category: "phrase",
        difficulty: "normal",
        originYear: new Date().getFullYear(),
        usageContext: {
          work: "yellow",
          friends: "green",
          family: "yellow",
          sns: "yellow",
        },
      });
    });
    expect(push).toHaveBeenCalledWith("/admin/memes/meme-bedrock");
  });

  it("keeps the chosen concept visible when direct pending save fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "template",
        concepts: [0, 1, 2].map((index) => ({
          country_code: "KR",
          headline: `초안 ${index + 1}`,
          caption: `문구 ${index + 1}`,
          local_caption: `현지 문구 ${index + 1}`,
          cultural_anchor: "현지 맥락",
          visual_brief: "비주얼",
          why_it_works: "이유",
          usage_context: "활용",
        })),
      }),
    }));
    createHouseOriginal.mockResolvedValue({ ok: false, error: "저장 실패" });
    render(<HouseOriginalForm />);

    fireEvent.change(screen.getByLabelText("자체 밈 주제"), { target: { value: "저장 실패" } });
    fireEvent.click(screen.getByRole("button", { name: "자체 밈 초안 3개 만들기" }));
    fireEvent.click(await screen.findByRole("button", { name: "“초안 1” 대기로 바로 저장" }));

    expect((await screen.findByRole("alert")).textContent).toContain("저장 실패");
    expect(screen.getByText("초안 1")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("discards generated drafts when their topic changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "template",
        concepts: [0, 1, 2].map((index) => ({
          country_code: "KR",
          headline: `초안 ${index + 1}`,
          caption: `문구 ${index + 1}`,
          local_caption: `현지 문구 ${index + 1}`,
          cultural_anchor: "현지 맥락",
          visual_brief: "비주얼",
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
