import { describe, expect, it } from "vitest";
import {
  buildExplorePageHref,
  clampExplorePage,
  exploreCanonicalPath,
  explorePageOffset,
  hasExploreFacet,
  isCanonicalExplorePageParam,
  parseExplorePage,
} from "@/lib/explore-pagination";

describe("explore pagination", () => {
  it("accepts only positive integer page values", () => {
    expect(parseExplorePage("2")).toBe(2);
    expect(parseExplorePage(["3", "4"])).toBe(3);
    for (const value of [undefined, "", "0", "-1", "1.5", "nope", "9007199254740992"]) {
      expect(parseExplorePage(value)).toBe(1);
    }
    expect(isCanonicalExplorePageParam(undefined)).toBe(true);
    expect(isCanonicalExplorePageParam("2")).toBe(true);
    expect(isCanonicalExplorePageParam("1")).toBe(false);
    expect(isCanonicalExplorePageParam("02")).toBe(false);
    expect(isCanonicalExplorePageParam(["2", "3"])).toBe(false);
  });

  it("clamps page boundaries and produces stable offsets", () => {
    expect(clampExplorePage(9, 50)).toBe(3);
    expect(clampExplorePage(2, 24)).toBe(1);
    expect(clampExplorePage(4, 0)).toBe(1);
    expect(explorePageOffset(3)).toBe(48);
  });

  it("preserves filters while replacing page without duplicating it", () => {
    expect(
      buildExplorePageHref(
        "/explore",
        { category: ["phrase", "challenge"], sort: "recent", page: ["2", "99"] },
        3,
      ),
    ).toBe("/explore?category=phrase&category=challenge&sort=recent&page=3");
    expect(buildExplorePageHref("/explore", { page: "2" }, 1)).toBe("/explore");
  });

  it("indexes only pagination without facets and self-canonicalizes later pages", () => {
    expect(hasExploreFacet({ page: "2" })).toBe(false);
    expect(hasExploreFacet({ page: "2", sort: "recent" })).toBe(true);
    expect(exploreCanonicalPath("/explore", 1)).toBe("/explore");
    expect(exploreCanonicalPath("/explore", 2)).toBe("/explore?page=2");
  });
});
