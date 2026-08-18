// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/brand-workspace", () => ({
  saveBrandWorkspace: vi.fn(),
  saveBrandFitEvaluation: vi.fn(),
  recordBrandApproval: vi.fn(),
}));

import { BrandWorkspaceForms } from "./workspace-forms";

describe("BrandWorkspaceForms", () => {
  beforeEach(() => {
    cleanup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });

  it("exposes labeled fields and blocks evaluation until brand context exists", () => {
    render(<BrandWorkspaceForms bundle={null} />);

    expect(screen.getByRole("heading", { name: "브랜드 기준" })).toBeTruthy();
    expect(screen.getByLabelText("브랜드명")).toBeTruthy();
    expect(screen.getByLabelText("브랜드 문맥")).toBeTruthy();
    expect(screen.getByLabelText("브랜드 톤")).toBeTruthy();
    expect(screen.getByLabelText(/금지 표현/)).toBeTruthy();
    expect(screen.getByLabelText("밈 상세 경로")).toBeTruthy();
    expect((screen.getByRole("button", { name: "평가 저장" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders a recorded decision without mutable decision controls", () => {
    render(
      <BrandWorkspaceForms
        bundle={{
          workspace: {
            id: "workspace-1",
            brand_name: "MemeCatch",
            brand_context: "크리에이터 서비스",
            brand_tone: "친근하고 정확하게",
            forbidden_expressions: ["무조건"],
          },
          evaluations: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              meme_name: "테스트 밈",
              meme_path: "/memes/abcd1234-test",
              proposed_copy: "테스트 문구",
              fit_score: 85,
              risk_level: "low",
              rationale: "브랜드 톤과 잘 맞음",
              matched_forbidden_expressions: ["무조건"],
              created_at: "2026-08-18T00:00:00.000Z",
              approval: {
                decision: "approved",
                note: "캠페인 사용 승인",
                created_at: "2026-08-18T01:00:00.000Z",
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("승인됨")).toBeTruthy();
    expect(screen.getByText("캠페인 사용 승인")).toBeTruthy();
    expect(screen.getByText("금지 표현 감지: 무조건")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "반려" })).toBeNull();
  });

  it("shares only the public result summary and meme detail link", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <BrandWorkspaceForms bundle={{
        workspace: {
          id: "workspace-1", brand_name: "비공개 브랜드", brand_context: "비공개 문맥",
          brand_tone: "비공개 톤", forbidden_expressions: ["비공개 금칙어"],
        },
        evaluations: [{
          id: "11111111-1111-4111-8111-111111111111", meme_name: "테스트 밈",
          meme_path: "/memes/abcd1234-test", proposed_copy: "비공개 사용 문구", fit_score: 85,
          risk_level: "low", rationale: "비공개 판단 근거", matched_forbidden_expressions: [],
          created_at: "2026-08-18T00:00:00.000Z", approval: null,
        }],
      }} />,
    );

    await user.click(screen.getByRole("button", { name: "적합도 결과 공유" }));
    const shared = writeText.mock.calls[0]?.[0] ?? "";
    expect(shared).toContain("테스트 밈 · 내 브랜드 밈 적합도\n85점 · 위험도 낮음");
    expect(shared).toContain("/memes/abcd1234-test?utm_source=brand_fit_share&utm_medium=share");
    expect(shared).not.toMatch(/비공개 브랜드|비공개 문맥|비공개 금칙어|비공개 사용 문구|비공개 판단 근거/);
    expect(screen.getByRole("link", { name: "밈 상세 보기" }).getAttribute("href")).toBe("/memes/abcd1234-test");
  });
});
