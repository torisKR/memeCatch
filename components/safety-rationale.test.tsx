// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SafetyRationale } from "@/components/safety-rationale";

afterEach(cleanup);

describe("SafetyRationale", () => {
  it("등급 의미·usage_note·상황별 가이드·caution을 한 카드로 렌더한다", () => {
    render(
      <SafetyRationale
        level="yellow"
        sentiment="controversial"
        context={{ work: "yellow", friends: "green" }}
        note="친한 사이 별명으로만"
        caution="공식 자리에서는 오해 소지"
      />
    );
    expect(screen.getByText("이 판정의 근거")).toBeTruthy();
    expect(screen.getByText(/상황을 가려 써야 하는 등급/)).toBeTruthy();
    expect(screen.getByText("친한 사이 별명으로만")).toBeTruthy();
    expect(screen.getByText("어디서 써도 될까요?")).toBeTruthy();
    expect(screen.getByText("직장에서")).toBeTruthy();
    expect(screen.getByText("공식 자리에서는 오해 소지")).toBeTruthy();
    // sentiment도 근거의 일부로 노출
    expect(screen.getByText("논쟁 중")).toBeTruthy();
  });

  it("caution 없는 red/yellow는 등급 일반 설명으로 폴백한다(근거 발명 금지)", () => {
    render(
      <SafetyRationale
        level="red"
        sentiment="negative"
        context={null}
        note={null}
        caution={null}
      />
    );
    expect(
      screen.getByText("커뮤니티 사용례에서 비하·논쟁 맥락이 확인된 등급이에요.")
    ).toBeTruthy();
    // usage_context가 비면 상황별 가이드 소제목도 미노출
    expect(screen.queryByText("어디서 써도 될까요?")).toBeNull();
  });

  it("green은 caution 폴백을 만들지 않는다", () => {
    render(
      <SafetyRationale
        level="green"
        sentiment="funny"
        context={{ sns: "green" }}
        note={null}
        caution={null}
      />
    );
    expect(screen.queryByText(/이건 조심해 주세요/)).toBeNull();
  });
});
