// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LocaleAutoDetect,
  LocaleDocumentSync,
  LocaleProvider,
  useLocale,
} from "@/lib/i18n-client";
import { LOCALE_COOKIE } from "@/lib/i18n";

function LocaleProbe() {
  const { locale } = useLocale();
  return <output aria-label="active locale">{locale}</output>;
}

function setLocation(path: string) {
  window.history.replaceState({}, "", path);
}

function setLocaleCookie(locale: string) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/`;
}

function clearLocaleCookie() {
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
}

function renderProvider() {
  return render(
    <LocaleProvider initialLocale="ko">
      <LocaleDocumentSync />
      <LocaleProbe />
    </LocaleProvider>,
  );
}

describe("LocaleProvider URL precedence", () => {
  beforeEach(() => {
    clearLocaleCookie();
    setLocation("/");
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ["en-US"],
    });
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "en-US",
    });
  });

  afterEach(() => {
    cleanup();
    clearLocaleCookie();
  });

  it.each(["/?lang=ko", "/", "/index"])(
    "keeps the canonical Korean root ahead of a stale zh-tw cookie at %s",
    (path) => {
      setLocaleCookie("zh-tw");
      setLocation(path);

      renderProvider();

      expect(screen.getByLabelText("active locale").textContent).toBe("ko");
      expect(document.documentElement.lang).toBe("ko");
    },
  );

  it.each([
    ["/en?lang=ko", "en"],
    ["/ja", "ja"],
    ["/zh", "zh"],
    ["/zh-tw", "zh-tw"],
  ] as const)("keeps locale prefix precedence for %s", (path, expected) => {
    setLocaleCookie("ko");
    setLocation(path);

    renderProvider();

    expect(screen.getByLabelText("active locale").textContent).toBe(expected);
  });

  it.each([
    "/products",
    "/community",
    "/memes/kh75j5f8-꼰대",
    "/explore",
    "/search",
  ])("ignores a stale zh-tw cookie on unprefixed %s", (path) => {
    setLocaleCookie("zh-tw");
    setLocation(path);

    render(
      <LocaleProvider initialLocale="ko">
        <LocaleDocumentSync />
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByLabelText("active locale").textContent).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("ignores a lang query on an unprefixed page", () => {
    setLocaleCookie("zh-tw");
    setLocation("/products?lang=ja");

    render(
      <LocaleProvider initialLocale="ko">
        <LocaleDocumentSync />
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByLabelText("active locale").textContent).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("does not let auto-detection overwrite an explicit Korean URL choice", async () => {
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ["zh-TW"],
    });
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-TW",
    });
    setLocation("/?lang=ko");

    render(<LocaleAutoDetect />);

    await waitFor(() => {
      expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=`);
    });
  });

  it("does not switch an unprefixed page to the browser language after load", async () => {
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ["zh-TW"],
    });
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-TW",
    });
    setLocation("/community");

    render(<LocaleAutoDetect />);

    await waitFor(() => {
      expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=`);
    });
  });
});
