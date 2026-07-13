import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

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

  it("rejects non-string and control-character input", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext({})).toBe("/");
    expect(safeNext("/explore\nhttps://evil.example")).toBe("/");
  });
});
