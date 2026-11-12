// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LocaleAutoDetect,
  LocaleDocumentSync,
  LocaleProvider,
  clearInPlaceLocale,
  persistLocale,
  useLocale,
} from "@/lib/i18n-client";
import { LOCALE_COOKIE } from "@/lib/i18n";

function LocaleProbe() {
  const { locale, messages } = useLocale();
  return (
    <>
      <header data-site-header="">{messages.home}</header>
      <nav data-site-bottom-nav="">{messages.mainNav}</nav>
      <output aria-label="active locale">{locale}</output>
    </>
  );
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
    clearInPlaceLocale();
    clearLocaleCookie();
    document.documentElement.lang = "ko";
    document.documentElement.dir = "ltr";
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
    clearInPlaceLocale();
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

  it("applies an in-place selector choice to header, bottom nav, and direction", async () => {
    setLocation("/explore");
    renderProvider();

    expect(screen.getByLabelText("active locale").textContent).toBe("ko");
    expect(document.querySelector("[data-site-header]")?.textContent).toBe("밈캐치 홈");
    expect(document.querySelector("[data-site-bottom-nav]")?.textContent).toBe("주 내비게이션");

    persistLocale("ar");

    await waitFor(() => {
      expect(screen.getByLabelText("active locale").textContent).toBe("ar");
    });
    expect(document.querySelector("[data-site-header]")?.textContent).toBe("الصفحة الرئيسية MemeCatch");
    expect(document.querySelector("[data-site-bottom-nav]")?.textContent).toBe("التنقل الرئيسي");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("lets the URL locale replace an in-place choice after navigation", async () => {
    setLocation("/");
    renderProvider();
    persistLocale("ar");
    await waitFor(() => {
      expect(document.documentElement.dir).toBe("rtl");
    });

    setLocation("/en");
    window.dispatchEvent(new Event("memecatch:locale-change"));

    await waitFor(() => {
      expect(screen.getByLabelText("active locale").textContent).toBe("en");
    });
    expect(document.querySelector("[data-site-header]")?.textContent).toBe("MemeCatch home");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
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
