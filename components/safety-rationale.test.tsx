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
    // 등급 공통 범례가 아니라 usage_context로 조립한 이 밈 전용 문장이 나온다
    expect(
      screen.getByText("친구끼리는 무리 없이 통하지만, 직장에서는 맥락을 가려야 해요.")
    ).toBeTruthy();
    expect(screen.queryByText(/상황을 가려 써야 하는 등급/)).toBeNull();
    expect(screen.getByText("친한 사이 별명으로만")).toBeTruthy();
    expect(screen.getByText("어디서 써도 될까요?")).toBeTruthy();
    expect(screen.getByText("직장에서")).toBeTruthy();
    expect(screen.getByText("공식 자리에서는 오해 소지")).toBeTruthy();
    // sentiment도 근거의 일부로 노출
    expect(screen.getByText("논쟁 중")).toBeTruthy();
  });

  it("caution이 없으면 등급 일반 문구로 채우지 않는다(근거 발명 금지)", () => {
    render(
      <SafetyRationale
        level="red"
        sentiment="negative"
        context={{ work: "red" }}
        note={null}
        caution={null}
      />
    );
    // 사유가 없으면 '조심해 주세요' 블록 자체를 만들지 않는다
    expect(screen.queryByText(/이건 조심해 주세요/)).toBeNull();
    expect(
      screen.queryByText("커뮤니티 사용례에서 비하·논쟁 맥락이 확인된 등급이에요.")
    ).toBeNull();
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

  it("고유 신호(맥락·근거·주의)가 전무하면 카드를 렌더하지 않는다", () => {
    const { container } = render(
      <SafetyRationale
        level="red"
        sentiment="negative"
        context={null}
        note={null}
        caution={null}
      />
    );
    // 전 사이트 공통 범례 한 줄만 남는 빈 템플릿이 되므로 통째로 숨긴다
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText("이 판정의 근거")).toBeNull();
  });

  it("판정 문장을 usage_context로 조립해 밈마다 다르게 만든다", () => {
    const { container: a } = render(
      <SafetyRationale
        level="yellow"
        sentiment="funny"
        context={{ friends: "green", work: "yellow" }}
        note={null}
        caution={null}
      />
    );
    expect(
      screen.getByText("친구끼리는 무리 없이 통하지만, 직장에서는 맥락을 가려야 해요.")
    ).toBeTruthy();
    const first = a.textContent ?? "";
    cleanup();

    const { container: b } = render(
      <SafetyRationale
        level="yellow"
        sentiment="funny"
        context={{ sns: "red", family: "yellow" }}
        note={null}
        caution={null}
      />
    );
    expect(
      screen.getByText("자녀·가족과는 맥락을 가려야 하고, 공개 SNS에서는 쓰지 않는 게 좋아요.")
    ).toBeTruthy();
    // 같은 등급이라도 상황 데이터가 다르면 문장이 달라야 한다(템플릿 재사용 금지)
    expect(b.textContent).not.toBe(first);
  });
});
