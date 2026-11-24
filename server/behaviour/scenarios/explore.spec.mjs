// Batch B2, /explore (components/explore-filters.tsx, components/explore-grid.tsx)
// on seeds/b2-seed.sql and the 3,562 memes of directory-catalog.mjs.
import { expect, focused, open, requestsDuring, test } from "../lib.mjs";

const cards = (page) => page.locator('section[aria-label="밈 탐색 결과"] ul:not([aria-hidden]) > li');
const toEnd = (page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
// Next reads the next window through /api/db/query, Axum through a fragment.
const NEXT_WINDOW = /\/(api\/db\/query|_axum\/explore\/more)/;

test.describe("the explore grid", () => {
  test("adds two windows as its end nears, then on a button", async ({ page }) => {
    await open(page, "/explore");
    await expect(cards(page)).toHaveCount(24);
    const checks = await requestsDuring(page, async () => {
      await toEnd(page);
      await expect(cards(page)).toHaveCount(48);
    }, { settle: 300 });
    const previews = checks.filter((request) => request.path === "/api/explore/previews");
    expect(previews.length).toBeGreaterThanOrEqual(1);
    expect(previews[0].method).toBe("POST");
    expect(previews[0].body.ids).toHaveLength(24);

    await toEnd(page);
    await expect(cards(page)).toHaveCount(72);
    await toEnd(page);
    const more = page.getByRole("button", { name: "밈 더 보기" });
    await expect(more).toBeVisible();
    await page.waitForTimeout(500);
    await expect(cards(page)).toHaveCount(72);
    await more.click();
    await expect(cards(page)).toHaveCount(96);
    // Every card once.
    const hrefs = await cards(page).locator("a[data-meme-card]").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(new Set(hrefs).size).toBe(96);
  });

  test("says when a window does not load, and tries again", async ({ page }) => {
    await open(page, "/explore");
    await page.route(NEXT_WINDOW, (route) => route.fulfill({ status: 503, body: "" }));
    await toEnd(page);
    const alert = page.getByRole("region", { name: "밈 탐색 결과" }).getByRole("alert");
    await expect(alert).toContainText("더 불러오지 못했어요.");
    await page.unroute(NEXT_WINDOW);
    await alert.getByRole("button", { name: "다시 시도" }).click();
    await expect(cards(page)).toHaveCount(48);
    await expect(alert).toHaveCount(0);
  });

  test("keeps the cards when their previews are not checked, and checks them again", async ({ page }) => {
    await open(page, "/explore");
    await page.route("**/api/explore/previews", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"previews unavailable"}' }));
    await toEnd(page);
    await expect(cards(page)).toHaveCount(48);
    const banner = page.getByRole("status").filter({ hasText: "일부 영상 미리보기를 불러오지 못했어요." });
    await expect(banner).toBeVisible();
    await page.unroute("**/api/explore/previews");
    const retry = await requestsDuring(page, async () => {
      await banner.getByRole("button", { name: "미리보기 다시 불러오기" }).click();
      await expect(banner).toHaveCount(0);
    });
    const check = retry.find((request) => request.path === "/api/explore/previews");
    expect(check.body.ids).toHaveLength(24);
    await expect(cards(page)).toHaveCount(48);
  });

  test("shows the end of a short list", async ({ page }) => {
    await open(page, "/explore?q=%EC%98%A4%ED%9E%88%EB%A0%A4");
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByText("끝까지 봤어요")).toBeVisible();
  });

  test("offers the submission form when nothing matches", async ({ page }) => {
    await open(page, "/explore?q=zzzznothing");
    await expect(page.getByText("조건에 맞는 밈이 아직 없어요")).toBeVisible();
    await expect(page.getByRole("link", { name: "밈 제보하기" })).toHaveAttribute("href", "/submit?name=zzzznothing");
    await page.getByRole("button", { name: "필터 초기화" }).click();
    await expect(page).toHaveURL(/\/explore\??$/);
    await expect(cards(page)).toHaveCount(24);
  });
});

test.describe("the explore filters", () => {
  test("filter in place, keeping the panel open and the focus", async ({ page }) => {
    await open(page, "/explore");
    await page.evaluate(() => { window.__samePage = true; });
    const toggle = page.getByRole("button", { name: "필터", exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const song = page.getByRole("button", { name: "노래", exact: true });
    await expect(song).toHaveAttribute("aria-pressed", "false");
    await song.click();
    await expect(page).toHaveURL(/\/explore\?category=song$/);
    await expect(page.getByRole("button", { name: "노래 필터 해제" })).toBeVisible();
    await expect(page.getByRole("button", { name: "필터 1" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "노래", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await focused(page)).toBe("button: 노래");
    expect(await page.evaluate(() => window.__samePage)).toBe(true);

    // AI 밈 stands alone; another category replaces it.
    await page.getByRole("button", { name: "AI 밈", exact: true }).click();
    await expect(page).toHaveURL(/\/explore\?category=ai-meme$/);
    await page.getByRole("button", { name: "드라마 장면", exact: true }).click();
    await expect(page).toHaveURL(/\/explore\?category=drama_scene$/);

    await page.getByRole("button", { name: "입문", exact: true }).click();
    await expect(page).toHaveURL(/\/explore\?category=drama_scene&difficulty=beginner$/);
    await page.getByRole("button", { name: "입문", exact: true }).click();
    await expect(page).toHaveURL(/\/explore\?category=drama_scene$/);

    await page.getByRole("button", { name: "드라마 장면 필터 해제" }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByRole("list", { name: "적용된 필터" })).toHaveCount(0);
    expect(await page.evaluate(() => window.__samePage)).toBe(true);
  });

  test("sort, source and reset", async ({ page }) => {
    await open(page, "/explore");
    const firstTitle = () => cards(page).first().locator("[data-meme-card-title]").getAttribute("title");
    const trending = await firstTitle();
    await page.getByLabel("정렬 방식").selectOption("recent");
    await expect(page).toHaveURL(/\/explore\?sort=recent$/);
    await expect(page.getByRole("button", { name: "초기화" })).toBeVisible();
    await page.getByLabel("원본 플랫폼").selectOption("youtube");
    await expect(page).toHaveURL(/\/explore\?sort=recent&platform=youtube$/);
    await expect(page.getByRole("button", { name: "YouTube 필터 해제" })).toBeVisible();
    await page.getByRole("button", { name: "초기화" }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByLabel("정렬 방식")).toHaveValue("trending");
    await expect(page.getByRole("button", { name: "초기화" })).toHaveCount(0);
    expect(await firstTitle()).toBe(trending);
  });

  test("search, clear, and the back button", async ({ page }) => {
    await open(page, "/explore");
    const box = page.getByRole("searchbox", { name: "밈 이름이나 뜻으로 검색" });
    await expect(page.getByRole("button", { name: "검색어 지우기" })).toHaveCount(0);
    await box.fill("  오히려 ");
    await expect(page.getByRole("button", { name: "검색어 지우기" })).toBeVisible();
    await box.press("Enter");
    await expect(page).toHaveURL(/\/explore\?q=%EC%98%A4%ED%9E%88%EB%A0%A4$/);
    await expect(box).toHaveValue("오히려");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first().locator("[data-meme-card-title]")).toHaveAttribute("title", "오히려 좋아");

    await page.getByRole("button", { name: "검색어 지우기" }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(box).toHaveValue("");
    await expect(cards(page)).toHaveCount(24);

    await page.goBack();
    await expect(page).toHaveURL(/\/explore\?q=/);
    await expect(box).toHaveValue("오히려");
    await expect(cards(page)).toHaveCount(1);
  });
});
