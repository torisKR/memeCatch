// The parts of the page frame that need no session: header menu, language
// switch, bottom navigation, scroll behaviour, search shortcut, footer and
// navigation progress. Run on a static page and on a meme page.
import { MEME, cookieValue, desktopOnly, expect, focusRing, focused, localStorageItem, mobileOnly, open, test } from "../lib.mjs";

const PAGES = ["/about", MEME.path];
const MENU = [
  ["밈카드", "/meme-cards"],
  ["글로벌 피드", "/global"],
  ["밈 스튜디오", "/studio"],
  ["연표", "/timeline"],
  ["밈캐치 내 급상승", "/rankings"],
  ["세대별 밈 소식", "/news"],
  ["아무 밈이나 보기", "/memes/random"],
];

for (const path of PAGES) {
  test.describe(`frame on ${path}`, () => {
    test("header menu: opens, lists its destinations, closes with Escape and returns focus", async ({ page }) => {
      await open(page, path);
      const button = page.getByRole("button", { name: "메뉴", exact: true });
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("navigation", { name: "메뉴", exact: true })).toHaveCount(0);

      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      const panel = page.getByRole("navigation", { name: "메뉴", exact: true });
      await expect(panel).toBeVisible();
      expect(await button.getAttribute("aria-controls")).toBe(await panel.getAttribute("id"));
      const links = panel.getByRole("link");
      await expect(links).toHaveText(MENU.map(([label]) => label));
      expect(await links.evaluateAll((items) => items.map((item) => item.getAttribute("href")))).toEqual(MENU.map(([, href]) => href));

      // Not a modal: Tab walks from the button into the list.
      await button.focus();
      await page.keyboard.press("Tab");
      expect(await focused(page)).toBe("a: 밈카드");

      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(button).toHaveAttribute("aria-expanded", "false");
      expect(await focused(page)).toBe("button: 메뉴");
      // Reached by keyboard, so the focus shows.
      expect(await focusRing(page)).toBe("solid 2px");
    });

    test("header menu: a press outside closes it, and a destination navigates", async ({ page }) => {
      await open(page, path);
      const button = page.getByRole("button", { name: "메뉴", exact: true });
      const panel = page.getByRole("navigation", { name: "메뉴", exact: true });
      await button.click();
      await expect(panel).toBeVisible();
      // A press on empty page margin, without scrolling the page to reach it.
      await page.mouse.click(4, 330);
      await expect(panel).toHaveCount(0);
      await expect(button).toHaveAttribute("aria-expanded", "false");

      await button.click();
      await panel.getByRole("link", { name: "연표" }).click();
      await expect(page).toHaveURL(/\/timeline$/);
      await expect(page.getByRole("navigation", { name: "메뉴", exact: true })).toHaveCount(0);
    });

    test("language switch: a language without its own URLs changes the frame in place", async ({ page, isMobile }) => {
      await open(page, path);
      const select = page.getByRole("combobox", { name: "언어 선택" });
      expect(await select.locator("option").evaluateAll((items) => items.map((item) => item.value))).toEqual([
        "ko", "en", "ja", "zh", "zh-tw", "th", "vi", "mn", "id", "ar", "ru", "es", "de", "fr", "it", "pt", "tr", "ms", "hi",
      ]);
      await expect(page.locator("html")).toHaveAttribute("lang", "ko");

      await select.selectOption("ar");
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "معلومات الموقع" }).getByRole("link", { name: "عن MemeCatch" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "اختر اللغة" })).toHaveValue("ar");
      if (isMobile) {
        await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link").first()).toHaveText("الرئيسية");
      }
      expect(new URL(page.url()).pathname).toBe(new URL(path, page.url()).pathname);
      expect(await cookieValue(page, "memecatch_locale")).toBe("ar");
      expect(await localStorageItem(page, "memecatch_locale")).toBe("ar");

      // The choice is for this document: the URL still says Korean.
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", "ko");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      // The header's link: the meme page's sign-in invite has one too once it
      // knows the visitor is a guest.
      await expect(page.getByRole("banner").getByRole("link", { name: "로그인", exact: true })).toBeVisible();
    });

    test("language switch: a language with its own URLs goes to its home", async ({ page }) => {
      await open(page, path);
      await page.getByRole("combobox", { name: "언어 선택" }).selectOption("ja");
      await expect(page).toHaveURL(/\/ja$/);
      expect(await cookieValue(page, "memecatch_locale")).toBe("ja");
      await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    });

    test("bottom navigation: five destinations on a phone, none on a desktop", async ({ page, isMobile }) => {
      await open(page, path);
      const nav = page.getByRole("navigation", { name: "주 내비게이션" });
      if (!isMobile) {
        await expect(nav).toBeHidden();
        return;
      }
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link")).toHaveText(["홈", "최신", "커뮤니티", "제보", "MY"]);
      expect(await nav.getByRole("link").evaluateAll((items) => items.map((item) => item.getAttribute("href")))).toEqual([
        "/", "/explore?sort=recent", "/community", "/submit", "/my",
      ]);
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
    });

    test("scrolling down on a phone puts the header and the bottom bar away, scrolling up brings them back", async ({ page, isMobile }) => {
      mobileOnly(isMobile);
      await open(page, path);
      const header = page.locator("header").first();
      const nav = page.getByRole("navigation", { name: "주 내비게이션" });
      await expect(header).toBeInViewport();

      await page.mouse.wheel(0, 700);
      await expect(header).not.toBeInViewport();
      await expect(nav).not.toBeInViewport();
      // Out of sight is also out of the tab order.
      await expect(header).toHaveAttribute("inert", "");
      await expect(nav).toHaveAttribute("inert", "");

      await page.mouse.wheel(0, -200);
      await expect(header).toBeInViewport();
      await expect(nav).toBeInViewport();
      await expect(header).not.toHaveAttribute("inert", "");
    });

    test("search: the slash key focuses the header search, which submits to the search page", async ({ page, isMobile }) => {
      desktopOnly(isMobile);
      await open(page, path);
      await page.keyboard.press("/");
      expect(await focused(page)).toBe("input: 밈 검색");
      await page.keyboard.type("중꺾마/");
      await expect(page.getByRole("searchbox", { name: "밈 검색" })).toHaveValue("중꺾마/");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/search\?q=%EC%A4%91%EA%BA%BE%EB%A7%88%2F$/);
    });

    test("search: the slash key does nothing where the search field is not shown", async ({ page, isMobile }) => {
      mobileOnly(isMobile);
      await open(page, path);
      await page.keyboard.press("/");
      expect(await focused(page)).toBe("(nothing)");
    });

    test("footer: site links, and a legal notice that folds on a phone", async ({ page, isMobile }) => {
      await open(page, path);
      const nav = page.getByRole("navigation", { name: "사이트 정보" });
      await expect(nav.getByRole("link")).toHaveText([
        "밈 전체 목록", "문의", "밈캐치 소개", "편집 원칙", "가이드", "개인정보처리방침", "이용약관", "밈캐치 내 급상승", "세대별 밈 소식", "제보", "고객센터",
      ]);
      const notice = page.getByText("밈캐치는 한국 밈·유행어의 뜻과 유래를 기록하는 사전 서비스입니다.", { exact: false });
      await expect(notice).toBeVisible();
      await expect(page.locator("footer").getByRole("link", { name: "toris@toris.kr" })).toHaveAttribute("href", "mailto:toris@toris.kr");
      const summary = page.getByText("운영·저작권 안내", { exact: true });
      if (!isMobile) {
        await expect(summary).toBeHidden();
        return;
      }
      await summary.click();
      await expect(notice).toBeHidden();
      await summary.click();
      await expect(notice).toBeVisible();
    });

    // The page's service worker answers navigations itself, and page.route
    // cannot hold a request the worker makes: here it is not registered.
    test.describe("with no service worker", () => {
      test.use({ serviceWorkers: "block" });

      test("navigation progress: a slow navigation shows a bar along the top edge", async ({ page, isMobile }) => {
        // Desktop width only. At phone width Next showed the bar in some runs
        // of this harness and not in others, with the same steps, so there is
        // no stable behaviour to hold Axum to there yet.
        desktopOnly(isMobile);
        // Hold the next page back, however the server asks for it. Only after
        // the page has loaded: Next fetches linked pages ahead of the click.
        let hold = false;
        await page.route(/\/rankings(\?.*)?$/, async (route) => {
          if (hold) await new Promise((resolve) => setTimeout(resolve, 3000));
          await route.continue();
        });
        // Watched from inside the page, which reports through the console: a
        // page that is leaving (a navigation of the whole document, as on a
        // page without a client router) cannot be evaluated from outside, but
        // it still draws and still logs.
        await page.addInitScript(() => {
          // The bar is decoration: hidden from assistive technology and from
          // the pointer, so it is found by where it is drawn.
          const drawn = () => [...document.querySelectorAll('[aria-hidden="true"]')].some((element) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return style.position === "fixed" && style.opacity !== "0" && box.top <= 1 && box.height > 0 && box.height <= 8
              && [...element.children].some((bar) => bar.getBoundingClientRect().width > 0);
          });
          const timer = setInterval(() => {
            if (!drawn()) return;
            clearInterval(timer);
            console.log(`nav-progress-drawn ${location.pathname}`);
          }, 50);
        });
        const drawnOn = [];
        page.on("console", (message) => {
          const [marker, at] = message.text().split(" ");
          if (marker === "nav-progress-drawn") drawnOn.push(at);
        });
        await open(page, path);
        hold = true;
        expect(drawnOn).toEqual([]);
        // A destination with no loading screen of its own, reached from the
        // header menu so that no scrolling is involved.
        await page.getByRole("button", { name: "메뉴", exact: true }).click();
        await page.getByRole("navigation", { name: "메뉴", exact: true }).getByRole("link", { name: "밈캐치 내 급상승" }).click({ noWaitAfter: true });
        // Drawn on the page being left, before the next one arrives.
        await expect.poll(() => drawnOn, { timeout: 2500 }).toEqual([new URL(path, "http://x").pathname]);
        await expect(page).toHaveURL(/\/rankings$/);
      });
    });
  });
}
