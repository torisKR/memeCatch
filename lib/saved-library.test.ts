import { describe, expect, it } from "vitest";
import {
  applySavedLibraryEntitlement,
  normalizeSavedLibraryQuery,
  parseSavedLibraryFilters,
  savedLibraryHref,
  savedLibraryTitleFilter,
} from "@/lib/saved-library";

describe("Plus Meme Vault filters", () => {
  it("parses only supported safety values and a safe positive page", () => {
    expect(
      parseSavedLibraryFilters({
        saved_q: "  BTS  meme ",
        saved_safety: "yellow",
        saved_page: "3",
      }),
    ).toEqual({ query: "BTS meme", safety: "yellow", page: 3 });
    expect(
      parseSavedLibraryFilters({ saved_safety: "unknown", saved_page: "-1" }),
    ).toEqual({ query: "", safety: null, page: 1 });
  });

  it("does not let a hand-crafted URL unlock filters for a free account", () => {
    const filters = parseSavedLibraryFilters({
      saved_q: "BTS",
      saved_safety: "green",
      saved_page: "2",
    });

    expect(applySavedLibraryEntitlement(filters, false)).toEqual({
      query: "",
      safety: null,
      page: 2,
    });
    expect(applySavedLibraryEntitlement(filters, true)).toEqual(filters);
  });

  it("removes raw PostgREST grammar before creating an embedded title search", () => {
    expect(normalizeSavedLibraryQuery("  hello, (world)*.  ")).toBe(
      "hello world",
    );
    expect(savedLibraryTitleFilter("hello, (world)*.")).toBe(
      "title.ilike.*hello world*,summary.ilike.*hello world*",
    );
    expect(savedLibraryTitleFilter("")).toBeNull();
  });

  it("preserves filters through pagination and safely encodes the URL", () => {
    expect(savedLibraryHref({ query: "아이돌 밈", safety: "green" }, 2)).toBe(
      "/my?saved_q=%EC%95%84%EC%9D%B4%EB%8F%8C+%EB%B0%88&saved_safety=green&saved_page=2#saved",
    );
    expect(savedLibraryHref({ query: "", safety: null })).toBe("/my#saved");
  });
});
