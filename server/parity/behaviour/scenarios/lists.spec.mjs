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

// The meme card (components/meme-card.tsx), on the lists of ../pages/b2-seed.sql.
// Nothing leaves the machine: the players and the video stills are answered here.
const TIKTOK_ERROR_PLAYER = `<!doctype html><script>
  parent.postMessage({ "x-tiktok-player": true, type: "onPlayerError", value: { errorCode: 1001, errorType: "INVALID_VIDEO" } }, "*");
</script>`;
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");

async function stubOutside(page, { tiktok = "<!doctype html><p>player</p>", stills = true } = {}) {
  await page.route("https://www.tiktok.com/**", (route) => route.fulfill({ contentType: "text/html", body: tiktok }));
  await page.route("https://www.instagram.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><p>player</p>" }));
  await page.route("https://i.ytimg.com/**", (route) => (stills ? route.fulfill({ contentType: "image/gif", body: PIXEL }) : route.abort()));
}

const card = (page, title) => page.locator("main li").filter({ has: page.locator(`[data-meme-card-title][title="${title}"]`) });

test.describe("the meme card", () => {
  test("opens its meme with the list as context", async ({ page }) => {
    await stubOutside(page);
    await open(page, "/collections/challenge");
    const link = card(page, "틱톡 챌린지 밈").getByRole("link");
    const href = new URL(await link.getAttribute("href"), page.url());
    expect(href.pathname).toBe("/memes/pgb2tik3-b2-pgb2tik3");
    expect(href.searchParams.get("ctx")).toBe("challenge");
    expect(href.searchParams.get("prev")).toBe("/memes/pgb2ytv2-b2-pgb2ytv2");
    expect(href.searchParams.get("next")).toBe("/memes/pgb2rel4-b2-pgb2rel4");
    expect(href.searchParams.get("i")).toBe("2");
    await link.click();
    await expect(page).toHaveURL(/\/memes\/pgb2tik3-b2-pgb2tik3\?ctx=challenge&/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("틱톡 챌린지 밈");
  });

  test("shows a video's still, and the poster when an image does not load", async ({ page }) => {
    await stubOutside(page, { stills: true });
    await open(page, "/collections/challenge");
    const still = card(page, "유튜브 영상 밈").locator("img");
    await expect(still).toHaveAttribute("src", "https://i.ytimg.com/vi/b2Video0001/hqdefault.jpg");
    expect(await still.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);

    // The owned card art of pgb2art1 is a file neither server has.
    await open(page, "/collections/beginner");
    const art = card(page, "그림 카드 밈");
    await expect(art.getByRole("img", { name: "그림 카드 밈 상징 일러스트" })).toHaveCount(0);
    await expect(art.locator('[data-meme-card-art="fallback"]')).toHaveCount(1);
    await expect(art.locator("[data-meme-card-bubble]")).toHaveCount(1);

    // A still that fails becomes the poster too.
    await page.unrouteAll();
    await stubOutside(page, { stills: false });
    await open(page, "/collections/challenge");
    await expect(card(page, "유튜브 영상 밈").locator('[data-meme-card-art="fallback"]')).toHaveCount(1);
  });

  test("plays one TikTok post in a dialog, and closes it with Escape or its button", async ({ page }) => {
    await stubOutside(page);
    await open(page, "/collections/challenge");
    // Only the card that names exactly one post has a player.
    await expect(page.getByRole("button", { name: /영상 미리보기$/ })).toHaveCount(2);
    const button = page.getByRole("button", { name: "틱톡 챌린지 밈 · TikTok 영상 미리보기" });
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await button.click();
    const dialog = page.getByRole("dialog", { name: "TikTok 공식 영상 미리보기" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("선택한 공식 플레이어에서 재생할 수 있어요.")).toBeVisible();
    const player = dialog.locator("iframe");
    await expect(player).toHaveAttribute("title", "틱톡 챌린지 밈 — TikTok 공식 영상 미리보기");
    await expect(player).toHaveAttribute("src", "https://www.tiktok.com/player/v1/7300000000000000001?description=1&music_info=1");
    const source = dialog.getByRole("link", { name: /TikTok에서 원본 열기/ });
    await expect(source).toHaveAttribute("href", "https://www.tiktok.com/@memecatch/video/7300000000000000001");
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.click();
    await page.getByRole("button", { name: "미리보기 닫기" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test("says when the TikTok player cannot play the post", async ({ page }) => {
    await stubOutside(page, { tiktok: TIKTOK_ERROR_PLAYER });
    await open(page, "/collections/challenge");
    await page.getByRole("button", { name: "틱톡 챌린지 밈 · TikTok 영상 미리보기" }).click();
    const dialog = page.getByRole("dialog", { name: "TikTok 공식 영상 미리보기" });
    await expect(dialog.getByRole("alert")).toHaveText("이 영상은 현재 재생할 수 없어요.");
    await expect(dialog.locator("iframe")).toHaveCount(0);
  });

  test("plays an Instagram reel, and a post only when it was verified as a video", async ({ page }) => {
    await stubOutside(page);
    await open(page, "/collections/challenge");
    await page.getByRole("button", { name: "인스타 릴스 밈 · Instagram 영상 미리보기" }).click();
    const dialog = page.getByRole("dialog", { name: "Instagram 공식 영상 미리보기" });
    await expect(dialog.locator("iframe")).toHaveAttribute("src", "https://www.instagram.com/reel/B2reelCode1/embed/captioned/");
    await page.keyboard.press("Escape");

    await open(page, "/collections/image");
    await expect(page.getByRole("button", { name: "인스타 게시물 밈 · Instagram 영상 미리보기" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /틱톡 두 개 밈/ })).toHaveCount(0);
    await page.getByRole("button", { name: "확인된 게시물 밈 · Instagram 영상 미리보기" }).click();
    await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute("src", "https://www.instagram.com/p/B2postCode6/embed/captioned/");
  });
});

// GA events (`gtag("event", ...)`) as the page pushes them, kept in
// sessionStorage so that they outlive the navigation a click causes.
async function recordGaEvents(page) {
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  await page.addInitScript(() => {
    let layer;
    Object.defineProperty(window, "dataLayer", {
      configurable: true,
      get: () => layer,
      set(value) {
        layer = value;
        const push = value.push.bind(value);
        value.push = (...items) => {
          for (const item of items) {
            const args = Array.from(item);
            if (args[0] !== "event") continue;
            const seen = JSON.parse(sessionStorage.getItem("ga-events") || "[]");
            sessionStorage.setItem("ga-events", JSON.stringify([...seen, args.slice(1)]));
          }
          return push(...items);
        };
      },
    });
  });
}

test.describe("the weekly digest", () => {
  test("shows this week's rails and reports the card followed", async ({ page }) => {
    await stubOutside(page);
    await recordGaEvents(page);
    await open(page, "/weekly");
    await expect(page.getByText("집계 중")).toBeVisible();
    const trending = page.locator("section").filter({ has: page.getByRole("heading", { name: "지금 가장 뜨거운 밈" }) });
    await expect(trending.getByRole("link")).toHaveCount(10);
    await expect(page.getByRole("heading", { name: "새로 등록된 밈" })).toBeVisible();
    // The category split is one bar per category with its share.
    await expect(page.getByRole("img", { name: /^phrase 비중 \d+%$/ })).toHaveCount(1);

    const first = trending.getByRole("link").first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[?]/g, "\\?")}$`));
    const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ga-events") || "[]"));
    expect(events.filter(([name]) => name === "weekly_click")).toEqual([["weekly_click", { to: href }]]);
  });
});

// The timeline (components/timeline-view.tsx), on b2-seed.sql: 37 year rows
// from 1990 to 2025, four in the document.
// The year labels shown, in order (a card's own year badge is inside its link).
const yearsShown = (page) => page.locator("main").getByText(/^(19|20)\d\d$/)
  .evaluateAll((nodes) => nodes.filter((node) => !node.closest("a")).map((node) => Number(node.textContent)));

test.describe("the timeline", () => {
  test("mounts four more years each time the end of the list comes near", async ({ page }) => {
    await stubOutside(page);
    await open(page, "/timeline");
    expect(await yearsShown(page)).toEqual([1990, 1991, 1992, 1993]);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["1990년대"]);
    // Each batch adds up to four years, never removes one.
    let seen = 4;
    for (let round = 0; round < 30 && seen < 37; round += 1) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(250);
      const now = (await yearsShown(page)).length;
      expect(now).toBeGreaterThanOrEqual(seen);
      expect(now - seen).toBeLessThanOrEqual(8);
      seen = now;
    }
    expect(seen).toBe(37);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["1990년대", "2000년대", "2010년대", "2020년대"]);
    const years = await yearsShown(page);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(new Set(years).size).toBe(37);
    expect(await page.locator("main [data-meme-card]").count()).toBeLessThanOrEqual(37 * 8);
  });

  test("opens on a decade from its address", async ({ page }) => {
    await stubOutside(page);
    await page.goto("/timeline#decade-2010s", { waitUntil: "load" });
    const heading = page.getByRole("heading", { name: "2010년대", level: 2 });
    await expect(heading).toBeInViewport();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["1990년대", "2000년대", "2010년대"]);
  });

  test("a decade tab mounts that decade and scrolls to it", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the decade tabs exist at phone width only");
    await stubOutside(page);
    await open(page, "/timeline");
    await page.getByRole("navigation", { name: "연대 바로가기" }).getByRole("link", { name: "2020년대" }).click();
    await expect(page).toHaveURL(/\/timeline#decade-2020s$/);
    await expect(page.getByRole("heading", { name: "2020년대", level: 2 })).toBeInViewport();
  });

  test("reports the card followed with its year and decade", async ({ page }) => {
    await stubOutside(page);
    await recordGaEvents(page);
    await open(page, "/timeline");
    const first = page.locator("main [data-meme-card]").first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const events = (await page.evaluate(() => JSON.parse(sessionStorage.getItem("ga-events") || "[]")))
      .filter(([name]) => name === "timeline_click");
    expect(events).toHaveLength(1);
    expect(events[0][1]).toMatchObject({ year: 1990, decade: "1990s" });
    expect(events[0][1].meme_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
