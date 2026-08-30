// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const generateKoreanReviewDraft = vi.fn();
const updateMeme = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/admin", () => ({
  generateKoreanReviewDraft: (...args: unknown[]) => generateKoreanReviewDraft(...args),
  updateMeme: (...args: unknown[]) => updateMeme(...args),
}));

import { MemeEditForm } from "@/components/admin/meme-edit-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const initial = {
  title: "Dramatic Chipmunk",
  summary: "A short reaction video used for dramatic reveals.",
  description: "The clip zooms in on a prairie dog.",
  origin: "It spread online in 2007.",
  usageNote: "Use it after a surprising reveal.",
  caution: "The exact first upload still needs verification.",
  aliases: [],
  safetyLevel: "green" as const,
  lifecycleStatus: "archived" as const,
  category: "image" as const,
  difficulty: "beginner" as const,
  sentiment: "funny" as const,
  originYear: 2007,
  usageContext: {
    work: "yellow" as const,
    friends: "green" as const,
    family: "green" as const,
    sns: "green" as const,
  },
};

describe("MemeEditForm Korean review", () => {
  it("fills the editable fields with a Korean draft without saving automatically", async () => {
    generateKoreanReviewDraft.mockResolvedValue({
      ok: true,
      data: {
        title: "극적인 프레리도그",
        summary: "놀라운 순간에 쓰는 짧은 반응 영상이에요.",
        description: "프레리도그를 빠르게 확대하는 장면이에요.",
        origin: "2007년 무렵 온라인에서 확산된 것으로 알려져 있어요.",
        usage_note: "반전이 드러난 직후에 사용해요.",
        caution: "최초 업로드 출처는 확인 중이에요.",
        review_basis: "ai_translation",
      },
    });

    render(<MemeEditForm memeId="meme-1" initial={initial} hasOpenAiReviewKey />);
    fireEvent.click(screen.getByRole("button", { name: "GPT-5.6 Sol high로 검수 초안" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("극적인 프레리도그")).toBeTruthy();
    });
    expect(screen.getByDisplayValue("놀라운 순간에 쓰는 짧은 반응 영상이에요.")).toBeTruthy();
    expect(screen.getByText(/사실관계와 고유명사를 확인한 뒤 저장/)).toBeTruthy();
    expect(updateMeme).not.toHaveBeenCalled();

    updateMeme.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(updateMeme).toHaveBeenCalledWith(
        expect.objectContaining({
          memeId: "meme-1",
          title: "극적인 프레리도그",
          summary: "놀라운 순간에 쓰는 짧은 반응 영상이에요.",
          caution: "최초 업로드 출처는 확인 중이에요.",
        })
      );
    });
  });

  it("explains that a requested safety change is queued for review", async () => {
    updateMeme.mockResolvedValue({ ok: true, data: { safetyReviewQueued: true } });

    render(<MemeEditForm memeId="meme-1" initial={initial} hasOpenAiReviewKey={false} />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(
      await screen.findByText("내용을 저장하고 안전 등급 변경은 Radar 검수 대기열에 추가했어요."),
    ).toBeTruthy();
  });

  it("uses the house-original make heading instead of folk 유래", () => {
    render(
      <MemeEditForm
        memeId="meme-1"
        initial={initial}
        hasOpenAiReviewKey={false}
        originKind="house_original"
      />,
    );
    expect(screen.getByLabelText("어떻게 만들었나요?")).toBeTruthy();
    expect(screen.getByLabelText("어떻게 만들었나요?").getAttribute("aria-describedby")).toBe(
      "house-origin-hint",
    );
    expect(screen.getByText("검수 메모나 게시 여부를 쓰지 말고", { exact: false })).toBeTruthy();
    expect(screen.queryByLabelText("유래")).toBeNull();
    expect(screen.getByLabelText("제작 연도")).toBeTruthy();
    expect(screen.queryByLabelText("유행 시작 연도")).toBeNull();
  });

  it("keeps the catalog origin field labeled 유래", () => {
    render(<MemeEditForm memeId="meme-1" initial={initial} hasOpenAiReviewKey={false} />);
    expect(screen.getByLabelText("유래")).toBeTruthy();
    expect(screen.getByLabelText("유행 시작 연도")).toBeTruthy();
  });
});
