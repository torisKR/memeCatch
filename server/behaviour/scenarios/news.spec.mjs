// Batch B2, /news (components/news-page-content.tsx) on seeds/b2b-seed.sql:
// the 20s and 40s have vote highlights, the 30s too few for a listing.
import { expect, open, recordGaEvents, test } from "../lib.mjs";

const group = (page, age) => page.locator(`section#age-${age}`);

test.describe("the generation news", () => {
  test("the age links jump to their section", async ({ page }) => {
    await open(page, "/news");
    await page.getByRole("navigation", { name: "연령대 바로가기" }).getByRole("link", { name: "40대" }).click();
    await expect(page).toHaveURL(/\/news#age-40s$/);
    await expect(group(page, "40s").getByRole("heading", { level: 2 })).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/\/news$/);
  });

  test("the highlights show their votes, the 30s none, and a card followed is reported", async ({ page }) => {
    await recordGaEvents(page);
    await open(page, "/news");
    await expect(group(page, "20s").getByText(/^인지·사용 \d+표$/)).toHaveText(["인지·사용 5표", "인지·사용 4표", "인지·사용 3표"]);
    await expect(group(page, "40s").getByText(/^인지·사용 \d+표$/)).toHaveText(["인지·사용 3표", "인지·사용 3표", "인지·사용 2표"]);
    await expect(group(page, "30s").getByText(/표$/)).toHaveCount(0);
    await expect(group(page, "30s").getByRole("heading", { name: "30대가 알아요·써요 한 밈" })).toHaveCount(0);

    const card = group(page, "20s").locator("a[data-meme-card]").first();
    const href = await card.getAttribute("href");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ga-events") || "[]"));
    expect(events.filter(([name]) => name === "generation_news_click")).toEqual([["generation_news_click", { to: href }]]);
  });

  test("each brief links its source in a new tab", async ({ page }) => {
    await open(page, "/news");
    const sources = page.locator("article a[target=_blank]");
    await expect(sources).toHaveCount(9);
    for (const link of await sources.all()) {
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect(link).toHaveAttribute("href", /^https:\/\//);
    }
  });
});
