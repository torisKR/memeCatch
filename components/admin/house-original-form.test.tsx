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

function localImportArtifact() {
  const draft = {
    title: "로컬 초안 제목",
    summary: "로컬에서 생성하고 독립 검토까지 마친 자체 제작 밈 요약",
    description:
      "하루의 업무를 모두 마친 사람이 화면의 마지막 체크 표시를 누르는 장면을 담는다. 체크가 끝나는 순간 화면 아래에서 커다란 퇴근 버튼이 올라오고, 주변의 알림 조각은 조용히 사라진다. 핵심 문구는 ‘오늘 할 일 완료, 이제 퇴근 버튼만 누르면 됨’이다. 실제 시스템 기능을 설명하는 문구가 아니라 하루의 작은 성취를 게임의 마지막 단계처럼 표현한 말장난이다. 바쁜 날 끝에 동료와 가볍게 성취감을 나누는 상황을 위해 밈캐치가 자체 기획했다. 버튼이 활성화되기 전에는 작은 체크 표시들이 차례로 켜지고, 마지막 체크가 끝나면 화면 전체의 색이 차분한 회색에서 밝은 초록색으로 바뀐다. 남은 일을 재촉하기보다 오늘 끝낸 일에 잠시 만족하는 태도를 가볍게 보여 준다.",
    origin: "밈캐치가 하루 업무 완료의 성취감을 게임의 마지막 버튼에 비유해 자체 기획한 창작 문구입니다.",
    usageNote: "업무를 마친 직후 동료나 친구에게 가볍게 성취감을 알리는 메신저와 게시물에 사용합니다.",
    caution: "실제 퇴근 승인이나 업무 완료를 확인하는 시스템 기능으로 오해하지 않도록 사용합니다.",
    examples: [
      { context: "work", text: "오늘 할 일 완료. 이제 퇴근 버튼만 누르면 됨." },
      { context: "friends", text: "나 오늘 퇴근 버튼 정시에 누른다." },
    ],
    card: {
      caption: "오늘 할 일 완료\n퇴근 버튼 활성화",
      visualBrief:
        "짙은 화면 위에 밈캐치 자체 도형으로 만든 체크 표시와 커다란 둥근 퇴근 버튼을 배치한다. 버튼을 누르는 손과 사라지는 알림 조각을 함께 그린다.",
      motif: "office",
      symbols: ["screen", "briefcase", "spark"],
      composition: "frame",
    },
  };
  return {
    schemaVersion: 1,
    kind: "house_original",
    status: "draft",
    generatedAt: "2025-12-31T23:30:00.000Z",
    provider: "opencodex",
    topic: "하루 업무를 모두 마친 순간",
    review: { decision: "pass", issues: [] },
    draft,
    adminDraft: {
      title: draft.title,
      summary: draft.summary,
      description: `${draft.description}\n\n활용: ${draft.usageNote}\n\n자체 작성 예문:\n${draft.examples.map((example) => `${example.context}: ${example.text}`).join("\n")}\n\n주의: ${draft.caution}\n\n카드 문구: ${draft.card.caption}\n\n비주얼: ${draft.card.visualBrief}\n\n카드 제작 설정: ${JSON.stringify({ motif: draft.card.motif, symbols: draft.card.symbols, composition: draft.card.composition })}`,
      origin: draft.origin,
      safetyLevel: "yellow",
      category: "image",
      difficulty: "normal",
      originYear: 2025,
      country: "KR",
      usageContext: {
        work: "yellow",
        friends: "green",
        family: "yellow",
        sns: "yellow",
      },
    },
  };
}

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

  it("imports a reviewed local JSON draft without fetching or saving", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    createHouseOriginal.mockResolvedValue({ ok: true, data: { memeId: "meme-imported" } });
    render(<HouseOriginalForm />);

    const artifact = {
      ...localImportArtifact(),
      moderationStatus: "approved",
      publishImmediately: true,
      runtimeOverrides: { safetyLevel: "green", country: "US" },
    };
    const file = new File([JSON.stringify(artifact)], "draft.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify(artifact),
    });
    const input = screen.getByLabelText("초안 JSON 파일 (최대 100KB)") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe("로컬 초안 제목");
    });
    expect((screen.getByLabelText("한 줄 요약") as HTMLInputElement).value).toBe(
      artifact.adminDraft.summary,
    );
    expect((screen.getByLabelText("분류") as HTMLSelectElement).value).toBe("image");
    expect((screen.getByLabelText("밈 국가") as HTMLSelectElement).value).toBe("KR");
    expect(screen.getByRole("status").textContent).toContain("대기로 저장");
    expect(screen.getByRole("complementary", { name: "가져온 카드 문구·아트 방향·제작 설정" }).textContent).toContain(
      artifact.draft.card.caption,
    );
    expect(screen.getByRole("complementary", { name: "가져온 카드 문구·아트 방향·제작 설정" }).textContent).toContain(
      artifact.draft.card.visualBrief,
    );
    expect(
      screen.getByRole("complementary", { name: "가져온 카드 문구·아트 방향·제작 설정" })
        .textContent,
    ).toContain(JSON.stringify({
      motif: artifact.draft.card.motif,
      symbols: artifact.draft.card.symbols,
      composition: artifact.draft.card.composition,
    }));
    expect(screen.getByText("카드 문구·아트 방향·제작 설정 (초안 설명에 함께 저장)")).toBeTruthy();
    expect(input.value).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createHouseOriginal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "대기로 저장" }));
    await waitFor(() => {
      expect(createHouseOriginal).toHaveBeenCalledWith({
        ...artifact.adminDraft,
        localTitle: "로컬 초안 제목",
      });
    });
    const savedDraft = createHouseOriginal.mock.calls[0]?.[0];
    expect(savedDraft.description).toContain(`카드 문구: ${artifact.draft.card.caption}`);
    expect(savedDraft.description).toContain(`비주얼: ${artifact.draft.card.visualBrief}`);
    expect(savedDraft.description).toContain(`카드 제작 설정: ${JSON.stringify({
      motif: artifact.draft.card.motif,
      symbols: artifact.draft.card.symbols,
      composition: artifact.draft.card.composition,
    })}`);
    expect(savedDraft).not.toHaveProperty("card");
    expect(push).toHaveBeenCalledWith("/admin/memes/meme-imported");
  });

  it("rejects protected fields in imported admin drafts and resets the file input", async () => {
    render(<HouseOriginalForm />);
    const safeArtifact = localImportArtifact();
    const artifact = {
      ...safeArtifact,
      adminDraft: {
        ...safeArtifact.adminDraft,
        moderationStatus: "approved",
        rightsAttested: true,
      },
    };
    const file = new File([JSON.stringify(artifact)], "unsafe.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify(artifact),
    });
    const input = screen.getByLabelText("초안 JSON 파일 (최대 100KB)") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "허용되지 않은 게시·권리 설정",
    );
    expect(input.value).toBe("");
    expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe("");
    expect(createHouseOriginal).not.toHaveBeenCalled();
  });
});
