// @vitest-environment jsdom
import type { ComponentPropsWithoutRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { QuizApp, type QuizChallenge } from "@/components/quiz-app";
import type { QuizQuestion } from "@/lib/quiz";

const IDS = ["abcdefgh", "jkmnpqrs"];
const challenge: QuizChallenge = {
  mode: "now",
  shortIds: IDS,
  correct: [true, false],
  score: 1,
  total: 2,
  gradeLabel: "밈러",
  gradeComment: "감은 확실히 있어요.",
};

function question(shortId: string): QuizQuestion {
  return {
    question: `「${shortId}」, 무슨 뜻일까요?`,
    options: ["정답 보기", "오답 보기 1", "오답 보기 2", "오답 보기 3"],
    answerIndex: 0,
    meme: { shortId, slug: shortId, title: shortId, originYear: 2021, safetyLevel: "green" },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("QuizApp challenge link", () => {
  it("replays the friend's set and shares a result link that beats them", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ mode: "now", questions: IDS.map(question) })
    );
    vi.stubGlobal("fetch", fetchMock);
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<QuizApp challenge={challenge} />);
    expect(screen.getByText("친구가 보낸 도전장 · 요즘 밈 모드")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "내 점수 이겨보기" }));
    await waitFor(() => expect(screen.getByText("「abcdefgh」, 무슨 뜻일까요?")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/quiz?mode=now&set=abcdefgh%2Cjkmnpqrs",
      { cache: "no-store" }
    );

    fireEvent.click(screen.getByRole("button", { name: /정답 보기/ }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: /정답 보기/ }));
    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));

    expect(screen.getByText(/친구 1\/2 vs 나 2\/2 — 친구를 이겼어요!/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /결과 링크 공유/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]![0]).toContain(`/quiz/r/n003${IDS.join("")}`);
  });

  it("lets the recipient skip to a fresh quiz", () => {
    render(<QuizApp challenge={challenge} />);
    fireEvent.click(screen.getByRole("button", { name: "새 문제로 풀기" }));
    expect(screen.getByText("범위를 골라 바로 시작하세요")).toBeTruthy();
  });
});
