// Batch B2, /global (components/global-feed/global-feed-tabs.tsx and
// components/meme-thumbnail.tsx) on seeds/b2b-seed.sql and b5-seed.sql.
// The YouTube stills are answered here; the verified covers are files
// neither server has.
import { expect, open, test } from "../lib.mjs";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
const tabs = (page) => page.getByRole("navigation", { name: "Choose a platform" });
const lead = (page) => page.locator("main article").first();

test.describe("the global feed", () => {
  test("switches platforms with its tabs", async ({ page }) => {
    await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ contentType: "image/gif", body: PIXEL }));
    await open(page, "/global");
    await expect(tabs(page).getByRole("link", { name: "YouTube" })).toHaveAttribute("aria-current", "page");
    await expect(lead(page).getByRole("heading", { level: 3 })).toHaveText("글로벌 밈 1");
    await expect(page.locator("main article")).toHaveCount(15);

    await tabs(page).getByRole("link", { name: "TikTok" }).click();
    await expect(page).toHaveURL(/\/global\?platform=tiktok$/);
    await expect(tabs(page).getByRole("link", { name: "TikTok" })).toHaveAttribute("aria-current", "page");
    await expect(tabs(page).getByRole("link", { name: "YouTube" })).not.toHaveAttribute("aria-current", "page");
    await expect(lead(page).getByRole("heading", { level: 3 })).toHaveText("글로벌 밈 53");
    await expect(lead(page).locator("[data-global-feed-platform]")).toHaveText("TikTok");
    // Eight global memes, then b5-seed.sql's TikTok meme: a reviewed origin
    // market of any country puts a meme in the feed.
    await expect(page.locator("main article")).toHaveCount(9);
    await expect(page.locator("main article").last().getByRole("heading", { level: 3 })).toHaveText("틱톡 챌린지 밈");

    await tabs(page).getByRole("link", { name: "Instagram" }).click();
    await expect(page).toHaveURL(/\/global\?platform=instagram$/);
    await expect(page.locator("main article")).toHaveCount(6);
    await page.goBack();
    await expect(page).toHaveURL(/\/global\?platform=tiktok$/);
    await expect(lead(page).getByRole("heading", { level: 3 })).toHaveText("글로벌 밈 53");
  });

  test("shows a title card for a thumbnail that does not load", async ({ page }) => {
    await page.route("https://i.ytimg.com/**", (route) => route.abort());
    await open(page, "/global");
    const frame = lead(page).locator(".aspect-\\[16\\/10\\]");
    await expect(frame.locator('[data-thumbnail-state="fallback"]')).toContainText("글로벌 밈 1");
    await expect(frame.locator("img")).toHaveCount(0);
    // A stored cover that is not there either.
    await open(page, "/global?platform=tiktok");
    await expect(lead(page).locator('[data-thumbnail-state="fallback"]')).toContainText("글로벌 밈 53");
  });

  test("opens the Korean page of an item", async ({ page }) => {
    await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ contentType: "image/gif", body: PIXEL }));
    await open(page, "/global");
    await expect(lead(page).getByText("Origin country: United States")).toHaveCount(1);
    await lead(page).getByRole("link").click();
    await expect(page).toHaveURL(/\/memes\/pggl0001-gl-pggl0001$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("글로벌 밈 1");
  });
});
