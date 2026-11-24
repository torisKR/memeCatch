// Batch B5, the translated editions' pages besides the home (home.spec.mjs):
// /{locale}/meme-cards, /{locale}/rankings and /{locale}/search, on
// seeds/b2b-seed.sql and b5-seed.sql.
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

// /{locale}/memes/{key}: the reviewed translation of a meme.
test.describe("an edition's meme document", () => {
  // Next's service worker would answer the page's fetches before page.route.
  test.use({ serviceWorkers: "block" });
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  test("its languages, the passport's translated variant, and a related translation", async ({ page }) => {
    await open(page, "/en/memes/pgpas006-parity-passport");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const languages = page.getByRole("navigation", { name: "Available languages" });
    await expect(languages.getByRole("link", { name: "Korean original" })).toHaveAttribute("href", "/memes/pgpas006-parity-passport");
    await expect(languages.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "page");
    await expect(languages.getByRole("link", { name: "日本語" })).toHaveAttribute("href", "/ja/memes/pgpas006-parity-passport-ja");
    await expect(page.getByRole("heading", { name: "What should I be careful about?" })).toBeVisible();
    const passport = page.getByRole("region", { name: "Where does this meme travel?" });
    await expect(passport.getByRole("link")).toHaveCount(1);
    await passport.getByRole("link", { name: /Edition rich/ }).click();
    await expect(page).toHaveURL(/\/en\/memes\/pgrich01-parity-rich-en$/);

    await open(page, "/en/memes/pgb2art1-pgb2art1-en");
    const related = page.getByRole("region", { name: "Related memes" });
    await expect(related.getByRole("link")).toHaveCount(3);
    await related.locator('a[href="/en/memes/pgb2g14e-pgb2g14e-en"]').click();
    await expect(page).toHaveURL(/\/en\/memes\/pgb2g14e-pgb2g14e-en$/);
    await expect(page.locator("h1")).toHaveText("Edition g14e");
  });

  test("saving asks to sign in, and the card export speaks the edition's language", async ({ page }) => {
    const asked = [];
    await page.route("**/memes/pgpas006/export?*", (route) => {
      asked.push(new URL(route.request().url()).search);
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    });
    await open(page, "/ja/memes/pgpas006-parity-passport-ja");
    await page.getByRole("button", { name: "このミームを保存" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "カード書き出し" }).click();
    const panel = page.getByRole("region", { name: "ミームカードとして保存" });
    const downloaded = page.waitForEvent("download");
    await panel.getByRole("button", { name: "ダウンロード" }).click();
    expect((await downloaded).suggestedFilename()).toBe("memecatch-pgpas006-classic-card.png");
    expect(asked).toEqual(["?template=classic&format=card&locale=ja"]);
  });

  test.describe("sharing", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("without a share sheet, the link is copied and said so", async ({ page, baseURL }) => {
      await page.addInitScript(() => { delete Navigator.prototype.share; });
      await open(page, "/en/memes/pgb2art1-pgb2art1-en");
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Link copied." })).toHaveCount(1);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        `${new URL(baseURL).origin}/en/memes/pgb2art1-pgb2art1-en?utm_source=share&utm_medium=link`,
      );
    });
  });

  test("a TikTok post's player stays, with the edition's words around it", async ({ page }) => {
    await page.route(/^https:\/\/www\.tiktok\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>player</title>" }));
    await page.route("**/api/oembed?*", (route) => route.fulfill({ status: 502, contentType: "application/json", body: "{}" }));
    await open(page, "/en/memes/pgb2tik3-pgb2tik3-en");
    await expect(page.getByText("If the video appears blank, open it directly on TikTok.")).toBeVisible();
    await expect(page.getByRole("link", { name: "View on TikTok" })).toBeVisible();
    const player = page.locator("figure").filter({ has: page.locator('iframe[src^="https://www.tiktok.com/player/v1/"]') });
    await expect(player).toHaveCount(1);
    await expect(player.getByRole("alert")).toHaveCount(0);
  });
});
