// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

import { SearchOutcomeTracker } from "@/components/search-outcome-tracker";

/** 컴포넌트 내부 안정화 지연(900ms)보다 넉넉히 넘긴다. */
const PAST_SETTLE = 1000;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("SearchOutcomeTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    track.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("쿼리가 안정된 뒤 search_submit을 결과 건수와 함께 1회 발사한다", () => {
    render(<SearchOutcomeTracker query="졌잘싸" resultCount={3} />);

    // 안정화 전에는 아직 아무것도 보내지 않는다.
    advance(500);
    expect(track).not.toHaveBeenCalled();

    advance(PAST_SETTLE);
    expect(track).toHaveBeenCalledExactlyOnceWith("search_submit", {
      query: "졌잘싸",
      result_count: 3,
    });
  });

  it("타이핑 중간 상태는 발사하지 않는다", () => {
    // 이 컴포넌트의 존재 이유. 입력창에서 재면 아래 3개가 전부 검색으로 잡힌다.
    const { rerender } = render(<SearchOutcomeTracker query="졌" resultCount={0} />);
    advance(200);
    rerender(<SearchOutcomeTracker query="졌잘" resultCount={1} />);
    advance(200);
    rerender(<SearchOutcomeTracker query="졌잘싸" resultCount={3} />);

    // 중간 상태들은 타이머가 취소돼 사라졌다.
    advance(PAST_SETTLE);
    expect(track).toHaveBeenCalledExactlyOnceWith("search_submit", {
      query: "졌잘싸",
      result_count: 3,
    });
  });

  it("결과 0건이면 search_no_result를 함께 발사한다", () => {
    render(<SearchOutcomeTracker query="없는밈" resultCount={0} />);
    advance(PAST_SETTLE);

    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith("search_submit", {
      query: "없는밈",
      result_count: 0,
    });
    expect(track).toHaveBeenCalledWith("search_no_result", { query: "없는밈" });
  });

  it("빈 쿼리는 검색으로 세지 않는다", () => {
    render(<SearchOutcomeTracker query="" resultCount={0} />);
    advance(PAST_SETTLE);

    expect(track).not.toHaveBeenCalled();
  });

  it("같은 쿼리가 다시 렌더돼도 중복 발사하지 않는다", () => {
    const { rerender } = render(<SearchOutcomeTracker query="밈" resultCount={2} />);
    advance(PAST_SETTLE);
    expect(track).toHaveBeenCalledTimes(1);

    // 뒤로가기·부모 리렌더로 같은 결과가 다시 그려지는 상황
    rerender(<SearchOutcomeTracker query="밈" resultCount={2} />);
    advance(PAST_SETTLE);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("검색어가 길어도 GA4 상한(100자)을 넘기지 않는다", () => {
    render(<SearchOutcomeTracker query={"가".repeat(300)} resultCount={1} />);
    advance(PAST_SETTLE);

    const [, params] = track.mock.calls[0] as [string, { query: string }];
    expect(params.query).toHaveLength(100);
  });
});
