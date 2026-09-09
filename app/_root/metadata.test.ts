import { describe, expect, it } from "vitest";
import { ROOT_VIEWPORT } from "./metadata";
import manifest from "../manifest";

describe("public theme chrome", () => {
  it("matches the system theme and uses the light default for the PWA splash", () => {
    expect(ROOT_VIEWPORT.colorScheme).toBe("light dark");
    expect(ROOT_VIEWPORT.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#fdfcfa" },
      { media: "(prefers-color-scheme: dark)", color: "#131316" },
    ]);
    expect(manifest().background_color).toBe("#fdfcfa");
  });
});
