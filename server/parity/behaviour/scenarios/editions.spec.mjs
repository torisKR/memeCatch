// Batch B5, the translated editions' pages besides the home (home.spec.mjs):
// /{locale}/meme-cards and /{locale}/rankings, on ../pages/b2b-seed.sql.
import { expect, open, test } from "../lib.mjs";

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
