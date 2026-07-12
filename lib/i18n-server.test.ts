import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, LOCALE_HEADER, SUPPORTED_LOCALES } from "@/lib/i18n";

const { headers } = vi.hoisted(() => ({
  headers: vi.fn<() => Promise<Headers>>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers }));

import { getRequestLocale } from "@/lib/i18n-server";

describe("getRequestLocale", () => {
  beforeEach(() => {
    headers.mockResolvedValue(new Headers());
  });

  it.each(SUPPORTED_LOCALES)("accepts the validated %s request locale", async (locale) => {
    headers.mockResolvedValue(new Headers([[LOCALE_HEADER, locale]]));

    await expect(getRequestLocale()).resolves.toBe(locale);
  });

  it.each([undefined, "", "fr", "EN", "en-US"])(
    "falls back for an untrusted request locale value (%s)",
    async (locale) => {
      headers.mockResolvedValue(
        new Headers(locale === undefined ? [] : [[LOCALE_HEADER, locale]]),
      );

      await expect(getRequestLocale()).resolves.toBe(DEFAULT_LOCALE);
    },
  );
});
