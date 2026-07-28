import { describe, expect, it } from "vitest";
import { SEO_ROUTE_LOCALES, localizePath } from "@/lib/i18n-routing";
import { SITE_URL } from "@/lib/site";
import robots from "@/app/robots";

function values(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function matchesRule(pathname: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}`).test(pathname);
}

describe("robots locale crawl policy", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const wildcard = rules.find((rule) => values(rule.userAgent).includes("*"));
  const allows = values(wildcard?.allow);
  const disallows = values(wildcard?.disallow);
  const isDisallowed = (pathname: string) =>
    disallows.some((pattern) => matchesRule(pathname, pattern));

  it("keeps every public locale root, explore page, and meme page crawlable", () => {
    expect(allows).toContain("/");

    for (const locale of SEO_ROUTE_LOCALES) {
      for (const pathname of [
        localizePath("/", locale),
        localizePath("/explore", locale),
        localizePath("/memes/abc-example", locale),
      ]) {
        expect(isDisallowed(pathname), pathname).toBe(false);
      }
    }
  });

  it("blocks private and non-content paths with or without a locale prefix", () => {
    const privatePaths = ["/admin", "/my", "/api/", "/go/", "/auth/"];

    for (const pathname of privatePaths) {
      expect(isDisallowed(pathname), pathname).toBe(true);
      for (const locale of SEO_ROUTE_LOCALES.filter((item) => item !== "ko")) {
        const localized = localizePath(pathname, locale);
        expect(isDisallowed(localized), localized).toBe(true);
      }
    }
  });

  it("advertises the single absolute sitemap URL", () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
