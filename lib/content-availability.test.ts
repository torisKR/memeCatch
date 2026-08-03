import { describe, expect, test } from "vitest";
import {
  UNAVAILABLE_STATUSES,
  isAvailableContent,
  isRenderableContent,
} from "./content-availability";

describe("isAvailableContent", () => {
  test("live·unchecked는 재생 가능으로 본다", () => {
    expect(isAvailableContent({ availability: "live" })).toBe(true);
    // 미확인은 "아직 확인 안 함"이지 "죽음"이 아니다 — 화면에서 지우지 않는다.
    expect(isAvailableContent({ availability: "unchecked" })).toBe(true);
  });

  test("dead와 region_blocked는 둘 다 제외한다", () => {
    expect(isAvailableContent({ availability: "dead" })).toBe(false);
    expect(isAvailableContent({ availability: "region_blocked" })).toBe(false);
  });

  test("availability를 모르면 막지 않는다", () => {
    expect(isAvailableContent({})).toBe(true);
    expect(isAvailableContent({ availability: null })).toBe(true);
    expect(isAvailableContent(null)).toBe(true);
  });

  test("제외 목록은 DB 게이트(is_meme_rank_eligible)와 같은 두 값이다", () => {
    expect([...UNAVAILABLE_STATUSES]).toEqual(["dead", "region_blocked"]);
  });
});

describe("isRenderableContent", () => {
  test("승인 + 재생 가능일 때만 렌더한다", () => {
    expect(
      isRenderableContent({ availability: "live", moderation_status: "approved" }),
    ).toBe(true);
  });

  test("region_blocked는 승인됐어도 렌더하지 않는다", () => {
    expect(
      isRenderableContent({
        availability: "region_blocked",
        moderation_status: "approved",
      }),
    ).toBe(false);
  });

  test("미승인 콘텐츠는 살아 있어도 렌더하지 않는다", () => {
    expect(
      isRenderableContent({ availability: "live", moderation_status: "pending" }),
    ).toBe(false);
    expect(isRenderableContent({ availability: "live" })).toBe(false);
  });

  test("null·undefined는 렌더하지 않는다", () => {
    expect(isRenderableContent(null)).toBe(false);
    expect(isRenderableContent(undefined)).toBe(false);
  });
});
