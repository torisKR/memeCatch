import { describe, expect, it } from "vitest";
import { safeNext, withAllowlistedSearch } from "./safe-redirect";

describe("safeNext", () => {
  it("preserves same-origin relative destinations", () => {
    expect(safeNext("/explore?sort=recent#top")).toBe(
      "/explore?sort=recent#top",
    );
  });

  it.each([
    "https://evil.example/phishing",
    "//evil.example/phishing",
    "/\\evil.example/phishing",
    "/%5Cevil.example/phishing",
    "/%2F%2Fevil.example/phishing",
    "/%2e%2e//evil.example/phishing",
    "/%",
  ])("rejects cross-origin or encoded redirect %s", (value) => {
    expect(safeNext(value)).toBe("/");
  });

  it.each([
    "/login",
    "/login?next=%2Flogin",
    "/auth/callback",
    "/auth/tiktok",
    "/forgot-password",
    "/reset-password",
  ])("sends the user home instead of back into auth at %s", (value) => {
    // 헤더 로그인 버튼이 현재 경로를 next에 담아 /login에서 next=/login이
    // 만들어진다. 로그인 후 다시 로그인 화면으로 돌아가면 안 된다.
    expect(safeNext(value)).toBe("/");
  });

  it("keeps destinations that merely start with an auth-route prefix", () => {
    expect(safeNext("/loginner")).toBe("/loginner");
    expect(safeNext("/authors")).toBe("/authors");
  });

  it("rejects non-string and control-character input", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext({})).toBe("/");
    expect(safeNext("/explore\nhttps://evil.example")).toBe("/");
  });
});

describe("withAllowlistedSearch", () => {
  it("keeps a bounded submission name without carrying private or admin filters", () => {
    const name = "zzqxv7239 & 회귀테스트";
    const result = withAllowlistedSearch("/submit", {
      name,
      email: "private@example.com",
      q: "admin query",
    });
    expect(result).toBe(`/submit?${new URLSearchParams({ name })}`);
    expect(safeNext(result)).toBe(result);
    expect(withAllowlistedSearch("/admin/memes", { name })).toBe("/admin/memes");
  });

  it.each([
    { name: ["first", "second"] },
    { name: "x".repeat(101) },
    { name: "unsafe\nname" },
    { name: "" },
  ])("drops an invalid or duplicated submission name: %j", (search) => {
    expect(withAllowlistedSearch("/submit", search)).toBe("/submit");
  });

  it("keeps allowlisted admin search on the login next path", () => {
    expect(
      withAllowlistedSearch("/admin/memes", { focus: "unsourced", q: "봄", status: "approved" }),
    ).toBe("/admin/memes?focus=unsourced&q=%EB%B4%84&status=approved");
    expect(
      withAllowlistedSearch("/admin/memes", { origin: "house_original", status: "pending" }),
    ).toBe("/admin/memes?status=pending&origin=house_original");
  });

  it("keeps only one valid source-recovery meme UUID and normalizes it", () => {
    expect(
      withAllowlistedSearch("/admin/sources", {
        memeId: "A0000000-0000-4000-8000-00000000000F",
        page: "3",
        q: "must-not-cross-routes",
      }),
    ).toBe("/admin/sources?memeId=a0000000-0000-4000-8000-00000000000f");
    expect(
      withAllowlistedSearch("/admin/memes", {
        memeId: "a0000000-0000-4000-8000-00000000000f",
      }),
    ).toBe("/admin/memes");
  });

  it("keeps only one valid creator-product edit UUID", () => {
    expect(
      withAllowlistedSearch("/products/new", {
        edit: "A0000000-0000-4000-8000-00000000000F",
        email: "private@example.com",
      }),
    ).toBe("/products/new?edit=a0000000-0000-4000-8000-00000000000f");
    expect(
      withAllowlistedSearch("/products/mine", {
        edit: "a0000000-0000-4000-8000-00000000000f",
      }),
    ).toBe("/products/mine");
  });

  it.each([
    { edit: "not-a-uuid" },
    { edit: "" },
    { edit: ["a0000000-0000-4000-8000-00000000000f", "b0000000-0000-4000-8000-00000000000e"] },
  ])("drops invalid or duplicated product edit targeting: %j", (search) => {
    expect(withAllowlistedSearch("/products/new", search)).toBe("/products/new");
  });

  it.each([
    { memeId: "not-a-uuid" },
    { memeId: "" },
    { memeId: ["a0000000-0000-4000-8000-00000000000f", "b0000000-0000-4000-8000-00000000000e"] },
  ])("drops invalid or duplicated source-recovery targeting: %j", (search) => {
    expect(withAllowlistedSearch("/admin/sources", search)).toBe("/admin/sources");
  });

  it("drops unknown keys, duplicates, and invalid values", () => {
    expect(
      withAllowlistedSearch("/admin/memes", {
        focus: "unsourced",
        email: "private@example.com",
        status: "machine",
        q: "",
      }),
    ).toBe("/admin/memes?focus=unsourced");
    expect(
      withAllowlistedSearch("/admin/memes", new URLSearchParams("focus=unsourced&focus=other")),
    ).toBe("/admin/memes");
  });
});
