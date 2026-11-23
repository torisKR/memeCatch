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
  ["/originals", "우리가 직접 만든 밈을 한곳에서"],
  ["/memes", "밈 전체 목록"],
  ["/collections", "흩어진 밈을,맥락별로 모았습니다."],
  ["/collections/challenge", "챌린지 모음"],
  ["/weekly", /^\d{4}년 \d{1,2}월 \d주차 밈 결산$/],
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

test("retired products: a 410 page of its own, whose cards open their meme pages", async ({ page }) => {
  const response = await page.goto("/products/old-item", { waitUntil: "load" });
  expect(response?.status()).toBe(410);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("밈상품 페이지는 더 이상 운영하지 않아요.");
  // Not the site frame: no menu, no chat.
  await expect(page.getByRole("button", { name: "메뉴", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "밈캐치 챗봇 열기" })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "밈 탐색" })).toHaveAttribute("href", "/explore");
  const cards = page.getByRole("region", { name: "지금 많이 보는 밈" }).getByRole("link");
  await expect(cards).toHaveCount(4);
  const href = await cards.first().getAttribute("href");
  expect(href).toMatch(/^\/memes\//);
  await cards.first().click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test("retired products in English: the English copy and home", async ({ page, isMobile }) => {
  const response = await page.goto("/en/retired-products", { waitUntil: "load" });
  expect(response?.status()).toBe(410);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "MemeCatch home" })).toHaveAttribute("href", "/en");
  // The bottom navigation exists at phone width only.
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  if (isMobile) await expect(nav.getByRole("link")).toHaveText(["Home", "Latest", "Community", "Submit", "My"]);
  else await expect(nav).toBeHidden();
});

test("originals: each edition in the list opens its page", async ({ page }) => {
  await open(page, "/originals");
  const editions = page.getByRole("main").getByRole("link");
  await expect(editions).toHaveCount(3);
  await editions.filter({ hasText: "퇴근 5분 전" }).click();
  await expect(page).toHaveURL(/\/originals\/edition\/five-minutes-to-go$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("퇴근 5분 전");
});

test.describe("an original edition", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies its link, saves a captioned card, and links on to the next edition", async ({ page, baseURL }) => {
    await open(page, "/originals/edition/monday-loading");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("월요일, 아직 로딩 중");
    const status = page.getByRole("status").filter({ hasText: "PNG" });
    await expect(status).toHaveText("한국어 원문 캡션과 출처가 포함된 PNG로 저장됩니다.");

    await page.getByRole("button", { name: "작품 링크 복사" }).click();
    await expect(page.getByRole("button", { name: "링크 복사됨" })).toBeVisible();
    // The site's own address, whichever server answered.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/originals\/edition\/monday-loading$/);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "문구 포함 카드 저장" }).click();
    expect((await download).suggestedFilename()).toBe("memecatch-monday-loading-meme-card.png");
    await expect(page.getByRole("status").filter({ hasText: "밈 카드 PNG를 저장했어요." })).toBeVisible();

    await expect(page.getByRole("link", { name: /그림만 저장/ })).toHaveAttribute("href", "/images/originals/monday-loading.png");
    await page.getByRole("link", { name: /다음 오리지널/ }).click();
    await expect(page).toHaveURL(/\/originals\/edition\/five-minutes-to-go$/);
  });
});
