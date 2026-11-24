// What a page does on its own when it loads: the visit and attribution
// records, the meme view, and the install prompt on an iPhone.
import { MEME, expect, focused, localStorageItem, mobileOnly, open, requestsDuring, sessionStorageItem, test } from "../lib.mjs";

const events = (requests) => requests.filter((request) => request.path === "/api/analytics/events").map((request) => request.body);

test("the first page of a session reports where the visitor came from, once", async ({ page }) => {
  const first = await requestsDuring(page, () => open(page, "/about?utm_source=kakao&utm_medium=social&utm_campaign=spring"));
  expect(events(first)).toEqual([
    {
      eventName: "traffic_source",
      path: "/about",
      params: expect.objectContaining({
        source: "kakao",
        medium: "social",
        campaign: "spring",
        first_source: "kakao",
        landing_page: "/about",
        is_returning: "false",
      }),
    },
  ]);
  expect(JSON.parse(await localStorageItem(page, "mc:attr:first"))).toMatchObject({ source: "kakao", medium: "social", ts: expect.any(Number) });
  expect(JSON.parse(await sessionStorageItem(page, "mc:attr:session"))).toMatchObject({ source: "kakao", medium: "social" });

  const second = await requestsDuring(page, () => open(page, "/about"));
  expect(events(second)).toEqual([]);
  expect(JSON.parse(await localStorageItem(page, "mc:attr:first"))).toMatchObject({ source: "kakao" });
});

test("a direct visit is recorded as direct", async ({ page }) => {
  const requests = await requestsDuring(page, () => open(page, "/about"));
  expect(events(requests).map((event) => [event.eventName, event.params.source, event.params.medium])).toEqual([
    ["traffic_source", "(direct)", "(none)"],
  ]);
});

test("a meme page counts its view and remembers the meme as recently seen", async ({ page }) => {
  const requests = await requestsDuring(page, () => open(page, MEME.path));
  expect(requests).toContainEqual(expect.objectContaining({ method: "POST", path: "/api/memes/view", body: { memeId: MEME.id } }));
  expect(events(requests)).toContainEqual({ eventName: "meme_view", path: MEME.path, params: { meme_id: MEME.id } });
  expect(JSON.parse(await localStorageItem(page, "mc_recent_memes"))).toEqual([MEME.id]);
});

test.describe("install prompt on an iPhone", () => {
  test.use({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });

  for (const path of ["/about", MEME.path]) {
    test(`on ${path}: offered from the second visit, explains the steps in a modal sheet, and stays dismissed`, async ({ page, isMobile }) => {
      mobileOnly(isMobile);
      // One earlier visit, recorded before this session began.
      await page.addInitScript(() => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem("mc:visits", "1");
        }
      });
      await open(page, path);
      expect(await localStorageItem(page, "mc:visits")).toBe("2");
      expect(await sessionStorageItem(page, "mc:visit-counted")).toBe("1");
      const banner = page.getByRole("region", { name: "앱 설치 안내" });
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("밈캐치를 홈 화면에");
      // The banner takes the chat launcher's place.
      await expect(page.getByRole("button", { name: "밈캐치 챗봇 열기" })).toHaveCount(0);

      await banner.getByRole("button", { name: "방법 보기" }).click();
      const sheet = page.getByRole("dialog", { name: "홈 화면에 추가하는 방법" });
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute("aria-modal", "true");
      await expect(sheet.getByRole("listitem")).toHaveCount(3);
      for (let press = 0; press < 4; press += 1) {
        await page.keyboard.press("Tab");
        expect(await focused(page)).toBe("button: 확인했어요");
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect.poll(() => focused(page)).toBe("button: 방법 보기");
      await expect(banner).toBeVisible();

      await banner.getByRole("button", { name: "설치 안내 닫기" }).click();
      await expect(banner).toHaveCount(0);
      expect(Number(await localStorageItem(page, "mc:install-dismissed-at"))).toBeGreaterThan(1_700_000_000_000);
      await expect(page.getByRole("button", { name: "밈캐치 챗봇 열기" })).toBeVisible();

      // Not counted twice in one session, and not offered again.
      await open(page, path);
      expect(await localStorageItem(page, "mc:visits")).toBe("2");
      await expect(page.getByRole("region", { name: "앱 설치 안내" })).toHaveCount(0);
    });
  }
});
