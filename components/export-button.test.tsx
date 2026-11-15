import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportUpgradeHref } from "@/components/export-button";

const source = readFileSync(join(process.cwd(), "components/export-button.tsx"), "utf-8");

describe("exportUpgradeHref", () => {
  it("keeps locked export upgrades on a real localized price page", () => {
    expect(exportUpgradeHref("ko")).toBe("/pricing");
    expect(exportUpgradeHref("en")).toBe("/en/pricing");
    expect(exportUpgradeHref("ja")).toBe("/ja/pricing");
    expect(exportUpgradeHref("zh-tw")).toBe("/zh-tw/pricing");
  });

  it("passes the active reviewed SEO locale to the server export route", () => {
    expect(source).toContain("if (isSeoContentLocale(locale)) qs.set(\"locale\", locale);");
  });
});
