// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/save-button", () => ({
  SaveButton: ({ compact }: { compact?: boolean }) => (
    <button type="button">{compact ? "저장" : "이 밈 저장하기"}</button>
  ),
}));

import { AnswerCard } from "@/components/answer-card";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const meme = {
  title: "꽁냥이 챌린지",
  summary: "고양이 영상에 노래와 춤을 붙인 챌린지",
  lifecycle_status: "cooling" as const,
  safety_level: "green" as const,
  usage_note: "겨울철 귀여운 상황에 가볍게 인용",
};

async function hydrateAnswerCard() {
  const host = document.createElement("div");
  host.innerHTML = renderToString(<AnswerCard meme={meme} />);
  document.body.append(host);

  const onRecoverableError = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  let root: ReturnType<typeof hydrateRoot> | undefined;

  try {
    await act(async () => {
      root = hydrateRoot(host, <AnswerCard meme={meme} />, {
        onRecoverableError,
      });
    });

    return {
      consoleErrors: [...consoleError.mock.calls],
      hasLifecycleStatus: within(host).getByText("식는 중").isConnected,
      hasSafetySignal: within(host).getByText("써도 됨").isConnected,
      recoverableErrors: [...onRecoverableError.mock.calls],
      hasTechnicalSignalHeader: host.textContent?.includes("Life signal") ?? false,
      signalTraceCount: host.querySelectorAll('[aria-label*="생애주기 파형"]').length,
      safetyGlowCount: host.querySelectorAll('[data-testid="safety-glow"]').length,
      safetyPulseCount: host.querySelectorAll(".safety-pulse").length,
    };
  } finally {
    await act(async () => {
      root?.unmount();
    });
    consoleError.mockRestore();
    host.remove();
  }
}

describe("AnswerCard", () => {
  it("제목과 한 줄 뜻 뒤에 실제 상태와 저장 CTA만 간결하게 보여준다", () => {
    render(
      <AnswerCard
        meme={meme}
        saveMemeId="00000000-0000-4000-8000-000000000001"
        actions={<button type="button">공유</button>}
      />,
    );

    const title = screen.getByRole("heading", { level: 1, name: "꽁냥이 챌린지" });
    const summary = document.getElementById("meme-summary");
    const save = screen.getByRole("button", { name: "저장" });
    const share = screen.getByRole("button", { name: "공유" });
    if (!summary) throw new Error("meme summary is missing");
    expect(title.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/겨울철 귀여운 상황에 가볍게 인용/)).toBeNull();
    expect(screen.getByText("한눈에 보는 뜻")).toBeTruthy();
    expect(screen.getByText("밈의 흐름")).toBeTruthy();
    expect(screen.getByText("사용 신호")).toBeTruthy();
    expect(screen.getByText("식는 중")).toBeTruthy();
    expect(screen.getByText("써도 됨")).toBeTruthy();
    expect(screen.queryByText("Life signal")).toBeNull();
    expect(document.querySelector(".safety-pulse")).toBeNull();
    expect(save.parentElement).toBe(share.parentElement);
  });

  it("SSR 결과에도 단일 제목과 뜻, 실제 상태 문자열을 그대로 제공한다", () => {
    const html = renderToString(<AnswerCard meme={meme} />);

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('id="meme-summary"');
    expect(html).toContain("한눈에 보는 뜻");
    expect(html).toContain("밈의 흐름");
    expect(html).toContain("식는 중");
    expect(html).toContain("사용 신호");
    expect(html).toContain("써도 됨");
  });

  it("첫 클라이언트 렌더가 SSR 카드와 일치하고 장식 신호를 만들지 않는다", async () => {
    const {
      consoleErrors,
      hasLifecycleStatus,
      hasSafetySignal,
      hasTechnicalSignalHeader,
      recoverableErrors,
      signalTraceCount,
      safetyGlowCount,
      safetyPulseCount,
    } =
      await hydrateAnswerCard();

    expect(recoverableErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(safetyGlowCount).toBe(0);
    expect(safetyPulseCount).toBe(0);
    expect(signalTraceCount).toBe(0);
    expect(hasTechnicalSignalHeader).toBe(false);
    expect(hasLifecycleStatus).toBe(true);
    expect(hasSafetySignal).toBe(true);
  });
});
