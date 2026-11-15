import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "components/export-button.tsx"), "utf-8");

describe("ExportButton", () => {
  it("offers every template and format without a paid upgrade", () => {
    expect(source).not.toContain("/pricing");
    expect(source).not.toContain("billing_subscriptions");
    expect(source).not.toContain('qs.set("scale"');
  });

  it("passes the active reviewed SEO locale to the server export route", () => {
    expect(source).toContain("if (isSeoContentLocale(locale)) qs.set(\"locale\", locale);");
  });
});
