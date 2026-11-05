import { describe, expect, it } from "vitest";
import { canonicalMemeRedirectPath, CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";

describe("canonical meme detail redirects", () => {
  it("maps known duplicate entries to their canonical authority shortId", () => {
    expect(CANONICAL_MEME_ALIAS_MAP["cssqxwmb"]).toBe("gnact78h");
    expect(CANONICAL_MEME_ALIAS_MAP["9ajbp6w6"]).toBe("gnact78h");
  });
  it("does not decode an already-decoded Next route parameter a second time", () => {
    const meme = { shortId: "a1b2c3", slug: "current", locale: "ko" as const };
    // Request %252D arrives in the page parameter as literal %2D, not a delimiter.
    expect(canonicalMemeRedirectPath("a1b2c3%2Dcurrent", meme)).toBe("/memes/a1b2c3-current");
  });
  it("redirects short-only and stale Korean aliases to the encoded canonical path", () => {
    expect(
      canonicalMemeRedirectPath("a1b2c3", {
        shortId: "a1b2c3",
        slug: "한국 밈",
        locale: "ko",
      }),
    ).toBe("/memes/a1b2c3-%ED%95%9C%EA%B5%AD%20%EB%B0%88");
    expect(
      canonicalMemeRedirectPath("a1b2c3-old-slug", {
        shortId: "a1b2c3",
        slug: "한국 밈",
        locale: "ko",
      }),
    ).toBe("/memes/a1b2c3-%ED%95%9C%EA%B5%AD%20%EB%B0%88");
  });

  it("accepts equivalent raw and percent-encoded Unicode keys without redirect loops", () => {
    const meme = { shortId: "a1b2c3", slug: "한국 밈", locale: "ko" as const };

    expect(canonicalMemeRedirectPath("a1b2c3-한국 밈", meme)).toBeNull();
    expect(
      canonicalMemeRedirectPath(
        "a1b2c3-%ED%95%9C%EA%B5%AD%20%EB%B0%88",
        meme,
        "encoded",
      ),
    ).toBeNull();
  });

  it("does not loop when a decoded canonical slug contains a literal percent sign", () => {
    const meme = { shortId: "a1b2c3", slug: "100% real", locale: "en" as const };

    expect(canonicalMemeRedirectPath("a1b2c3-100% real", meme)).toBeNull();
    expect(canonicalMemeRedirectPath("a1b2c3-100%25%20real", meme, "encoded")).toBeNull();
  });

  it("uses the current localized slug and cannot create an external redirect", () => {
    expect(
      canonicalMemeRedirectPath("a1b2c3-old", {
        shortId: "a1b2c3",
        slug: "現在の名前",
        locale: "ja",
      }),
    ).toBe("/ja/memes/a1b2c3-%E7%8F%BE%E5%9C%A8%E3%81%AE%E5%90%8D%E5%89%8D");
    expect(
      canonicalMemeRedirectPath("a1b2c3-anything", {
        shortId: "a1b2c3",
        slug: "//evil.example/steal",
        locale: "en",
      }),
    ).toBe("/en/memes/a1b2c3-%2F%2Fevil.example%2Fsteal");
  });

  it("redirects malformed encoded aliases to the stored canonical key", () => {
    expect(
      canonicalMemeRedirectPath("a1b2c3-%E0%A4%A", {
        shortId: "a1b2c3",
        slug: "current",
        locale: "en",
      }),
    ).toBe("/en/memes/a1b2c3-current");
  });
});
