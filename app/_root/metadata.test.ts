import { afterEach, describe, expect, it, vi } from "vitest";
import { ROOT_VIEWPORT } from "./metadata";
import manifest from "../manifest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("publisher ownership", () => {
  it.each([undefined, "ca-pub-5744832247312120", "ca-pub-3004906966180197"])(
    "keeps the verified ads.txt publisher even when deployment configuration is %s",
    async (configured) => {
      vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", configured);
      vi.resetModules();
      const { SHARED_ROOT_METADATA } = await import("./metadata");
      expect(SHARED_ROOT_METADATA.verification?.other?.["google-adsense-account"])
        .toBe("ca-pub-3004906966180197");
    },
  );
});

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
