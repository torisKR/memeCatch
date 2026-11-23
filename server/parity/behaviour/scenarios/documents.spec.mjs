// Batch B1, the static documents. They have no form and no control of their
// own: what responds is the frame and the links. Each page is checked for the
// frame (menu, chat, language switch) and for what its own links do.
import { expect, focusRing, focused, open, test } from "../lib.mjs";

const PAGES = [
  ["/contact", "문의"],
  ["/editorial", "편집 원칙"],
  ["/guides", "밈캐치 가이드"],
  ["/guides/usage-signals", "사용 신호 네 가지를 읽는 법"],
  ["/privacy", "개인정보처리방침"],
  ["/terms", "이용약관"],
  ["/offline", "지금은 오프라인이에요"],
];

for (const [path, heading] of PAGES) {
  test.describe(`document ${path}`, () => {
    test("the page and its frame: heading, menu, chat and language switch", async ({ page }) => {
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);

      const menu = page.getByRole("button", { name: "메뉴", exact: true });
      await menu.click();
      await expect(page.getByRole("navigation", { name: "메뉴", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("navigation", { name: "메뉴", exact: true })).toHaveCount(0);
      expect(await focused(page)).toBe("button: 메뉴");
      expect(await focusRing(page)).toBe("solid 2px");

      await page.getByRole("button", { name: "밈캐치 챗봇 열기" }).click();
      await expect(page.getByRole("dialog", { name: "밈캐치에게 물어봐" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.getByRole("combobox", { name: "언어 선택" }).selectOption("ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
      // The document itself stays as it is, in Korean.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    });
  });
}

test("guides: the list opens an article, which links back to the list", async ({ page }) => {
  await open(page, "/guides");
  const links = page.getByRole("main").getByRole("link");
  await expect(links).toHaveCount(5);
  await links.filter({ hasText: "밈의 원본 출처를 찾고 판단하는 법" }).click();
  await expect(page).toHaveURL(/\/guides\/checking-meme-sources$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("밈의 원본 출처를 찾고 판단하는 법");
  // Outside sources open in a new tab, without the opener.
  const source = page.getByRole("main").locator('a[target="_blank"]').first();
  await expect(source).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("main").getByRole("link", { name: "가이드", exact: true }).click();
  await expect(page).toHaveURL(/\/guides$/);
});

test("contact: the address is a mail link, and the policy link goes to its page", async ({ page }) => {
  await open(page, "/contact");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "toris@toris.kr" })).toHaveAttribute("href", "mailto:toris@toris.kr");
  await main.getByRole("link", { name: "개인정보처리방침" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("개인정보처리방침");
});

test("offline: the retry link loads the home page", async ({ page }) => {
  await open(page, "/offline");
  const retry = page.getByRole("link", { name: "다시 시도하기" });
  await expect(retry).toHaveAttribute("href", "/");
  await retry.click();
  await expect(page).toHaveURL(/\/$/);
});

test("the missing-meme target answers 404", async ({ page }) => {
  const response = await page.goto("/missing-public-meme");
  expect(response?.status()).toBe(404);
});
