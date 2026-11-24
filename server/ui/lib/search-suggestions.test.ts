import { afterEach, describe, expect, it, vi } from "vitest";
import { createSearchSuggestionCache } from "./search-suggestions";

afterEach(() => vi.useRealTimers());

describe("search suggestion cache", () => {
  it("caches successful empty results but expires them after 30 seconds", () => {
    vi.useFakeTimers();
    const cache = createSearchSuggestionCache();
    cache.set("없는밈", []);
    vi.advanceTimersByTime(29_999);
    expect(cache.get("없는밈")).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(cache.get("없는밈")).toBeUndefined();
  });

  it("keeps only 32 entries and preserves recently reused queries", () => {
    const cache = createSearchSuggestionCache();
    for (let i = 0; i < 32; i++) cache.set(String(i), []);
    cache.get("0");
    cache.set("32", []);
    expect(cache.get("1")).toBeUndefined();
    expect(cache.get("0")).toEqual([]);
    expect(cache.get("32")).toEqual([]);
  });

  it("does not share entries between mounted inputs", () => {
    const first = createSearchSuggestionCache();
    const second = createSearchSuggestionCache();
    first.set("밈", []);
    expect(second.get("밈")).toBeUndefined();
  });
});
