// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeMemeIntentSubmit,
  MEME_INTENT_SUBMIT_EVENT,
  recordMemeIntentSubmit,
  signalMemeIntentSubmit,
} from "@/lib/meme-intent-submit.client";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe("meme intent submit bridge", () => {
  it("stores an exact Korean query once and consumes it before work starts", () => {
    expect(recordMemeIntentSubmit("  친구 취향을 따라 할 때  ", "ko", 1_000)).toBe(true);
    expect(consumeMemeIntentSubmit("친구 취향을 따라 할 때", "ko", 1_001)).toBe(true);
    expect(consumeMemeIntentSubmit("친구 취향을 따라 할 때", "ko", 1_002)).toBe(false);
  });

  it("does not match another query or locale and drops an expired marker", () => {
    expect(recordMemeIntentSubmit("월요일 출근", "ko", 1_000)).toBe(true);
    expect(consumeMemeIntentSubmit("금요일 퇴근", "ko", 1_001)).toBe(false);
    expect(consumeMemeIntentSubmit("월요일 출근", "ko", 1_001)).toBe(false);
    expect(recordMemeIntentSubmit("월요일 출근", "ko", 1_000)).toBe(true);
    expect(consumeMemeIntentSubmit("월요일 출근", "ko", 31_001)).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("ignores unsupported, too-short, and too-long requests", () => {
    expect(recordMemeIntentSubmit("밈", "en")).toBe(false);
    expect(recordMemeIntentSubmit("a", "ko")).toBe(false);
    expect(recordMemeIntentSubmit("x".repeat(121), "ko")).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("records before dispatching a same-tab event without exposing a history", () => {
    const listener = vi.fn();
    window.addEventListener(MEME_INTENT_SUBMIT_EVENT, listener);

    expect(signalMemeIntentSubmit("상황에 맞는 밈", "ko", 2_000)).toBe(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      locale: "ko",
      query: "상황에 맞는 밈",
    });
    expect(consumeMemeIntentSubmit("상황에 맞는 밈", "ko", 2_001)).toBe(true);
    expect(window.sessionStorage.length).toBe(0);

    window.removeEventListener(MEME_INTENT_SUBMIT_EVENT, listener);
  });
});
