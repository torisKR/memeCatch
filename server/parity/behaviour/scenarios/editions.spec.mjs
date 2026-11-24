// Batch B5, the translated editions' pages besides the home (home.spec.mjs):
// /{locale}/meme-cards, /{locale}/rankings and /{locale}/search, on
// ../pages/b2b-seed.sql and b5-seed.sql.
import { expect, open, recordGaEvents, test } from "../lib.mjs";

const reveal = (page) => page.locator("section").filter({ has: page.locator("#meme-card-reveal-title") });

test.describe("an edition's meme cards", () => {
  test("the gallery in English; choosing a card moves the address to /meme-cards", async ({ page }) => {
    await open(page, "/en/meme-cards");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scratch a meme. Collect your taste.");
    await expect(page.getByRole("heading", { name: "Browse cards" })).toBeVisible();
    await page.getByRole("button", { name: "Choose unrevealed card 3", exact: true }).click();
    await expect(page).toHaveURL(/\/meme-cards\?card=mc-\d{4}#reveal$/);
    // Next's copy turns Korean here (the address lost its prefix), Axum's
    // stays English (PLAN.md B5-4): only what both do is asserted.
    await expect(reveal(page).getByRole("heading", { level: 2 })).toBeVisible();
  });
});

test.describe("an edition's rankings", () => {
  test("the Korean board in another language's frame, right to left for Arabic", async ({ page }) => {
    await open(page, "/ar/rankings");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("밈캐치 내 급상승");
    await expect(page.getByRole("radio")).toHaveCount(3);
    await page.locator('label[for="rank-tab-week"]').click();
    await expect(page.locator("#rank-tab-week")).toBeChecked();
  });
});

test.describe("an edition's search", () => {
  const box = (page) => page.locator("#search-q");
  const summary = (page) => page.getByRole("region", { name: "Search results" }).locator("p").first();
  const gaEvents = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("ga-events") || "[]"));

  test("results in place, each card translated or the Korean original", async ({ page }) => {
    await recordGaEvents(page);
    await open(page, "/en/search");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search Korean memes");
    await expect(box(page)).toBeFocused();
    await expect(box(page)).toHaveAttribute("placeholder", "What meme are you looking for?");
    await expect(page.getByText("Popular searches")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trending now" })).toBeVisible();
    await page.evaluate(() => { window.stillHere = true; });

    await box(page).fill("카드");
    await expect(page).toHaveURL(/\/en\/search\?q=%EC%B9%B4%EB%93%9C$/);
    await expect(summary(page)).toHaveText(/^\d+ results for “카드”\.$/);
    const results = page.getByRole("region", { name: "Search results" });
    await expect(results.locator('a[href^="/en/memes/pgb2art1-"]')).toHaveCount(1);
    await expect(results.getByText("Korean original").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trending now" })).toHaveCount(0);
    await page.waitForTimeout(1300);

    // Korean results without a reviewed translation: the Korean explore.
    await box(page).fill("밈");
    await expect(page).toHaveURL(/\?q=%EB%B0%88$/);
    await expect(summary(page)).toHaveText("20 results for “밈”.");
    await expect(page.getByRole("link", { name: "Explore Korean originals" })).toHaveAttribute("href", "/explore");
    await page.waitForTimeout(1300);

    await box(page).fill("zzzqqq");
    const missing = page.getByRole("status").filter({ hasText: "We do not know this meme yet" });
    await expect(missing).toBeVisible();
    await expect(missing.getByRole("link", { name: "Submit “zzzqqq”" })).toHaveAttribute("href", "/submit?name=zzzqqq");
    await expect(page.getByRole("heading", { name: "Trending now" })).toBeVisible();
    await page.waitForTimeout(1300);

    await box(page).fill("");
    await expect(page).toHaveURL(/\/en\/search$/);
    expect(await page.evaluate(() => window.stillHere)).toBe(true);
    const events = (await gaEvents(page)).filter(([name]) => name.startsWith("search_"));
    expect(events).toEqual([
      ["search_submit", { result_count: 6 }],
      ["search_submit", { result_count: 20 }],
      ["search_submit", { result_count: 0 }],
      ["search_no_result", {}],
    ]);
  });

  test("recent terms in the edition's words; a suggestion opens the Korean page", async ({ page }) => {
    await open(page, "/ja/search");
    await box(page).fill("밈");
    await box(page).press("Enter");
    await expect(page).toHaveURL(/\/ja\/search\?q=%EB%B0%88$/);
    await box(page).fill("");
    await box(page).blur();
    await box(page).focus();
    await expect(page.getByText("最近の検索")).toBeVisible();
    await expect(page.getByRole("button", { name: "最近の検索を削除 '밈'" })).toBeVisible();

    await box(page).fill("밈");
    await box(page).blur();
    await box(page).focus();
    const options = page.getByRole("listbox", { name: "検索候補" }).getByRole("option");
    await expect(options).toHaveCount(6);
    await box(page).press("ArrowDown");
    await box(page).press("Enter");
    await expect(page).toHaveURL(/\/memes\/[a-zA-Z0-9]+-/);
    expect(new URL(page.url()).pathname.startsWith("/ja/")).toBe(false);
  });
});
