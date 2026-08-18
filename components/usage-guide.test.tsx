// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UsageGuide } from "@/components/usage-guide";

afterEach(cleanup);

describe("UsageGuide", () => {
  it("기존 4개 판정을 상업용 4문맥과 실제 갱신일로 보수적으로 보여준다", () => {
    render(
      <UsageGuide
        context={{ work: "yellow", friends: "green", family: "yellow", sns: "red" }}
        note="개인 문맥 검수 근거"
        caution="상업 문맥 주의 근거"
        reviewedAt="2026-08-17T02:00:00.000Z"
      />
    );

    for (const label of ["개인", "회사", "브랜드", "광고"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("상업 문맥 주의 근거")).toHaveLength(4);
    expect(screen.getByText("2026년 8월 17일")).toBeTruthy();
  });

  it("유효한 검수일이 없으면 날짜를 추정하지 않는다", () => {
    render(<UsageGuide context={{ work: "green" }} reviewedAt="not-a-date" />);
    expect(screen.getByText(/최근 검수일:/).textContent).toContain("확인된 기록 없음");
    expect(screen.queryByRole("time")).toBeNull();
  });
});
