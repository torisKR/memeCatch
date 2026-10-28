import { describe, expect, it } from "vitest";
import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";

describe("canonical meme detail redirects", () => {
  it("does not redirect a double-encoded slug alias from an already-decoded page param", () => {
    const meme = { shortId: "a1b2c3", slug: "current", locale: "ko" as const };
    // Request %252D arrives in the page parameter as literal %2D, not a delimiter.
    expect(canonicalMemeRedirectPath("a1b2c3%2Dcurrent", meme)).toBeNull();
  });

  it("redirects only the stable short-id route to the encoded canonical path", () => {
    expect(
      canonicalMemeRedirectPath("a1b2c3", {
        shortId: "a1b2c3",
        slug: "한국 밈",
        locale: "ko",
      }),
    ).toBe("/memes/a1b2c3-%ED%95%9C%EA%B5%AD%20%EB%B0%88");
  });

  it("renders stale slug aliases so cached historical redirects cannot loop", () => {
    expect(
      canonicalMemeRedirectPath("a1b2c3-old-slug", {
        shortId: "a1b2c3",
        slug: "한국 밈",
        locale: "ko",
      }),
    ).toBeNull();
  });

  it("accepts raw and percent-encoded spaces and parentheses without redirect loops", () => {
    const meme = { shortId: "89b37mrx", slug: "새삭 챌린지 (지코)", locale: "ko" as const };

    expect(canonicalMemeRedirectPath("89b37mrx-새삭 챌린지 (지코)", meme)).toBeNull();
    expect(
      canonicalMemeRedirectPath(
        "89b37mrx-%EC%83%88%EC%82%A5%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%A7%80%EC%BD%94)",
        meme,
        "encoded",
      ),
    ).toBeNull();
    expect(
      canonicalMemeRedirectPath(
        "89b37mrx-%EC%83%88%EC%82%A5%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20%28%EC%A7%80%EC%BD%94%29",
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

  it("expands a localized short-id route and cannot create an external redirect", () => {
    expect(
      canonicalMemeRedirectPath("a1b2c3", {
        shortId: "a1b2c3",
        slug: "現在の名前",
        locale: "ja",
      }),
    ).toBe("/ja/memes/a1b2c3-%E7%8F%BE%E5%9C%A8%E3%81%AE%E5%90%8D%E5%89%8D");
    expect(
      canonicalMemeRedirectPath("a1b2c3", {
        shortId: "a1b2c3",
        slug: "//evil.example/steal",
        locale: "en",
      }),
    ).toBe("/en/memes/a1b2c3-%2F%2Fevil.example%2Fsteal");
  });

  it("renders malformed encoded slug aliases without redirecting", () => {
    expect(
      canonicalMemeRedirectPath("a1b2c3-%E0%A4%A", {
        shortId: "a1b2c3",
        slug: "current",
        locale: "en",
      }),
    ).toBeNull();
  });
});
