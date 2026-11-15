import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ContactPage from "@/app/(default)/contact/page";
import { CONTACT_EMAIL } from "@/lib/site";

describe("contact page", () => {
  it("publishes the existing address and the existing reply window", () => {
    const html = renderToStaticMarkup(<ContactPage />);
    expect(CONTACT_EMAIL).toBe("toris@toris.kr");
    expect(html).toContain(`mailto:${CONTACT_EMAIL}`);
    expect(html).toContain(CONTACT_EMAIL);
    expect(html).toContain("24~48시간");
    expect([...new Set(html.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi))]).toEqual([CONTACT_EMAIL]);
    expect(html).not.toContain("TODO");
  });

  it("does not invent a second channel in the page source", () => {
    const source = readFileSync(join(process.cwd(), "app/(default)/contact/page.tsx"), "utf8");
    expect(source).toContain("CONTACT_EMAIL");
    expect(source).not.toMatch(/@(?:example|gmail|naver)\./);
  });
});
