// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UsageGuide } from "@/components/usage-guide";

afterEach(cleanup);

describe("UsageGuide", () => {
  it("기존 4개 문맥과 실제 판정을 그대로 보여준다", () => {
    const { container } = render(
      <UsageGuide
        context={{ work: "yellow", friends: "green", family: "yellow", sns: "red" }}
        note="일상 문맥 검수 근거"
        caution="주의 문맥 검수 근거"
        reviewedAt="2026-08-17T02:00:00.000Z"
      />
    );

    for (const [label, grade] of [
      ["직장에서", "맥락 주의"],
      ["친구끼리", "써도 됨"],
      ["자녀·가족과", "맥락 주의"],
      ["공개 SNS에서", "쓰면 위험"],
    ] as const) {
      expect(screen.getByText(label).closest("li")?.textContent).toContain(grade);
    }
    expect(screen.getAllByText("일상 문맥 검수 근거")).toHaveLength(1);
    expect(screen.getAllByText("주의 문맥 검수 근거")).toHaveLength(3);
    expect(screen.getByText("2026년 8월 17일")).toBeTruthy();
    expect(container.querySelectorAll("[data-safety-icon]")).toHaveLength(4);
    expect(container.textContent).not.toContain("●");
    expect(container.textContent).not.toContain("▲");
    expect(container.textContent).not.toContain("✕");
  });

  it("유효한 검수일이 없으면 날짜를 추정하지 않는다", () => {
    render(<UsageGuide context={{ work: "green" }} reviewedAt="not-a-date" />);
    expect(screen.getByText(/최근 검수일:/).textContent).toContain("확인된 기록 없음");
    expect(screen.queryByRole("time")).toBeNull();
  });

  it("SNS green을 브랜드·광고 사용 가능 판정으로 바꾸지 않는다", () => {
    render(
      <UsageGuide
        context={{ sns: "green" }}
        note="공개 SNS 용례를 확인했어요"
      />
    );

    expect(screen.getByText("공개 SNS에서").closest("li")?.textContent).toContain("써도 됨");
    expect(screen.queryByText("브랜드")).toBeNull();
    expect(screen.queryByText("광고")).toBeNull();
  });
});
