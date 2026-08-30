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
  it("keeps allowlisted admin search on the login next path", () => {
    expect(
      withAllowlistedSearch("/admin/memes", { focus: "unsourced", q: "봄", status: "approved" }),
    ).toBe("/admin/memes?focus=unsourced&q=%EB%B4%84&status=approved");
    expect(
      withAllowlistedSearch("/admin/memes", { origin: "house_original", status: "pending" }),
    ).toBe("/admin/memes?status=pending&origin=house_original");
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
