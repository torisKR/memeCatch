// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/save-button", () => ({
  SaveButton: () => <button type="button">이 밈 저장하기</button>,
}));

import { AnswerCard } from "@/components/answer-card";

afterEach(cleanup);

describe("AnswerCard", () => {
  it("모바일 첫 카드에서 실제 사용 예를 저장 CTA보다 먼저 보여준다", () => {
    render(
      <AnswerCard
        meme={{
          title: "꽁냥이 챌린지",
          summary: "고양이 영상에 노래와 춤을 붙인 챌린지",
          lifecycle_status: "cooling",
          safety_level: "green",
          usage_note: "겨울철 귀여운 상황에 가볍게 인용",
        }}
        saveMemeId="00000000-0000-4000-8000-000000000001"
      />,
    );

    const example = screen.getByText(/겨울철 귀여운 상황에 가볍게 인용/);
    const save = screen.getByRole("button", { name: "이 밈 저장하기" });
    expect(example.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
