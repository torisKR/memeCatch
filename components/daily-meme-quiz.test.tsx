// @vitest-environment jsdom
import type { ComponentPropsWithoutRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizQuestion } from "@/lib/quiz";

const db = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href }: Pick<ComponentPropsWithoutRef<"a">, "children" | "href">) => <a href={href}>{children}</a> }));
vi.mock("@/lib/analytics", () => analytics);
vi.mock("@/lib/db/client", () => ({ createClient: () => ({ auth: { getUser: db.getUser }, rpc: db.rpc }) }));
vi.mock("@/lib/daily-quiz", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/daily-quiz")>()),
  kstDayKey: () => "2026-11-19",
}));
import { DailyMemeQuiz } from "./daily-meme-quiz";
import { LOCAL_STREAK_KEY } from "@/lib/daily-quiz";

const question: QuizQuestion = {
  question: "「테스트 밈」, 무슨 뜻일까요?",
  options: ["보기 하나", "보기 둘", "보기 셋", "보기 넷"],
  answerIndex: 1,
  meme: { shortId: "abc12345", slug: "test", title: "테스트 밈", originYear: 2024, safetyLevel: "green" },
};

function rpcResult(row: unknown) {
  return { single: () => Promise.resolve({ data: row, error: null }) };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ date: "2026-11-19", question }) })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DailyMemeQuiz", () => {
  it("records a guest answer locally and continues yesterday's streak", async () => {
    db.getUser.mockResolvedValue({ data: { user: null }, error: null });
    window.localStorage.setItem(LOCAL_STREAK_KEY, JSON.stringify({ lastDate: "2026-11-18", streak: 4, best: 4, total: 4, lastSelected: 0, lastCorrect: true }));

    render(<DailyMemeQuiz />);
    expect(await screen.findByText("「테스트 밈」, 무슨 뜻일까요?")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/4일 연속/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /보기 둘/ }));

    expect(screen.getByText("정답! 밈력이 느껴져요.")).toBeTruthy();
    expect(screen.getByText(/5일 연속 출석!/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/login?next=/my");
    expect(analytics.track).toHaveBeenCalledWith("quiz_complete", { mode: "daily", score: 1 });
    expect(JSON.parse(window.localStorage.getItem(LOCAL_STREAK_KEY)!)).toMatchObject({ lastDate: "2026-11-19", streak: 5, total: 5 });
    expect(db.rpc).not.toHaveBeenCalled();
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses the server streak for signed-in users", async () => {
    db.getUser.mockResolvedValue({ data: { user: { id: "u1", is_anonymous: false } }, error: null });
    db.rpc.mockImplementation((fn: string) =>
      fn === "get_daily_meme_quiz_status"
        ? rpcResult({ quiz_date: "2026-11-19", completed_at: null, correct: null, current_streak: 6, best_streak: 9, total_days: 20 })
        : rpcResult({ quiz_date: "2026-11-19", completed_at: "2026-11-19T01:00:00Z", correct: false, current_streak: 7, best_streak: 9, total_days: 21 }),
    );

    render(<DailyMemeQuiz />);
    await waitFor(() => expect(screen.getByText(/6일 연속/)).toBeTruthy());
    fireEvent.click(await screen.findByRole("button", { name: /보기 하나/ }));

    await waitFor(() => expect(screen.getByText(/7일 연속 출석!/)).toBeTruthy());
    expect(db.rpc).toHaveBeenCalledWith("complete_daily_meme_quiz", { p_meme_short_id: "abc12345", p_correct: false });
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
  });

  it("renders nothing when the question cannot be loaded", async () => {
    db.getUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })));
    const { container } = render(<DailyMemeQuiz />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});
