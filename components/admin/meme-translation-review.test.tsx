// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const saveMemeTranslation = vi.fn();
const reviewMemeTranslation = vi.fn();
const markMemeTranslationStale = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/actions/admin-translations", () => ({
  saveMemeTranslation: (...args: unknown[]) => saveMemeTranslation(...args),
  reviewMemeTranslation: (...args: unknown[]) => reviewMemeTranslation(...args),
  markMemeTranslationStale: (...args: unknown[]) => markMemeTranslationStale(...args),
}));

import {
  MemeTranslationReview,
  type MemeTranslationReviewRow,
} from "@/components/admin/meme-translation-review";

const SOURCE_UPDATED_AT = "2026-07-28T01:00:00.000Z";
const TRANSLATION_UPDATED_AT = "2026-07-28T01:05:00.000Z";

function translation(
  overrides: Partial<MemeTranslationReviewRow> = {},
): MemeTranslationReviewRow {
  return {
    locale: "en",
    status: "machine",
    source_updated_at: SOURCE_UPDATED_AT,
    translated_at: "2026-07-28T01:05:00.000Z",
    updated_at: TRANSLATION_UPDATED_AT,
    reviewed_at: null,
    reviewed_by: null,
    title: "Wonyoung-style thinking",
    summary: "A deliberately optimistic way to reinterpret events.",
    description: "It reframes an inconvenient event as an unexpected advantage.",
    origin: "The phrase spread from comments about Jang Wonyoung's positive framing.",
    usage_note: "Use it to turn a minor setback into a positive punchline.",
    caution: "Do not use it to dismiss another person's serious problem.",
    aliases: ["Lucky Vicky"],
    ...overrides,
  };
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  saveMemeTranslation.mockResolvedValue({ ok: true });
  reviewMemeTranslation.mockResolvedValue({ ok: true });
  markMemeTranslationStale.mockResolvedValue({ ok: true });
});

describe("MemeTranslationReview", () => {
  it("shows locale, status, source freshness, audit timestamps, and every editable field", () => {
    render(
      <MemeTranslationReview
        memeId="meme-1"
        memeUpdatedAt={SOURCE_UPDATED_AT}
        translations={[
          translation({
            status: "reviewed",
            reviewed_at: "2026-07-28T02:00:00.000Z",
            reviewed_by: "operator-1",
          }),
        ]}
      />,
    );

    expect(screen.getByText("English (en)")).toBeTruthy();
    expect(screen.getByText("검수 완료·발행")).toBeTruthy();
    expect(screen.getByText("원문과 동일 revision")).toBeTruthy();
    expect(screen.getByText(/operator-1/)).toBeTruthy();
    expect(screen.getByDisplayValue("Wonyoung-style thinking")).toBeTruthy();
    expect(screen.getByDisplayValue(/deliberately optimistic/)).toBeTruthy();
    expect(screen.getByDisplayValue(/reframes an inconvenient event/)).toBeTruthy();
    expect(screen.getByDisplayValue(/spread from comments/)).toBeTruthy();
    expect(screen.getByDisplayValue(/turn a minor setback/)).toBeTruthy();
    expect(screen.getByDisplayValue(/dismiss another person's/)).toBeTruthy();
    expect(screen.getByDisplayValue("Lucky Vicky")).toBeTruthy();
  });

  it("allows draft edits but blocks review publishing when the source revision is stale", async () => {
    render(
      <MemeTranslationReview
        memeId="meme-1"
        memeUpdatedAt="2026-07-28T03:00:00.000Z"
        translations={[translation({ status: "stale" })]}
      />,
    );

    const reviewButton = screen.getByRole("button", { name: "[en] 검수 완료·발행" });
    expect((reviewButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/새 원문 기준 번역을 생성하기 전에는/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("[en] 제목"), {
      target: { value: "Edited localized title" },
    });
    fireEvent.change(screen.getByLabelText("[en] 별칭"), {
      target: { value: "Alias one, Alias two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "[en] 초안 저장" }));

    await waitFor(() => {
      expect(saveMemeTranslation).toHaveBeenCalledWith(
        expect.objectContaining({
          memeId: "meme-1",
          locale: "en",
          expectedTranslationUpdatedAt: TRANSLATION_UPDATED_AT,
          title: "Edited localized title",
          aliases: ["Alias one", "Alias two"],
        }),
      );
    });
    expect(reviewMemeTranslation).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("submits a fresh translation for review and can explicitly return it to stale", async () => {
    render(
      <MemeTranslationReview
        memeId="meme-2"
        memeUpdatedAt={SOURCE_UPDATED_AT}
        translations={[translation({ status: "reviewed" })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "[en] 검수 완료·발행" }));
    await waitFor(() => {
      expect(reviewMemeTranslation).toHaveBeenCalledWith(
        expect.objectContaining({
          memeId: "meme-2",
          locale: "en",
          expectedTranslationUpdatedAt: TRANSLATION_UPDATED_AT,
        }),
      );
    });

    const staleButton = screen.getByRole("button", { name: "[en] stale로 되돌리기" });
    await waitFor(() => {
      expect((staleButton as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(staleButton);
    await waitFor(() => {
      expect(markMemeTranslationStale).toHaveBeenCalledWith({
        memeId: "meme-2",
        locale: "en",
        expectedTranslationUpdatedAt: TRANSLATION_UPDATED_AT,
      });
    });
  });

  it("renders an explicit empty state before the translation batch creates drafts", () => {
    render(
      <MemeTranslationReview
        memeId="meme-3"
        memeUpdatedAt={SOURCE_UPDATED_AT}
        translations={[]}
      />,
    );

    expect(screen.getByText(/생성된 번역 초안이 없습니다/)).toBeTruthy();
  });
});
