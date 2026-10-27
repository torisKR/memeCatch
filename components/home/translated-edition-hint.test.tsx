// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TranslatedEditionHint, preferredEditionLocale } from "./translated-edition-hint";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = "memecatch_locale=; Max-Age=0; Path=/";
});

describe("preferredEditionLocale", () => {
  it("prefers the saved locale cookie over browser languages", () => {
    expect(preferredEditionLocale("memecatch_locale=ja", ["en-US"])).toBe("ja");
  });

  it("uses the first browser language with a translated edition", () => {
    expect(preferredEditionLocale("", ["en-US", "ko-KR"])).toBe("en");
    expect(preferredEditionLocale("", ["zh-TW"])).toBe("zh-tw");
  });

  it("returns null for Korean readers and untranslated languages", () => {
    expect(preferredEditionLocale("", ["ko-KR", "en-US"])).toBeNull();
    expect(preferredEditionLocale("memecatch_locale=ko", ["en-US"])).toBeNull();
    expect(preferredEditionLocale("", ["fr-FR"])).toBeNull();
  });
});

describe("TranslatedEditionHint", () => {
  it("points an English browser to the English edition", async () => {
    vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
    await act(async () => {
      render(<TranslatedEditionHint />);
    });

    const link = screen.getByRole("link", { name: /English edition/ });
    expect(link.getAttribute("href")).toBe("/en");
    expect(link.getAttribute("hreflang")).toBe("en");
  });

  it("renders nothing for a Korean browser", async () => {
    vi.stubGlobal("navigator", { languages: ["ko-KR"], language: "ko-KR" });
    let container: HTMLElement | undefined;
    await act(async () => {
      container = render(<TranslatedEditionHint />).container;
    });
    expect(container?.innerHTML).toBe("");
  });
});
