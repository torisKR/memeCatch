import { expect, test, type Page } from "@playwright/test";

const MEMES = [
  "/memes/kh75j5f8-%EA%BC%B0%EB%8C%80",
  "/memes/bjk2021k-bun-jo-ka",
  "/memes/t4n9can6-%EB%82%B4-%EB%A7%88%EC%9D%8C%EC%86%8D%EC%97%90-%EC%A0%80%EC%9E%A5",
] as const;

const KKONDAE = MEMES[0];

async function scrollEveryFold(page: Page) {
  const folds = await page.evaluate(() => {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const step = Math.max(window.innerHeight - 48, 240);
    const points = [0];
    for (let y = step; y < height; y += step) points.push(y);
    points.push(height);
    return points;
  });

  for (const y of folds) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(150);
    await expect(page.locator("header")).toContainText("밈캐치");
    await expect(page.locator("header")).toContainText("로그인");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  }
}

for (const width of [390, 1280]) {
  test(`fresh ko-KR scroll keeps Korean chrome at ${width}`, async ({ page, context }) => {
    const leaked: string[] = [];
    page.on("response", (response) => {
      const setCookie = response.headers()["set-cookie"] ?? "";
      if (setCookie.includes("memecatch_locale")) {
        leaked.push(`${response.status()} ${response.url()}`);
      }
    });

    await context.clearCookies();
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.setExtraHTTPHeaders({ "accept-language": "ko-KR,ko;q=0.9" });

    for (const path of MEMES) {
      await page.goto(path, { waitUntil: "networkidle" });
      await scrollEveryFold(page);
      const cookies = await context.cookies();
      expect(cookies.find((cookie) => cookie.name === "memecatch_locale")).toBeUndefined();
      await expect(page.locator("header select")).toHaveValue("ko");
    }

    expect(leaked).toEqual([]);
  });

  test(`꼰대 has a single unprefixed Plus link at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(KKONDAE, { waitUntil: "networkidle" });
    const cta = page.locator("[data-plus-pricing-cta]");
    await expect(cta).toHaveAttribute("href", "/pricing");
    await expect(cta).toHaveCount(1);
    await expect(page.locator("#global-translation-title")).toHaveCount(0);
    await expect(page.getByText("이 밈을 다른 언어로 먼저 받아보세요")).toHaveCount(0);
    await expect(page.locator('a[href="/en/pricing"], a[href="/ja/pricing"], a[href="/zh/pricing"], a[href="/zh-tw/pricing"]')).toHaveCount(0);
    await cta.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `e2e/screenshots/kkondae-${width}.png`,
      fullPage: true,
    });
  });
}
