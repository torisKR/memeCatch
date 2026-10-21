// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LocaleAutoDetect,
  LocaleDocumentSync,
  LocaleProvider,
  persistLocale,
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
    setLocation("/");
    persistLocale("ko");
    clearLocaleCookie();
  });

  it("lets the Korean detail URL replace a persisted English detail locale", () => {
    setLocation("/en/memes/english-detail");
    render(
      <LocaleProvider initialLocale="en">
        <LocaleDocumentSync />
        <LocaleProbe />
      </LocaleProvider>,
    );
    act(() => persistLocale("en"));
    cleanup();

    setLocation("/memes/korean-detail");
    renderProvider();

    expect(screen.getByLabelText("active locale").textContent).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");

    act(() => window.dispatchEvent(new Event("memecatch:locale-change")));

    expect(screen.getByLabelText("active locale").textContent).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("does not carry a same-route explicit locale into another Korean detail URL", () => {
    setLocation("/memes/first-detail");
    renderProvider();
    act(() => persistLocale("en"));
    expect(screen.getByLabelText("active locale").textContent).toBe("en");
    cleanup();

    setLocation("/memes/second-detail");
    renderProvider();

    expect(screen.getByLabelText("active locale").textContent).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("keeps an explicit locale selection active on the current Korean detail URL", () => {
    setLocation("/memes/current-detail");
    renderProvider();

    act(() => persistLocale("en"));

    expect(screen.getByLabelText("active locale").textContent).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps the selected locale when navigation reaches its prefixed detail URL", () => {
    setLocation("/memes/current-detail");
    renderProvider();
    act(() => persistLocale("en"));
    cleanup();

    setLocation("/en/memes/current-detail");
    render(
      <LocaleProvider initialLocale="en">
        <LocaleDocumentSync />
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByLabelText("active locale").textContent).toBe("en");
    expect(document.documentElement.lang).toBe("en");
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

  it.each(["/products", "/community"])(
    "preserves the preferred cookie locale on shared page %s",
    (path) => {
      setLocaleCookie("zh-tw");
      setLocation(path);

      renderProvider();

      expect(screen.getByLabelText("active locale").textContent).toBe("zh-tw");
    },
  );

  it("honors an explicit valid lang query on an unprefixed shared page", () => {
    setLocaleCookie("zh-tw");
    setLocation("/products?lang=ja");

    renderProvider();

    expect(screen.getByLabelText("active locale").textContent).toBe("ja");
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

  it("retains browser-locale auto-detection on shared unlocalized pages", async () => {
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
      expect(document.cookie).toContain(`${LOCALE_COOKIE}=zh-tw`);
    });
  });
});
