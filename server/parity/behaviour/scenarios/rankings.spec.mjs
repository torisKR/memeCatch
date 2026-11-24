// Batch B2, /rankings (app/rankings/page.tsx): the three tabs are radio
// inputs and CSS, no script; the seed gives the live board.
import { expect, open, test } from "../lib.mjs";

const tab = (page, name) => page.getByRole("region", { name, exact: true });

test.describe("the rankings", () => {
  test("the tabs show one board at a time", async ({ page }) => {
    await open(page, "/rankings");
    await expect(tab(page, "오늘의 급상승")).toBeVisible();
    await expect(tab(page, "이번 주 많이 본")).toBeHidden();
    await expect(tab(page, "오늘의 급상승").getByRole("listitem")).toHaveCount(20);

    await page.locator('label[for="rank-tab-week"]').click();
    await expect(tab(page, "이번 주 많이 본")).toBeVisible();
    await expect(tab(page, "오늘의 급상승")).toBeHidden();
    await expect(tab(page, "이번 주 많이 본")).toContainText("이번 주 조회 집계가 아직 없어요. 내일 다시 확인해 보세요.");

    await page.locator('label[for="rank-tab-again"]').click();
    await expect(tab(page, "다시 뜨는")).toBeVisible();
    await expect(tab(page, "다시 뜨는").getByRole("listitem").first()).toContainText("1위");
    // The radio group takes arrow keys too.
    await page.locator("#rank-tab-again").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "이번 주 많이 본")).toBeVisible();
  });

  test("an entry opens its meme", async ({ page }) => {
    await open(page, "/rankings");
    const first = tab(page, "오늘의 급상승").getByRole("link").first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });
});
