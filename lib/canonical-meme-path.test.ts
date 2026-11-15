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
    // The standalone server leaves the route param percent-encoded.
    expect(
      canonicalMemeRedirectPath(
        "a1b2c3-%ED%95%9C%EA%B5%AD%20%EB%B0%88",
        meme,
        "decoded",
      ),
    ).toBeNull();
  });

  it("redirects a short id to the canonical URL exactly once", () => {
    const meme = { shortId: "rk3w632x", slug: "중꺾마", locale: "ko" as const };
    const destination = canonicalMemeRedirectPath("rk3w632x", meme);
    expect(destination).toBe("/memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88");
    const key = destination?.slice(destination.lastIndexOf("/") + 1) ?? "";
    expect(canonicalMemeRedirectPath(key, meme, "encoded")).toBeNull();
    expect(canonicalMemeRedirectPath(key, meme, "decoded")).toBeNull();
    expect(canonicalMemeRedirectPath(decodeURIComponent(key), meme)).toBeNull();
  });

  it("redirects NFD, lowercase percent-encoding, and %2D to the NFC canonical URL", () => {
    const meme = { shortId: "a1b2c3", slug: "중꺾마".normalize("NFC"), locale: "ko" as const };
    const canonical = "/memes/a1b2c3-%EC%A4%91%EA%BA%BE%EB%A7%88";
    const encoded = "a1b2c3-%EC%A4%91%EA%BA%BE%EB%A7%88";

    expect(canonicalMemeRedirectPath(`a1b2c3-${"중꺾마".normalize("NFD")}`, meme)).toBe(canonical);
    expect(canonicalMemeRedirectPath(`a1b2c3-${"중꺾마".normalize("NFD")}`, meme, "encoded")).toBe(canonical);
    expect(canonicalMemeRedirectPath(encoded.toLowerCase(), meme, "encoded")).toBe(canonical);
    expect(canonicalMemeRedirectPath(encoded.toLowerCase(), meme)).toBe(canonical);
    expect(canonicalMemeRedirectPath(encoded, meme, "encoded")).toBeNull();
    expect(canonicalMemeRedirectPath(decodeURIComponent(encoded), meme)).toBeNull();

    const hyphen = { shortId: "a1b2c3", slug: "current", locale: "ko" as const };
    expect(canonicalMemeRedirectPath("a1b2c3%2Dcurrent", hyphen, "encoded")).toBe(
      "/memes/a1b2c3-current",
    );
    expect(canonicalMemeRedirectPath("a1b2c3-current", hyphen, "encoded")).toBeNull();
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
