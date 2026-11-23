// Batch B2, the list and exploration pages: what their own controls and
// links do. The frame of each is checked in documents.spec.mjs.
import { expect, open, test } from "../lib.mjs";

test.describe("the meme directory", () => {
  test("pages through the list in order and opens a meme", async ({ page }) => {
    await open(page, "/memes");
    // The numbered list (Next's main also holds the pagination list).
    await expect(page.locator("main ol").getByRole("listitem")).toHaveCount(100);
    await expect(page.getByRole("navigation", { name: "목록 페이지" }).locator('[aria-current="page"]')).toHaveText("1");
    await expect(page.getByRole("link", { name: "← 이전 쪽" })).toHaveCount(0);
    await expect(page.locator("main ol")).toHaveAttribute("start", "1");

    await page.getByRole("link", { name: "다음 쪽 →" }).click();
    await expect(page).toHaveURL(/\/memes\?page=2$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("2쪽");
    await expect(page.locator("main ol")).toHaveAttribute("start", "101");
    await expect(page.getByRole("navigation", { name: "목록 페이지" }).locator('[aria-current="page"]')).toHaveText("2");

    // A page number goes straight to that page; the previous link back.
    await page.getByRole("navigation", { name: "목록 페이지" }).getByRole("link", { name: "5", exact: true }).click();
    await expect(page).toHaveURL(/\/memes\?page=5$/);
    await page.getByRole("link", { name: "← 이전 쪽" }).click();
    await expect(page).toHaveURL(/\/memes\?page=4$/);

    const entry = page.locator("main ol").getByRole("listitem").first().getByRole("link");
    const title = (await entry.textContent()).trim();
    await entry.click();
    await expect(page).toHaveURL(/\/memes\/[a-z0-9]{8}-/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  });
});
