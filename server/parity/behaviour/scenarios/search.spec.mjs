// Batch B2, /search (app/(default)/search/search-input.tsx, components/search-suggest.tsx,
// components/meme-reference-search.tsx, components/search-outcome-tracker.tsx).
import { expect, localStorageItem, open, recordGaEvents, test } from "../lib.mjs";

const box = (page) => page.locator("#search-q");
const listbox = (page) => page.getByRole("listbox", { name: "자동완성 결과" });
const summary = (page) => page.getByRole("region", { name: "검색 결과" }).locator("p").first();
const gaEvents = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("ga-events") || "[]"));

test.describe("the search page", () => {
  test("what is typed becomes the address and the results, in place", async ({ page }) => {
    await open(page, "/search");
    await expect(box(page)).toBeFocused();
    await expect(page.getByText("인기 검색어")).toBeVisible();
    await page.evaluate(() => { window.stillHere = true; });

    await box(page).fill("밈");
    await expect(page).toHaveURL(/\/search\?q=%EB%B0%88$/);
    await expect(summary(page)).toHaveText("‘밈’ 검색 결과 20개예요.");
    await expect(page.getByRole("heading", { name: "테마로 시작해 볼까요?" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "상황·의미로 찾기" })).toBeDisabled();

    await box(page).fill("zzzqqq");
    await expect(page).toHaveURL(/\?q=zzzqqq$/);
    const missing = page.getByRole("status").filter({ hasText: "이 밈, 저희도 아직 몰라요" });
    await expect(missing).toBeVisible();
    await expect(missing.getByRole("link", { name: "‘zzzqqq’ 제보하기" })).toHaveAttribute("href", "/submit?name=zzzqqq");
    await expect(page.getByRole("heading", { name: "오늘의 급상승" })).toBeVisible();

    await box(page).fill("");
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole("heading", { name: "테마로 시작해 볼까요?" })).toBeVisible();
    expect(await page.evaluate(() => window.stillHere)).toBe(true);
  });

  test("the keys choose a suggestion, Enter opens it, Escape closes the list", async ({ page }) => {
    await open(page, "/search?q=%EB%B0%88");
    await expect(box(page)).toHaveValue("밈");
    await expect(box(page)).toHaveAttribute("aria-expanded", "false");
    await box(page).click();
    await expect(box(page)).toHaveAttribute("aria-expanded", "true");
    const options = listbox(page).getByRole("option");
    await expect(options).toHaveCount(6);
    await box(page).press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await box(page).press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
    await box(page).press("Escape");
    await expect(listbox(page)).toHaveCount(0);
    await expect(box(page)).toHaveAttribute("aria-expanded", "false");
    // Escape in a search field also empties it (the browser's own).
    await expect(box(page)).toHaveValue("");
    await expect(page).toHaveURL(/\/search$/);

    // Only a new focus opens the list again.
    await box(page).fill("밈");
    await expect(listbox(page)).toHaveCount(0);
    await box(page).blur();
    await box(page).focus();
    await expect(options).toHaveCount(6);
    await box(page).press("ArrowDown");
    const title = await options.first().locator("span span").first().textContent();
    await box(page).press("Enter");
    await expect(page).toHaveURL(/\/memes\/[a-zA-Z0-9]+-/);
    await expect(page.locator("h1")).toContainText(title.trim());
    expect(JSON.parse(await localStorageItem(page, "mc_recent_searches"))).toEqual(["밈"]);
  });

  test("a search is remembered; recent and popular terms search again", async ({ page }) => {
    await open(page, "/search");
    await box(page).fill("폼");
    await box(page).press("Enter");
    await expect(page).toHaveURL(/\?q=%ED%8F%BC$/);
    await box(page).fill("");
    await expect(page).toHaveURL(/\/search$/);
    // The submit closed the list; a new focus opens it.
    await box(page).blur();
    await box(page).focus();
    const recent = page.getByText("최근 검색어").locator("xpath=../..");
    await expect(recent.getByRole("button", { name: "폼", exact: true })).toBeVisible();

    const popular = page.getByText("인기 검색어").locator("xpath=..").getByRole("button").first();
    const term = (await popular.textContent()).trim();
    await popular.click();
    await expect(box(page)).toHaveValue(term);
    await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(term).replace(/[()]/g, "\\$&")}$`));
    expect(JSON.parse(await localStorageItem(page, "mc_recent_searches"))).toEqual([term, "폼"]);

    await box(page).fill("");
    await box(page).blur();
    await box(page).focus();
    await page.getByRole("button", { name: "최근 검색어 삭제 '폼'" }).click();
    expect(JSON.parse(await localStorageItem(page, "mc_recent_searches"))).toEqual([term]);
    await page.getByRole("button", { name: "전체 지우기" }).click();
    await expect(page.getByText("최근 검색어")).toHaveCount(0);
    expect(JSON.parse(await localStorageItem(page, "mc_recent_searches"))).toEqual([]);
  });

  test("a settled query is reported once, with its result count", async ({ page }) => {
    await recordGaEvents(page);
    await open(page, "/search?q=zzzqqq");
    await page.waitForTimeout(1300);
    await box(page).fill("밈");
    await expect(summary(page)).toBeVisible();
    await page.waitForTimeout(1300);
    const events = (await gaEvents(page)).filter(([name]) => name.startsWith("search_"));
    expect(events).toEqual([
      ["search_submit", { result_count: 0 }],
      ["search_no_result", {}],
      ["search_submit", { result_count: 20 }],
    ]);
  });

  test("the situation search shows references, and a second click cancels it", async ({ page }) => {
    await open(page, "/search?q=%EC%A4%91%EA%BA%BE%EB%A7%88");
    const section = page.getByRole("region", { name: "상황에 맞는 밈" });
    await section.getByRole("button", { name: "상황·의미로 찾기" }).click();
    await expect(section.getByRole("status")).toContainText("의미 검색이 준비되지 않아 이름·별칭 검색 결과를 보여드려요.");
    await expect(section.getByRole("link").first()).toHaveAttribute("href", /^\/memes\//);

    await page.route("**/api/memes/semantic-search", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({ status: 503, body: "" }).catch(() => {});
    });
    await section.getByRole("button", { name: "상황·의미로 찾기" }).click();
    await expect(section.getByRole("status")).toHaveText("참고할 밈을 찾고 있어요.");
    await section.getByRole("button", { name: "검색 취소" }).click();
    await expect(section.getByRole("status")).toHaveText("검색을 취소했어요.");
    await page.unroute("**/api/memes/semantic-search");
    await page.route("**/api/memes/semantic-search", (route) => route.fulfill({ status: 503, body: "" }));
    await section.getByRole("button", { name: "상황·의미로 찾기" }).click();
    await expect(section.getByRole("alert")).toHaveText("밈을 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
  });
});
